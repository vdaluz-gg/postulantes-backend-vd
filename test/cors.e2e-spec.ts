import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

const ALLOWED = 'http://localhost:4200';

describe('CORS (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  const preflight = (origin: string) =>
    request(app.getHttpServer())
      .options('/api/v1/applications')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

  it('deja pasar al front de la lista blanca', async () => {
    const res = await preflight(ALLOWED);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('no manda Access-Control-Allow-Credentials: la sesión viaja en el header Authorization, no en cookies', async () => {
    const res = await preflight(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    const real = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', ALLOWED);
    expect(real.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('no autoriza a un origen que no está en la lista', async () => {
    const res = await preflight('https://sitio-malicioso.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
