import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const NIL = '8d6c5f6e-0000-4000-8000-000000000000';

describe('Backoffice: zonas y ofertas (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('exigen sesión de administrador', () => {
    it.each([
      ['get', '/api/v1/backoffice/zones'],
      ['post', '/api/v1/backoffice/zones'],
      ['patch', `/api/v1/backoffice/zones/${NIL}`],
      ['delete', `/api/v1/backoffice/zones/${NIL}`],
      ['get', '/api/v1/backoffice/job-offers'],
      ['post', '/api/v1/backoffice/job-offers'],
      ['get', `/api/v1/backoffice/job-offers/${NIL}`],
      ['patch', `/api/v1/backoffice/job-offers/${NIL}`],
      ['delete', `/api/v1/backoffice/job-offers/${NIL}`],
    ] as const)('%s %s', async (method, url) => {
      await request(app.getHttpServer())[method](url).expect(401);
    });
  });

  describe('Zonas', () => {
    let zoneId: string;

    it('crea una zona', async () => {
      const res = await http().post('/api/v1/backoffice/zones').set(bearer(token)).send({ name: 'Campana', province: 'Buenos Aires', latitude: -34.165, longitude: -58.959 }).expect(201);
      zoneId = res.body.id;
      expect(res.body).toEqual(expect.objectContaining({ name: 'Campana', province: 'Buenos Aires', active: true }));
    });

    it('rechaza un nombre repetido (sin importar mayúsculas)', async () => {
      await http().post('/api/v1/backoffice/zones').set(bearer(token)).send({ name: 'campana', province: 'Buenos Aires', latitude: -34, longitude: -58 }).expect(409);
    });

    it.each([
      ['sin nombre', { name: '' }],
      ['latitud fuera de rango', { latitude: 100 }],
      ['longitud no numérica', { longitude: 'x' }],
      ['campo desconocido', { foo: 1 }],
    ])('valida: %s', async (_n, patch) => {
      await http().post('/api/v1/backoffice/zones').set(bearer(token)).send({ name: 'Otra', province: 'BA', latitude: -34, longitude: -58, ...patch }).expect(400);
    });

    it('lista todas, también las inactivas, y la pública oculta las inactivas', async () => {
      await http().patch(`/api/v1/backoffice/zones/${zoneId}`).set(bearer(token)).send({ active: false }).expect(200);
      const admin = await http().get('/api/v1/backoffice/zones').set(bearer(token)).expect(200);
      expect(admin.body.some((z: { id: string }) => z.id === zoneId)).toBe(true);
      const pub = await http().get('/api/v1/zones').expect(200);
      expect(pub.body.some((z: { id: string }) => z.id === zoneId)).toBe(false);
    });

    it('edita una zona', async () => {
      const res = await http().patch(`/api/v1/backoffice/zones/${zoneId}`).set(bearer(token)).send({ province: 'Bs. As.' }).expect(200);
      expect(res.body.province).toBe('Bs. As.');
    });

    it('no elimina una zona en uso, y sí una libre', async () => {
      const used = (await http().get('/api/v1/backoffice/zones').set(bearer(token))).body.find((z: { name: string }) => z.name === 'Monte Grande');
      const res = await http().delete(`/api/v1/backoffice/zones/${used.id}`).set(bearer(token)).expect(409);
      expect(res.body.message).toBe('La zona está en uso por ofertas o postulantes');
      await http().delete(`/api/v1/backoffice/zones/${zoneId}`).set(bearer(token)).expect(204);
      await http().delete(`/api/v1/backoffice/zones/${zoneId}`).set(bearer(token)).expect(404);
    });
  });

  describe('Ofertas', () => {
    let zoneId: string;
    let id: string;
    const offer = (zone: string) => ({
      code: 'NEW0001',
      title: 'Repositor/a nocturno',
      description: 'Reposición de góndolas en turno noche.',
      zoneId: zone,
      area: 'Comercial',
      schedule: 'Lunes a viernes · 22 a 6 h',
      requirements: ['Disponibilidad nocturna'],
      benefits: ['Plus nocturno'],
      vacancies: 2,
      salary: 900000,
      internal: { client: 'CLIENTE X', priority: 'ALTA' },
    });

    beforeAll(async () => {
      zoneId = (await http().get('/api/v1/zones')).body.find((z: { name: string }) => z.name === 'Pilar').id;
    });

    it('crea una oferta en borrador por defecto: no se ve en lo público', async () => {
      const res = await http().post('/api/v1/backoffice/job-offers').set(bearer(token)).send(offer(zoneId)).expect(201);
      id = res.body.id;
      expect(res.body).toEqual(expect.objectContaining({ code: 'NEW0001', status: 'draft', zone: { id: zoneId, name: 'Pilar' }, salary: 900000, internal: { client: 'CLIENTE X', priority: 'ALTA' } }));
      expect(res.body.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await http().get('/api/v1/job-offers/NEW0001').expect(404);
    });

    it('al publicarla aparece en lo público, sin la ficha interna', async () => {
      await http().patch(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).send({ status: 'published' }).expect(200);
      const pub = await http().get('/api/v1/job-offers/NEW0001').expect(200);
      expect(pub.body.title).toBe('Repositor/a nocturno');
      expect(JSON.stringify(pub.body)).not.toMatch(/CLIENTE X|900000/);
    });

    it('lista todas las ofertas con filtro por estado y búsqueda', async () => {
      const all = await http().get('/api/v1/backoffice/job-offers').set(bearer(token)).expect(200);
      expect(all.body.total).toBe(16);
      const drafts = await http().get('/api/v1/backoffice/job-offers').set(bearer(token)).query({ status: 'closed' }).expect(200);
      expect(drafts.body.total).toBe(0);
      const q = await http().get('/api/v1/backoffice/job-offers').set(bearer(token)).query({ q: 'nocturno' }).expect(200);
      expect(q.body.total).toBe(1);
      const inj = await http().get('/api/v1/backoffice/job-offers').set(bearer(token)).query({ q: "%' OR 1=1 --" }).expect(200);
      expect(inj.body.total).toBe(0);
    });

    it('devuelve el detalle completo', async () => {
      const res = await http().get(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).expect(200);
      expect(res.body.internal.client).toBe('CLIENTE X');
    });

    it('rechaza un código repetido', async () => {
      await http().post('/api/v1/backoffice/job-offers').set(bearer(token)).send(offer(zoneId)).expect(409);
    });

    it.each([
      ['sin título', { title: '' }],
      ['código con caracteres raros', { code: 'a b;c' }],
      ['zona inexistente', { zoneId: NIL }],
      ['vacantes cero', { vacancies: 0 }],
      ['estado inválido', { status: 'archivada' }],
      ['requisitos no es lista', { requirements: 'uno' }],
      ['demasiados requisitos', { requirements: Array.from({ length: 31 }, () => 'x') }],
      ['fecha inválida', { publishedAt: '31/12/2026' }],
      ['campo desconocido', { foo: 1 }],
    ])('valida: %s', async (_n, patch) => {
      await http().post('/api/v1/backoffice/job-offers').set(bearer(token)).send({ ...offer(zoneId), code: 'NEW0002', ...patch }).expect(400);
    });

    it('edita parcialmente y no deja repetir el código de otra', async () => {
      const res = await http().patch(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).send({ vacancies: 5, benefits: ['Plus nocturno', 'Comedor'] }).expect(200);
      expect(res.body.vacancies).toBe(5);
      expect(res.body.benefits).toHaveLength(2);
      await http().patch(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).send({ code: 'LOG7712093' }).expect(409);
    });

    it('cerrarla la saca de lo público', async () => {
      await http().patch(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).send({ status: 'closed' }).expect(200);
      await http().get('/api/v1/job-offers/NEW0001').expect(404);
    });

    it('elimina la oferta; 404 si ya no existe', async () => {
      await http().delete(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).expect(204);
      await http().get(`/api/v1/backoffice/job-offers/${id}`).set(bearer(token)).expect(404);
      await http().get('/api/v1/backoffice/job-offers/abc').set(bearer(token)).expect(400);
    });
  });
});
