import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CvDocument } from '../src/modules/cv/entities/cv-document.entity';
import { FILE_SCANNER, FileScanner, ScanInput, ScanResult } from '../src/modules/cv/ports/file-scanner';
import { createTestApp, InMemoryFileStorage } from './utils/test-app';

const pdf = () => Buffer.from('%PDF-1.4\nCV de prueba\n%%EOF');

class FakeScanner implements FileScanner {
  calls: ScanInput[] = [];
  constructor(private readonly behaviour: () => Promise<ScanResult>) {}
  scan(input: ScanInput): Promise<ScanResult> {
    this.calls.push(input);
    return this.behaviour();
  }
}

async function withScanner(scanner: FileScanner): Promise<{ app: INestApplication; ds: DataSource; storage: InMemoryFileStorage }> {
  const { app, dataSource, storage } = await createTestApp((b) => b.overrideProvider(FILE_SCANNER).useValue(scanner));
  return { app, ds: dataSource, storage };
}

describe('Análisis de archivos al subir el CV (integración)', () => {
  it('por defecto (sin antivirus configurado) el CV se sube con normalidad', async () => {
    const { app, dataSource } = await createTestApp();
    try {
      await request(app.getHttpServer()).post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(201);
      expect(await dataSource.getRepository(CvDocument).count()).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('un archivo limpio se guarda; el análisis recibe el contenido y el nombre ya depurado', async () => {
    const scanner = new FakeScanner(async () => ({ clean: true }));
    const { app, ds } = await withScanner(scanner);
    try {
      await request(app.getHttpServer()).post('/api/v1/cv').attach('file', pdf(), { filename: '../../cv de Martina.pdf' }).expect(201);
      expect(scanner.calls).toHaveLength(1);
      expect(scanner.calls[0].buffer.equals(pdf())).toBe(true);
      expect(scanner.calls[0].fileName).toBe('cv de Martina.pdf');
      expect(await ds.getRepository(CvDocument).count()).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('un archivo con una amenaza se rechaza (422) y no queda nada guardado ni se lee', async () => {
    const scanner = new FakeScanner(async () => ({ clean: false, threat: 'Win.Test.EICAR_HDB-1' }));
    const { app, ds, storage } = await withScanner(scanner);
    try {
      const res = await request(app.getHttpServer()).post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(422);
      expect(res.body.message).toBe('El archivo no pasó el análisis de seguridad');
      expect(JSON.stringify(res.body)).not.toContain('EICAR');
      expect(storage.files.size).toBe(0);
      expect(await ds.getRepository(CvDocument).count()).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('si el antivirus no responde, no se acepta el archivo (falla cerrado) y no se filtra el detalle', async () => {
    const scanner = new FakeScanner(async () => {
      throw new Error('ECONNREFUSED clamav:3310 secret=abc123');
    });
    const { app, ds, storage } = await withScanner(scanner);
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const res = await request(app.getHttpServer()).post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(503);
      expect(res.body.message).toBe('No pudimos analizar el archivo. Probá de nuevo más tarde');
      expect(JSON.stringify(res.body)).not.toMatch(/clamav|abc123/);
      expect(storage.files.size).toBe(0);
      expect(await ds.getRepository(CvDocument).count()).toBe(0);
      const log = logged.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(log).toContain('ECONNREFUSED');
      expect(log).not.toContain('abc123');
    } finally {
      logged.mockRestore();
      await app.close();
    }
  });

  it('un archivo que no es PDF, DOC ni DOCX se rechaza antes de llegar al análisis', async () => {
    const scanner = new FakeScanner(async () => ({ clean: true }));
    const { app } = await withScanner(scanner);
    try {
      await request(app.getHttpServer()).post('/api/v1/cv').attach('file', Buffer.from('MZ ejecutable'), { filename: 'cv.pdf' }).expect(415);
      expect(scanner.calls).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
