import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Cabeceras de seguridad (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('las respuestas no se cachean y la API no dice con qué está hecha', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/zones').expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('apaga cámara, micrófono y ubicación a nivel de la API', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('HSTS por 180 días y sin includeSubDomains', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.headers['strict-transport-security']).toBe('max-age=15552000');
  });

  it('las respuestas de error tampoco se cachean', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/backoffice/candidates').expect(401);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('por defecto (local) no redirige a https: se puede probar por http', async () => {
    await request(app.getHttpServer()).get('/api/v1/zones').expect(200);
  });
});

describe('HTTPS forzado detrás de un proxy (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TRUST_PROXY = '1';
    process.env.FORCE_HTTPS = 'true';
    try {
      ({ app } = await createTestApp());
    } finally {
      delete process.env.TRUST_PROXY;
      delete process.env.FORCE_HTTPS;
    }
  });
  afterAll(async () => {
    await app.close();
  });

  it('redirige lo que llegó por http (según X-Forwarded-Proto)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/zones?x=1').set('X-Forwarded-Proto', 'http').set('Host', 'api.ejemplo.com');
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe('https://api.ejemplo.com/api/v1/zones?x=1');
  });

  it('deja pasar lo que el proxy recibió por https', async () => {
    await request(app.getHttpServer()).get('/api/v1/zones').set('X-Forwarded-Proto', 'https').expect(200);
  });

  it('el chequeo de salud responde por http', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').set('X-Forwarded-Proto', 'http').expect(200);
  });
});
