import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Consent } from '../src/modules/consents/entities/consent.entity';
import { createTestApp } from './utils/test-app';

describe('Permisos de voz, imagen y ubicación (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const http = () => request(app.getHttpServer());
  const sessionId = 'sesion-abc-12345';

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('registra lo que la persona aceptó y lo que rechazó', async () => {
    const res = await http()
      .post('/api/v1/consents')
      .set('User-Agent', 'Mozilla/5.0 (prueba)')
      .send({ sessionId, decisions: [{ type: 'voice', granted: true }, { type: 'camera', granted: false }, { type: 'location', granted: true }] })
      .expect(201);
    expect(res.body).toEqual({ recorded: 3 });
    const rows = await ds.getRepository(Consent).findBy({ sessionId });
    expect(rows.map((r) => [r.type, r.granted]).sort()).toEqual([['camera', false], ['location', true], ['voice', true]]);
    expect(rows[0].userAgent).toBe('Mozilla/5.0 (prueba)');
    expect(rows[0].candidateId).toBeNull();
  });

  it('guarda cada decisión nueva como un registro más (queda el historial)', async () => {
    await http().post('/api/v1/consents').send({ sessionId, decisions: [{ type: 'camera', granted: true }] }).expect(201);
    expect(await ds.getRepository(Consent).countBy({ sessionId, type: 'camera' })).toBe(2);
  });

  it.each([
    ['sin sesión', { decisions: [{ type: 'voice', granted: true }] }],
    ['sesión demasiado corta', { sessionId: 'abc', decisions: [{ type: 'voice', granted: true }] }],
    ['sesión con caracteres raros', { sessionId: "x'; DROP--  12345", decisions: [{ type: 'voice', granted: true }] }],
    ['sin decisiones', { sessionId, decisions: [] }],
    ['permiso desconocido', { sessionId, decisions: [{ type: 'contactos', granted: true }] }],
    ['granted no booleano', { sessionId, decisions: [{ type: 'voice', granted: 'si' }] }],
    ['permiso repetido', { sessionId, decisions: [{ type: 'voice', granted: true }, { type: 'voice', granted: false }] }],
    ['más de 3 decisiones', { sessionId, decisions: Array.from({ length: 4 }, () => ({ type: 'voice', granted: true })) }],
    ['campos extra', { sessionId, decisions: [{ type: 'voice', granted: true, extra: 1 }] }],
  ])('rechaza: %s', async (_n, body) => {
    await http().post('/api/v1/consents').send(body).expect(400);
  });
});
