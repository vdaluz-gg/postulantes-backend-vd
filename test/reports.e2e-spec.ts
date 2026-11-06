import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const person = (n: number, extra: Record<string, unknown> = {}) => ({
  fullName: 'Persona Prueba',
  email: `p${n}@x.com`,
  dni: `3200000${n}`,
  whatsapp: '11 5555-0142',
  ...extra,
});

describe('Reportería de postulaciones (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());
  const URL = '/api/v1/backoffice/reports/applications';

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it('exige sesión de administrador', async () => {
    await http().get(URL).expect(401);
  });

  it('sin postulaciones devuelve todo en cero', async () => {
    const res = await http().get(URL).set(bearer(token)).expect(200);
    expect(res.body.total).toBe(0);
    expect(res.body.hired).toBe(0);
    expect(res.body.hireRate).toBe(0);
    expect(res.body.topOffers).toEqual([]);
    expect(res.body.byStatus).toEqual({ received: 0, ai_review: 0, recruiter_review: 0, interview: 0, hired: 0, rejected: 0, withdrawn: 0 });
    expect(res.body.byChannel).toEqual({ new_web: 0, checkin: 0, job_board: 0, social: 0, cdc: 0, backoffice: 0 });
  });

  describe('con postulaciones', () => {
    beforeAll(async () => {
      await http().post('/api/v1/applications').send(person(1, { offerCode: 'IND3307418' })).expect(201);
      await http().post('/api/v1/applications').send(person(2, { offerCode: 'IND3307418', channel: 'checkin' })).expect(201);
      await http().post('/api/v1/applications').send(person(3, { offerCode: 'LOG7712093' })).expect(201);
      await http().post('/api/v1/applications').send(person(4)).expect(201);
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ limit: 100 }).expect(200);
      const byDni = (dni: string) => list.body.items.find((a: { candidate: { dni: string } }) => a.candidate.dni === dni).id;
      await http().patch(`/api/v1/backoffice/applications/${byDni('32000001')}/status`).set(bearer(token)).send({ status: 'hired' }).expect(200);
      await http().patch(`/api/v1/backoffice/applications/${byDni('32000002')}/status`).set(bearer(token)).send({ status: 'rejected' }).expect(200);
    });

    it('cuenta por estado, canal y oferta, y calcula la tasa de contratación', async () => {
      const res = await http().get(URL).set(bearer(token)).expect(200);
      expect(res.body.total).toBe(4);
      expect(res.body.byStatus).toEqual(expect.objectContaining({ received: 2, hired: 1, rejected: 1 }));
      expect(res.body.byChannel).toEqual(expect.objectContaining({ new_web: 3, checkin: 1 }));
      expect(res.body.hired).toBe(1);
      expect(res.body.hireRate).toBe(0.25);
      expect(res.body.topOffers).toEqual([
        { code: 'IND3307418', title: 'Operario/a de producción · Feteados', applications: 2 },
        { code: 'LOG7712093', title: 'Chofer de camión chasis', applications: 1 },
      ]);
    });

    it('no incluye datos personales', async () => {
      const res = await http().get(URL).set(bearer(token)).expect(200);
      expect(JSON.stringify(res.body)).not.toMatch(/3200000|@x\.com|Persona Prueba/);
    });

    it('filtra por rango de fechas', async () => {
      const future = await http().get(URL).set(bearer(token)).query({ from: '2999-01-01' }).expect(200);
      expect(future.body.total).toBe(0);
      const today = new Date().toISOString().slice(0, 10);
      const inRange = await http().get(URL).set(bearer(token)).query({ from: today, to: today }).expect(200);
      expect(inRange.body.total).toBe(4);
    });

    it('valida las fechas', async () => {
      await http().get(URL).set(bearer(token)).query({ from: 'ayer' }).expect(400);
      await http().get(URL).set(bearer(token)).query({ from: '2026-12-01', to: '2026-01-01' }).expect(400);
    });
  });
});
