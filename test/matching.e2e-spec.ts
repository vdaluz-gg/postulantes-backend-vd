import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { CvDocument } from '../src/modules/cv/entities/cv-document.entity';
import { JobOffer } from '../src/modules/job-offers/entities/job-offer.entity';
import { Zone } from '../src/modules/zones/entities/zone.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const NO_ID = '8d6c5f6e-0000-4000-8000-000000000000';

describe('Matching: postulantes sugeridos para una oferta (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let offer: JobOffer; // Operario/a de producción · Feteados (Monte Grande, Industria)
  let zoneId: string;
  let otherZoneId: string;
  const http = () => request(app.getHttpServer());
  const url = (id = offer.id, q = '') => `/api/v1/backoffice/job-offers/${id}/matches${q}`;

  const create = async (dni: string, extra: Record<string, unknown> = {}) => {
    const res = await http()
      .post('/api/v1/backoffice/candidates')
      .set(bearer(token))
      .send({ fullName: 'Persona Prueba', email: `p${dni}@x.com`, dni, whatsapp: '11 5555-0142', ...extra })
      .expect(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
    offer = await ds.getRepository(JobOffer).findOneByOrFail({ code: 'IND3307418' });
    zoneId = offer.zoneId;
    otherZoneId = (await ds.getRepository(Zone).findOneByOrFail({ name: 'Salta' })).id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('exige sesión de administrador', async () => {
    await http().get(url()).expect(401);
  });

  it('404 si la oferta no existe y 400 si el id no es un UUID', async () => {
    await http().get(url(NO_ID)).set(bearer(token)).expect(404);
    await http().get(url('abc')).set(bearer(token)).expect(400);
  });

  describe('con postulantes cargados', () => {
    let best: string;
    let partial: string;
    let far: string;

    beforeAll(async () => {
      best = await create('30000001', { zoneId, position: 'Operario de producción' });
      partial = await create('30000002', { zoneId, position: 'Chofer' });
      far = await create('30000003', { zoneId: otherZoneId, position: 'Operario de producción' });
      await ds.getRepository(Candidate).update({ id: best }, { identityStatus: 'verified' });
      await ds.getRepository(Candidate).update({ id: far }, { identityStatus: 'verified' });
      await ds.getRepository(CvDocument).save(
        ds.getRepository(CvDocument).create({ candidateId: best, originalName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 10, storageKey: 'k1' }),
      );
    });

    it('ordena de más a menos afinidad y explica el porqué', async () => {
      const res = await http().get(url()).set(bearer(token)).expect(200);
      expect(res.body.offer).toEqual({ id: offer.id, code: 'IND3307418', title: 'Operario/a de producción · Feteados' });
      const ids = res.body.items.map((i: { candidate: { id: string } }) => i.candidate.id);
      expect(ids).toEqual([best, far, partial]);
      expect(res.body.items[0]).toEqual({
        candidate: { id: best, fullName: 'Persona Prueba', zone: 'Monte Grande', position: 'Operario de producción', identityStatus: 'verified' },
        score: 100,
        reasons: ['zone', 'position', 'identity', 'cv'],
        alreadyApplied: false,
      });
      expect(res.body.items[1]).toEqual(expect.objectContaining({ score: 50, reasons: ['position', 'identity'] }));
      expect(res.body.items[2]).toEqual(expect.objectContaining({ score: 40, reasons: ['zone'] }));
    });

    it('no expone contacto ni DNI en las sugerencias', async () => {
      const res = await http().get(url()).set(bearer(token)).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/30000001|@x\.com|\+549/);
    });

    it('marca a quienes ya se postularon a esa oferta', async () => {
      await http().post('/api/v1/applications').send({ fullName: 'Persona Prueba', email: 'p30000001@x.com', dni: '30000001', whatsapp: '11 5555-0142', offerCode: 'IND3307418' }).expect(201);
      const res = await http().get(url()).set(bearer(token)).expect(200);
      const first = res.body.items.find((i: { candidate: { id: string } }) => i.candidate.id === best);
      expect(first.alreadyApplied).toBe(true);
    });

    it('minScore y limit recortan el resultado', async () => {
      const strict = await http().get(url(offer.id, '?minScore=50')).set(bearer(token)).expect(200);
      expect(strict.body.items).toHaveLength(2);
      const one = await http().get(url(offer.id, '?minScore=0&limit=1')).set(bearer(token)).expect(200);
      expect(one.body.items).toHaveLength(1);
    });

    it('deja afuera a quienes ya son colaboradores y a quienes fallaron la validación de identidad', async () => {
      await ds.getRepository(Candidate).update({ id: far }, { profileStage: 'collaborator' });
      await ds.getRepository(Candidate).update({ id: partial }, { identityStatus: 'rejected' });
      const res = await http().get(url()).set(bearer(token)).expect(200);
      expect(res.body.items.map((i: { candidate: { id: string } }) => i.candidate.id)).toEqual([best]);
    });

    it('valida los parámetros', async () => {
      await http().get(url(offer.id, '?minScore=101')).set(bearer(token)).expect(400);
      await http().get(url(offer.id, '?minScore=-1')).set(bearer(token)).expect(400);
      await http().get(url(offer.id, '?limit=101')).set(bearer(token)).expect(400);
      await http().get(url(offer.id, '?limit=0')).set(bearer(token)).expect(400);
    });
  });
});
