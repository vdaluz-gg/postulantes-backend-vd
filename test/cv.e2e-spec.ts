import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { CvDocument } from '../src/modules/cv/entities/cv-document.entity';
import { CV_READER, CvReader } from '../src/modules/cv/ports/cv-reader';
import { Zone } from '../src/modules/zones/entities/zone.entity';
import { cidFontPdf, textPdf } from './utils/pdf-builder';
import { createTestApp, InMemoryFileStorage } from './utils/test-app';
import { buildDocx, wordParagraphs } from './utils/zip-builder';

const pdf = (extra = '') => Buffer.from(`%PDF-1.4\n${extra}\n%%EOF`);

describe('Subir CV con IA (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let storage: InMemoryFileStorage;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds, storage } = await createTestApp());
    await seedReferenceData(ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lee el CV y devuelve los datos para precargar el formulario, ya validados', async () => {
    const cv = textPdf(['Lucía Fernández', 'DNI 40.123.456', 'Celular: 11 4444-0101', 'lucia@ejemplo.com', 'Localidad: Monte Grande']);
    const res = await http().post('/api/v1/cv').attach('file', cv, { filename: 'mi cv.pdf', contentType: 'application/pdf' }).expect(201);
    const zone = await ds.getRepository(Zone).findOneByOrFail({ name: 'Monte Grande' });
    expect(res.body.cvId).toEqual(expect.any(String));
    expect(res.body.fileName).toBe('mi cv.pdf');
    expect(res.body.prefill).toEqual({
      fullName: 'Lucía Fernández',
      email: 'lucia@ejemplo.com',
      dni: '40.123.456',
      whatsapp: '11 4444-0101',
      zone: 'Monte Grande',
      zoneId: zone.id,
    });
    expect(res.body.validation.valid).toBe(true);
    expect(res.body.validation.fields.dni.normalized).toBe('40123456');
    expect(res.body.validation.fields.whatsapp.normalized).toBe('+5491144440101');
    const doc = await ds.getRepository(CvDocument).findOneByOrFail({ id: res.body.cvId });
    expect(doc.extracted).toEqual({ fullName: 'Lucía Fernández', email: 'lucia@ejemplo.com', dni: '40.123.456', whatsapp: '11 4444-0101', zone: 'Monte Grande' });
  });

  it('guarda el archivo con un nombre generado por el servidor y deja el registro', async () => {
    const before = storage.files.size;
    const res = await http().post('/api/v1/cv').attach('file', pdf('otro'), { filename: '../../etc/passwd.pdf', contentType: 'application/pdf' }).expect(201);
    expect(storage.files.size).toBe(before + 1);
    const doc = await ds.getRepository(CvDocument).findOneByOrFail({ id: res.body.cvId });
    expect(doc.originalName).toBe('passwd.pdf');
    expect(doc.storageKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.candidateId).toBeNull();
    expect(storage.files.has(doc.storageKey)).toBe(true);
  });

  it('acepta un DOCX que no se puede leer y deja el formulario vacío', async () => {
    const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml')]);
    const res = await http().post('/api/v1/cv').attach('file', docx, { filename: 'cv.docx' }).expect(201);
    expect(res.body.prefill).toEqual({});
  });

  it('rechaza lo que no es PDF/DOC/DOCX aunque la extensión diga lo contrario', async () => {
    const before = storage.files.size;
    const res = await http().post('/api/v1/cv').attach('file', Buffer.from('MZ ejecutable'), { filename: 'virus.pdf', contentType: 'application/pdf' }).expect(415);
    expect(res.body.message).toBe('El archivo no es un PDF, DOC o DOCX válido');
    expect(storage.files.size).toBe(before);
  });

  it('rechaza archivos de más de 5 MB', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    await http().post('/api/v1/cv').attach('file', big, { filename: 'grande.pdf' }).expect(413);
  });

  it('pide el archivo si no viene', async () => {
    const res = await http().post('/api/v1/cv').expect(400);
    expect(res.body.message).toBe('Adjuntá tu CV');
  });

  it('rechaza archivos en un campo que no es "file"', async () => {
    await http().post('/api/v1/cv').attach('otro', pdf(), { filename: 'cv.pdf' }).expect(400);
  });

  it('rechaza archivos vacíos', async () => {
    await http().post('/api/v1/cv').attach('file', Buffer.alloc(0), { filename: 'cv.pdf' }).expect(400);
  });
});

// Otra app (y otro límite de pedidos: /cv acepta 10 por minuto) para los distintos formatos de CV.
describe('Leer los datos de CV reales (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it('lee un PDF con fuente CID (Identity-H + ToUnicode) y kerning en TJ', async () => {
    const cv = cidFontPdf(['CURRICULUM VITAE', 'MARTÍN GÓMEZ', 'D.N.I. 5.123.456', 'WhatsApp: +54 9 351 555-0142', 'Vivo en Quilmes']);
    const res = await http().post('/api/v1/cv').attach('file', cv, { filename: 'cv.pdf' }).expect(201);
    expect(res.body.prefill).toEqual(
      expect.objectContaining({ fullName: 'Martín Gómez', dni: '5.123.456', whatsapp: '351 555-0142', zone: 'Quilmes', zoneId: expect.any(String) }),
    );
    expect(res.body.validation.valid).toBe(true);
  });

  it('lee un DOCX con los datos de contacto en el encabezado', async () => {
    const docx = buildDocx(wordParagraphs(['Perfil', 'Atención al cliente', 'Dirección: Av. Siempreviva 742, Monte Grande']), [
      wordParagraphs(['Carla Domínguez', 'carla@ejemplo.com · Cel. 011 15 4444-0202 · DNI 41.222.333']),
    ]);
    const res = await http().post('/api/v1/cv').attach('file', docx, { filename: 'cv.docx' }).expect(201);
    const zone = await ds.getRepository(Zone).findOneByOrFail({ name: 'Monte Grande' });
    expect(res.body.prefill).toEqual({
      fullName: 'Carla Domínguez',
      email: 'carla@ejemplo.com',
      dni: '41.222.333',
      whatsapp: '11 4444-0202',
      zone: 'Monte Grande',
      zoneId: zone.id,
    });
    expect(res.body.validation.valid).toBe(true);
  });

  it('un PDF sin texto (escaneado) devuelve el formulario vacío para completar a mano', async () => {
    const res = await http().post('/api/v1/cv').attach('file', pdf(), { filename: 'escaneado.pdf' }).expect(201);
    expect(res.body.prefill).toEqual({});
    expect(res.body.validation).toEqual({ valid: false, fields: {} });
    expect((await ds.getRepository(CvDocument).findOneByOrFail({ id: res.body.cvId })).extracted).toEqual({});
  });
});

describe('Subir CV cuando la IA falla (integración)', () => {
  it('avisa que se complete a mano y no deja archivos huérfanos', async () => {
    const failing: CvReader = {
      read: async () => {
        throw new Error('timeout del proveedor de IA 10.1.2.3');
      },
    };
    const { app, dataSource, storage } = await createTestApp((b) => b.overrideProvider(CV_READER).useValue(failing));
    try {
      const res = await request(app.getHttpServer()).post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(502);
      expect(res.body.message).toBe('No pudimos leer tu CV. Completá los datos a mano');
      expect(JSON.stringify(res.body)).not.toContain('10.1.2.3');
      expect(storage.files.size).toBe(0);
      expect(await dataSource.getRepository(CvDocument).count()).toBe(0);
    } finally {
      await app.close();
    }
  });
});
