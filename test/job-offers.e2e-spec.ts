import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { JobOffer } from '../src/modules/job-offers/entities/job-offer.entity';
import { createTestApp } from './utils/test-app';

const PUBLIC_KEYS = ['area', 'benefits', 'description', 'publishedOn', 'ref', 'requirements', 'schedule', 'title', 'zone'];

describe('Zonas y ofertas públicas (integración)', () => {
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

  describe('GET /zones', () => {
    it('lista las zonas activas con sus coordenadas', async () => {
      const res = await http().get('/api/v1/zones').expect(200);
      expect(res.body).toHaveLength(14);
      expect(res.body[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), name: expect.any(String), province: expect.any(String), latitude: expect.any(Number), longitude: expect.any(Number) }),
      );
    });
  });

  describe('GET /job-offers', () => {
    it('devuelve solo la publicación (sin salario, cliente ni ficha interna)', async () => {
      const res = await http().get('/api/v1/job-offers').expect(200);
      expect(res.body).toEqual(expect.objectContaining({ total: 15, page: 1, limit: 20, matched: true, query: '' }));
      expect(res.body.items).toHaveLength(15);
      for (const item of res.body.items) expect(Object.keys(item).sort()).toEqual(PUBLIC_KEYS);
      expect(JSON.stringify(res.body)).not.toMatch(/BANK SA|GESTION INTEGRAL|CCT \d+|salary|912359|"internal"|managingCompany/);
    });

    it('ordena por publicación más reciente por defecto', async () => {
      const res = await http().get('/api/v1/job-offers').expect(200);
      expect(res.body.items[0].ref).toBe('CSYP1233113446');
    });

    it('busca por texto libre con el mismo criterio que el front', async () => {
      const res = await http().get('/api/v1/job-offers').query({ q: 'chofer camión' }).expect(200);
      expect(res.body.matched).toBe(true);
      expect(res.body.items[0].ref).toBe('LOG7712093');
    });

    it('si nada coincide devuelve todas con matched=false', async () => {
      const res = await http().get('/api/v1/job-offers').query({ q: 'astronauta' }).expect(200);
      expect(res.body.matched).toBe(false);
      expect(res.body.total).toBe(15);
    });

    it('filtra por rubro (chip)', async () => {
      const res = await http().get('/api/v1/job-offers').query({ area: 'Logística' }).expect(200);
      expect(res.body.total).toBe(4);
      expect(res.body.items.every((o: { area: string }) => o.area === 'Logística')).toBe(true);
    });

    it('filtra por zona (chip)', async () => {
      const zones = (await http().get('/api/v1/zones')).body as { id: string; name: string }[];
      const monteGrande = zones.find((z) => z.name === 'Monte Grande')!;
      const res = await http().get('/api/v1/job-offers').query({ zone: monteGrande.id }).expect(200);
      expect(res.body.items.map((o: { ref: string }) => o.ref).sort()).toEqual(['IND3307418', 'LOG8803174']);
    });

    it('combina búsqueda y filtros', async () => {
      const res = await http().get('/api/v1/job-offers').query({ q: 'operario', area: 'Industria' }).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((o: { area: string }) => o.area === 'Industria')).toBe(true);
    });

    it('pagina', async () => {
      const res = await http().get('/api/v1/job-offers').query({ page: 2, limit: 5 }).expect(200);
      expect(res.body).toEqual(expect.objectContaining({ page: 2, limit: 5, total: 15 }));
      expect(res.body.items).toHaveLength(5);
    });

    it('con ubicación agrega la distancia y ordena por cercanía', async () => {
      const res = await http().get('/api/v1/job-offers').query({ lat: -34.815, lng: -58.469, sort: 'nearest' }).expect(200);
      const d = res.body.items.map((o: { distanceKm: number }) => o.distanceKm);
      expect(d[0]).toBeCloseTo(0, 1);
      expect([...d].sort((a, b) => a - b)).toEqual(d);
    });

    it.each([
      [{ page: 0 }],
      [{ limit: 1000 }],
      [{ limit: 'abc' }],
      [{ sort: 'raro' }],
      [{ lat: -34 }],
      [{ lat: 999, lng: 0 }],
      [{ inexistente: 'x' }],
    ])('rechaza parámetros inválidos %j', async (query) => {
      await http().get('/api/v1/job-offers').query(query).expect(400);
    });

    it('es seguro ante intentos de inyección en la búsqueda', async () => {
      const res = await http().get('/api/v1/job-offers').query({ q: "'; DROP TABLE job_offers; --", area: "x' OR '1'='1" }).expect(200);
      expect(res.body.total).toBe(0);
      expect(await ds.getRepository(JobOffer).count()).toBe(15);
    });
  });

  describe('GET /job-offers/nearby', () => {
    it('devuelve las ofertas dentro del radio, de la más cercana a la más lejana', async () => {
      const res = await http().get('/api/v1/job-offers/nearby').query({ lat: -34.815, lng: -58.469, radiusKm: 10 }).expect(200);
      const refs = res.body.items.map((o: { ref: string }) => o.ref).sort();
      expect(refs).toEqual(['IND3307418', 'IND6045512', 'LOG8803174']);
      const d = res.body.items.map((o: { distanceKm: number }) => o.distanceKm);
      expect([...d].sort((a, b) => a - b)).toEqual(d);
      expect(res.body.items.at(-1).ref).toBe('IND6045512');
    });

    it('usa 30 km de radio por defecto', async () => {
      const res = await http().get('/api/v1/job-offers/nearby').query({ lat: -34.6037, lng: -58.3816 }).expect(200);
      expect(res.body.items.length).toBeGreaterThan(3);
      expect(res.body.items.every((o: { distanceKm: number }) => o.distanceKm <= 30)).toBe(true);
    });

    it('lejos de todo no devuelve nada', async () => {
      const res = await http().get('/api/v1/job-offers/nearby').query({ lat: -54.8, lng: -68.3 }).expect(200);
      expect(res.body.items).toEqual([]);
    });

    it.each([[{}], [{ lat: -34 }], [{ lat: 'x', lng: 'y' }], [{ lat: 95, lng: 0 }], [{ lat: -34, lng: -58, radiusKm: 0 }], [{ lat: -34, lng: -58, radiusKm: 1000 }]])(
      'exige coordenadas y radio válidos %j',
      async (query) => {
        await http().get('/api/v1/job-offers/nearby').query(query).expect(400);
      },
    );
  });

  describe('GET /job-offers/filters', () => {
    it('devuelve los rubros y zonas para armar los chips', async () => {
      const res = await http().get('/api/v1/job-offers/filters').expect(200);
      expect(res.body.areas).toEqual(['Administración', 'Comercial', 'Industria', 'Logística', 'RR. HH.']);
      expect(res.body.zones).toHaveLength(14);
      expect(res.body.zones[0]).toEqual({ id: expect.any(String), name: expect.any(String) });
    });
  });

  describe('GET /job-offers/:code', () => {
    it('devuelve la ficha pública de una oferta', async () => {
      const res = await http().get('/api/v1/job-offers/LOG7712093').expect(200);
      expect(Object.keys(res.body).sort()).toEqual(PUBLIC_KEYS);
      expect(res.body.title).toBe('Chofer de camión chasis');
    });

    it('404 si no existe', async () => {
      const res = await http().get('/api/v1/job-offers/NOEXISTE').expect(404);
      expect(res.body.message).toBe('Oferta no encontrada');
    });

    it('las ofertas cerradas o en borrador no se ven', async () => {
      await ds.getRepository(JobOffer).update({ code: 'COM6070245' }, { status: 'closed' });
      await http().get('/api/v1/job-offers/COM6070245').expect(404);
      const res = await http().get('/api/v1/job-offers').expect(200);
      expect(res.body.total).toBe(14);
      await ds.getRepository(JobOffer).update({ code: 'COM6070245' }, { status: 'published' });
    });
  });
});
