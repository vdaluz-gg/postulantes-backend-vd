import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Salud y formato de errores (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde ok y chequea la base', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('una ruta inexistente devuelve el formato único de error', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nada').expect(404);
    expect(res.body).toEqual(
      expect.objectContaining({ statusCode: 404, error: 'Not Found', path: '/api/v1/nada', timestamp: expect.any(String) }),
    );
  });

  it('agrega cabeceras de seguridad (helmet)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
