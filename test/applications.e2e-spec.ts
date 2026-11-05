import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { Consent } from '../src/modules/consents/entities/consent.entity';
import { CvDocument } from '../src/modules/cv/entities/cv-document.entity';
import { Zone } from '../src/modules/zones/entities/zone.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp, InMemoryFileStorage } from './utils/test-app';

const contact = { fullName: 'Martina Rodríguez', email: 'Martina@Ejemplo.com', dni: '38.412.907', whatsapp: '11 5555-0142' };
const TRACK = /^GG-[2-9A-HJ-NP-Z]{6}$/;

describe('Postulaciones (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let storage: InMemoryFileStorage;
  let token: string;
  let zoneId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds, storage } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
    zoneId = (await ds.getRepository(Zone).findOneByOrFail({ name: 'Monte Grande' })).id;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /applications (público)', () => {
    let trackingCode: string;

    it('se postula a una oferta: crea al postulante y la postulación', async () => {
      const res = await http().post('/api/v1/applications').send({ ...contact, zoneId, offerCode: 'IND3307418' }).expect(201);
      trackingCode = res.body.trackingCode;
      expect(trackingCode).toMatch(TRACK);
      expect(res.body).toEqual({
        trackingCode,
        status: 'received',
        stage: 1,
        position: 'Operario/a de producción · Feteados',
        offer: { ref: 'IND3307418', title: 'Operario/a de producción · Feteados' },
      });
      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' });
      expect(c).toEqual(expect.objectContaining({ email: 'martina@ejemplo.com', whatsapp: '+5491155550142', source: 'manual', zoneId }));
      expect(JSON.stringify(res.body)).not.toContain(c.id);
    });

    it('no deja postularse dos veces a la misma oferta', async () => {
      const res = await http().post('/api/v1/applications').send({ ...contact, offerCode: 'IND3307418' }).expect(409);
      expect(res.body.message).toBe('Ya te postulaste a esta oferta');
    });

    it('con el mismo DNI y mail reutiliza al postulante y actualiza sus datos', async () => {
      const res = await http().post('/api/v1/applications').send({ ...contact, whatsapp: '11 6666-7777', offerCode: 'LOG7712093' }).expect(201);
      expect(res.body.trackingCode).not.toBe(trackingCode);
      expect(await ds.getRepository(Candidate).count()).toBe(1);
      expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).whatsapp).toBe('+5491166667777');
    });

    it('un DNI ya registrado con otro mail no se puede pisar', async () => {
      const res = await http().post('/api/v1/applications').send({ ...contact, email: 'intruso@x.com', fullName: 'Intruso Pérez' }).expect(409);
      expect(res.body.message).toBe('No pudimos registrar tu postulación con esos datos. Escribinos a RR. HH.');
      expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).fullName).toBe('Martina Rodríguez');
    });

    it('sin oferta es una postulación espontánea (o con el puesto indicado)', async () => {
      const a = await http().post('/api/v1/applications').send({ ...contact, dni: '30111222', email: 'a@x.com' }).expect(201);
      expect(a.body).toEqual(expect.objectContaining({ position: 'Postulación espontánea', offer: null }));
      const b = await http().post('/api/v1/applications').send({ ...contact, dni: '30111333', email: 'b@x.com', position: 'Chofer' }).expect(201);
      expect(b.body.position).toBe('Chofer');
    });

    it('404 si la oferta no existe o está cerrada', async () => {
      await http().post('/api/v1/applications').send({ ...contact, dni: '30111444', email: 'c@x.com', offerCode: 'NOEXISTE' }).expect(404);
    });

    it('asocia el CV subido al postulante', async () => {
      const pdf = Buffer.from('%PDF-1.4\nx');
      const cv = await http().post('/api/v1/cv').attach('file', pdf, { filename: 'cv.pdf' }).expect(201);
      await http().post('/api/v1/applications').send({ ...contact, dni: '30111555', email: 'd@x.com', cvId: cv.body.cvId }).expect(201);
      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111555' });
      expect(c.source).toBe('cv_ai');
      expect((await ds.getRepository(CvDocument).findOneByOrFail({ id: cv.body.cvId })).candidateId).toBe(c.id);
    });

    it('rechaza un CV inexistente o que ya es de otra persona', async () => {
      await http().post('/api/v1/applications').send({ ...contact, dni: '30111666', email: 'e@x.com', cvId: '8d6c5f6e-0000-4000-8000-000000000000' }).expect(400);
      const used = await ds.getRepository(CvDocument).findOneByOrFail({ candidateId: (await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111555' })).id });
      const res = await http().post('/api/v1/applications').send({ ...contact, dni: '30111777', email: 'f@x.com', cvId: used.id }).expect(400);
      expect(res.body.message).toBe('El CV no es válido');
    });

    it('vincula los permisos aceptados en la sesión con el postulante', async () => {
      const sessionId = 'sesion-navegador-123';
      await http().post('/api/v1/consents').send({ sessionId, decisions: [{ type: 'location', granted: true }] }).expect(201);
      await http().post('/api/v1/applications').send({ ...contact, dni: '30111888', email: 'g@x.com', sessionId }).expect(201);
      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111888' });
      expect(await ds.getRepository(Consent).countBy({ sessionId, candidateId: c.id })).toBe(1);
    });

    it.each([
      ['sin nombre y apellido', { fullName: 'Martina' }],
      ['DNI inválido', { dni: '12' }],
      ['WhatsApp inválido', { whatsapp: '123' }],
      ['mail inválido', { email: 'x' }],
      ['zona inexistente', { zoneId: '8d6c5f6e-0000-4000-8000-000000000000' }],
      ['campos no permitidos', { status: 'hired' }],
    ])('valida: %s', async (_n, patch) => {
      await http().post('/api/v1/applications').send({ ...contact, dni: '30999000', email: 'z@x.com', ...patch }).expect(400);
    });

    describe('GET /applications/track/:code', () => {
      it('muestra el estado y los pasos, sin notas internas ni datos personales', async () => {
        const res = await http().get(`/api/v1/applications/track/${trackingCode}`).expect(200);
        expect(res.body).toEqual({
          trackingCode,
          position: 'Operario/a de producción · Feteados',
          offer: { ref: 'IND3307418', title: 'Operario/a de producción · Feteados' },
          status: 'received',
          stage: 1,
          steps: [
            { label: 'Postulación', state: 'now' },
            { label: 'Agente IA', state: 'next' },
            { label: 'Selectora', state: 'next' },
            { label: 'Resultado', state: 'next' },
          ],
          history: [{ at: expect.any(String), status: 'received' }],
          updatedAt: expect.any(String),
        });
        expect(JSON.stringify(res.body)).not.toMatch(/dni|email|whatsapp|38412907/i);
      });

      it('404 para un código inexistente o con formato inválido', async () => {
        await http().get('/api/v1/applications/track/GG-AAAAAA').expect(404);
        await http().get('/api/v1/applications/track/cualquier-cosa').expect(404);
      });
    });
  });

  describe('Backoffice /backoffice/applications', () => {
    it.each([
      ['get', '/api/v1/backoffice/applications'],
      ['get', '/api/v1/backoffice/applications/8d6c5f6e-0000-4000-8000-000000000000'],
      ['patch', '/api/v1/backoffice/applications/8d6c5f6e-0000-4000-8000-000000000000/status'],
    ] as const)('%s %s exige sesión de administrador', async (method, url) => {
      await request(app.getHttpServer())[method](url).expect(401);
    });

    it('lista con datos del postulante, filtros y paginación', async () => {
      const all = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
      expect(all.body.total).toBeGreaterThanOrEqual(5);
      expect(all.body.items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          trackingCode: expect.stringMatching(TRACK),
          candidate: expect.objectContaining({ id: expect.any(String), fullName: expect.any(String), dni: expect.any(String) }),
          status: 'received',
          stage: 1,
        }),
      );
      const byOffer = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ jobOfferCode: 'LOG7712093' }).expect(200);
      expect(byOffer.body.total).toBe(1);
      const paged = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ limit: 2 }).expect(200);
      expect(paged.body.items).toHaveLength(2);
      await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ status: 'raro' }).expect(400);
    });

    it('cambia el estado, deja historial con nota y lo ve el postulante', async () => {
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ jobOfferCode: 'IND3307418' }).expect(200);
      const { id, trackingCode } = list.body.items[0];

      const res = await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'interview', note: 'Entrevista el viernes 10 h' }).expect(200);
      expect(res.body.status).toBe('interview');
      expect(res.body.stage).toBe(3);
      expect(res.body.history.map((h: { status: string }) => h.status)).toEqual(['received', 'interview']);
      expect(res.body.history[1].note).toBe('Entrevista el viernes 10 h');

      const pub = await http().get(`/api/v1/applications/track/${trackingCode}`).expect(200);
      expect(pub.body.status).toBe('interview');
      expect(pub.body.history).toHaveLength(2);
      expect(JSON.stringify(pub.body)).not.toContain('viernes 10 h');
    });

    it('no permite retroceder ni modificar un estado final', async () => {
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ jobOfferCode: 'IND3307418' }).expect(200);
      const { id } = list.body.items[0];
      const back = await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'received' }).expect(409);
      expect(back.body.message).toBe('No se puede pasar de "interview" a "received"');
      await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'hired' }).expect(200);
      await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'rejected' }).expect(409);
    });

    it('valida el cuerpo y el id', async () => {
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
      const id = list.body.items[0].id;
      await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'inventado' }).expect(400);
      await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({}).expect(400);
      await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'rejected', note: 'x'.repeat(501) }).expect(400);
      await http().patch('/api/v1/backoffice/applications/abc/status').set(bearer(token)).send({ status: 'rejected' }).expect(400);
      await http().patch('/api/v1/backoffice/applications/8d6c5f6e-0000-4000-8000-000000000000/status').set(bearer(token)).send({ status: 'rejected' }).expect(404);
    });

    it('al eliminar un postulante se borran sus postulaciones, permisos y CV (con el archivo)', async () => {
      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111555' });
      const cv = await ds.getRepository(CvDocument).findOneByOrFail({ candidateId: c.id });
      expect(storage.files.has(cv.storageKey)).toBe(true);
      await http().delete(`/api/v1/backoffice/candidates/${c.id}`).set(bearer(token)).expect(204);
      expect(storage.files.has(cv.storageKey)).toBe(false);
      expect(await ds.getRepository(CvDocument).countBy({ id: cv.id })).toBe(0);
      const apps = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ candidateId: c.id }).expect(200);
      expect(apps.body.total).toBe(0);
    });

    it('el detalle del postulante muestra sus postulaciones y permisos', async () => {
      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111888' });
      const res = await http().get(`/api/v1/backoffice/candidates/${c.id}`).set(bearer(token)).expect(200);
      expect(res.body.applications).toHaveLength(1);
      expect(res.body.consents).toEqual([{ type: 'location', granted: true, at: expect.any(String) }]);
    });
  });
});
