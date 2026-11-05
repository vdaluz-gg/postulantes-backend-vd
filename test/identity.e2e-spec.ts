import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { IDENTITY_PROVIDER, IdentityValidationProvider } from '../src/modules/identity/ports/identity-validation-provider';
import { IdentityVerification } from '../src/modules/identity/entities/identity-verification.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const NIL = '8d6c5f6e-0000-4000-8000-000000000000';
const person = { fullName: 'Martina Rodríguez', email: 'm@x.com', dni: '38412907', whatsapp: '11 5555-0142' };

describe('Validación de identidad (preparación RENAPER) (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());

  const create = async (over: Record<string, string> = {}): Promise<string> =>
    (await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...person, ...over }).expect(201)).body.id;

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['post', `/api/v1/backoffice/candidates/${NIL}/identity-verifications`],
    ['get', `/api/v1/backoffice/candidates/${NIL}/identity-verifications`],
  ] as const)('%s %s exige sesión de administrador', async (method, url) => {
    await request(app.getHttpServer())[method](url).expect(401);
  });

  it('un postulante nuevo está sin verificar y sin historial', async () => {
    const id = await create();
    expect((await http().get(`/api/v1/backoffice/candidates/${id}`).set(bearer(token))).body.identityStatus).toBe('unverified');
    const hist = await http().get(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).expect(200);
    expect(hist.body).toEqual([]);
  });

  it('verifica los datos del DNI, actualiza el estado y deja el registro del intento', async () => {
    const id = await create({ dni: '38412908', email: 'ok@x.com' });
    const res = await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({ kind: 'dni_data' }).expect(201);
    expect(res.body).toEqual({ id: expect.any(String), kind: 'dni_data', provider: 'mock', result: 'verified', score: 98, reason: null, createdAt: expect.any(String) });
    expect((await ds.getRepository(Candidate).findOneByOrFail({ id })).identityStatus).toBe('verified');
    const hist = await http().get(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).expect(200);
    expect(hist.body).toHaveLength(1);
  });

  it('si el proveedor lo rechaza, el postulante queda "rejected" con el motivo', async () => {
    const id = await create({ dni: '30111220', email: 'r@x.com' });
    const res = await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({ kind: 'dni_data' }).expect(201);
    expect(res.body.result).toBe('rejected');
    expect(res.body.reason).toEqual(expect.any(String));
    expect((await ds.getRepository(Candidate).findOneByOrFail({ id })).identityStatus).toBe('rejected');
  });

  it('el listado de postulantes se puede filtrar por estado de identidad', async () => {
    const v = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ identityStatus: 'verified' }).expect(200);
    expect(v.body.total).toBe(1);
    const r = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ identityStatus: 'rejected' }).expect(200);
    expect(r.body.total).toBe(1);
  });

  it('huella y foto facial todavía no están disponibles (501) y no dejan rastro', async () => {
    const id = await create({ dni: '30111221', email: 'h@x.com' });
    for (const kind of ['fingerprint', 'face']) {
      const res = await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({ kind }).expect(501);
      expect(res.body.message).toBe('Esta validación todavía no está disponible');
    }
    expect(await ds.getRepository(IdentityVerification).countBy({ candidateId: id })).toBe(0);
  });

  it('valida el tipo, el id y que el postulante exista', async () => {
    const id = await create({ dni: '30111222', email: 'v@x.com' });
    await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({ kind: 'iris' }).expect(400);
    await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({}).expect(400);
    await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({ kind: 'dni_data', dni: '1' }).expect(400);
    await http().post('/api/v1/backoffice/candidates/abc/identity-verifications').set(bearer(token)).send({ kind: 'dni_data' }).expect(400);
    await http().post(`/api/v1/backoffice/candidates/${NIL}/identity-verifications`).set(bearer(token)).send({ kind: 'dni_data' }).expect(404);
  });

  it('eliminar al postulante borra también su historial de verificaciones', async () => {
    const id = await create({ dni: '30111223', email: 'del@x.com' });
    await http().post(`/api/v1/backoffice/candidates/${id}/identity-verifications`).set(bearer(token)).send({ kind: 'dni_data' }).expect(201);
    await http().delete(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).expect(204);
    expect(await ds.getRepository(IdentityVerification).countBy({ candidateId: id })).toBe(0);
  });
});

describe('Validación de identidad cuando el proveedor falla (integración)', () => {
  it('responde 502, registra el error y no cambia el estado', async () => {
    const failing: IdentityValidationProvider = {
      name: 'renaper-sid',
      verifyDniData: async () => {
        throw new Error('401 invalid_client secret=abc123 host=10.0.0.9');
      },
    };
    const { app, dataSource } = await createTestApp((b) => b.overrideProvider(IDENTITY_PROVIDER).useValue(failing));
    try {
      const token = await adminToken(app, dataSource);
      const created = await request(app.getHttpServer()).post('/api/v1/backoffice/candidates').set(bearer(token)).send(person).expect(201);
      const res = await request(app.getHttpServer()).post(`/api/v1/backoffice/candidates/${created.body.id}/identity-verifications`).set(bearer(token)).send({ kind: 'dni_data' }).expect(502);
      expect(res.body.message).toBe('No pudimos consultar el servicio de identidad. Probá de nuevo más tarde');
      expect(JSON.stringify(res.body)).not.toMatch(/abc123|10\.0\.0\.9/);
      expect((await dataSource.getRepository(Candidate).findOneByOrFail({ id: created.body.id })).identityStatus).toBe('unverified');
      const rows = await dataSource.getRepository(IdentityVerification).findBy({ candidateId: created.body.id });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({ result: 'error', provider: 'renaper-sid' }));
      expect(rows[0].reason).not.toMatch(/abc123|10\.0\.0\.9/);
    } finally {
      await app.close();
    }
  });
});
