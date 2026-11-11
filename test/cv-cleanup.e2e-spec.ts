import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { CvCleanupService } from '../src/modules/cv/cv-cleanup.service';
import { CvDocument } from '../src/modules/cv/entities/cv-document.entity';
import { createTestApp, InMemoryFileStorage } from './utils/test-app';

const HOUR = 3_600_000;
const pdf = () => Buffer.from('%PDF-1.4\nCV de prueba');
const person = { fullName: 'Martina Rodríguez', email: 'martina@ejemplo.com', dni: '38412907', whatsapp: '11 5555-0142' };

describe('Limpieza de CV sin postulante (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let storage: InMemoryFileStorage;
  let cleanup: CvCleanupService;
  const http = () => request(app.getHttpServer());

  const upload = async (): Promise<string> => (await http().post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(201)).body.cvId;
  const age = (id: string, hours: number) =>
    ds.getRepository(CvDocument).update({ id }, { createdAt: new Date(Date.now() - hours * HOUR) });

  beforeAll(async () => {
    ({ app, dataSource: ds, storage } = await createTestApp());
    await seedReferenceData(ds);
    cleanup = app.get(CvCleanupService);
  });
  afterAll(async () => {
    await app.close();
  });

  it('borra el CV que nunca se asoció a una postulación una vez pasado el plazo (base y archivo)', async () => {
    const id = await upload();
    const { storageKey } = await ds.getRepository(CvDocument).findOneByOrFail({ id });
    await age(id, 48);
    expect(storage.files.has(storageKey)).toBe(true);

    expect(await cleanup.purgeOrphans(new Date(Date.now() - 24 * HOUR))).toBe(1);
    expect(await ds.getRepository(CvDocument).countBy({ id })).toBe(0);
    expect(storage.files.has(storageKey)).toBe(false);
  });

  it('no toca el CV reciente: la persona puede estar todavía completando el formulario', async () => {
    const id = await upload();
    await age(id, 2);
    expect(await cleanup.purgeOrphans(new Date(Date.now() - 24 * HOUR))).toBe(0);
    expect(await ds.getRepository(CvDocument).countBy({ id })).toBe(1);
  });

  it('no toca un CV viejo que sí pertenece a un postulante', async () => {
    const id = await upload();
    await http().post('/api/v1/applications').send({ ...person, cvId: id }).expect(201);
    await age(id, 100);
    await cleanup.purgeOrphans(new Date(Date.now() - 24 * HOUR));
    const doc = await ds.getRepository(CvDocument).findOneByOrFail({ id });
    expect(doc.candidateId).not.toBeNull();
    expect(storage.files.has(doc.storageKey)).toBe(true);
  });

  it('si no hay nada para limpiar devuelve 0', async () => {
    expect(await cleanup.purgeOrphans(new Date(0))).toBe(0);
  });

  it('si falla el borrado del archivo igual elimina el registro y sigue con los demás', async () => {
    const a = await upload();
    const b = await upload();
    await age(a, 48);
    await age(b, 48);
    const original = storage.remove.bind(storage);
    let first = true;
    storage.remove = async (key: string) => {
      if (first) {
        first = false;
        throw new Error('disco lleno en 38412907');
      }
      return original(key);
    };
    try {
      expect(await cleanup.purgeOrphans(new Date(Date.now() - 24 * HOUR))).toBe(2);
    } finally {
      storage.remove = original;
    }
    expect(await ds.getRepository(CvDocument).countBy({ id: In([a, b]) })).toBe(0);
  });
});
