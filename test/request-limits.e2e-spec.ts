import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';

describe('Límites de los pedidos (integración)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    ({ app } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('un cuerpo JSON de más de 100 kB se rechaza con 413 y el formato de error de siempre', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/candidates/validate')
      .send({ dni: 'x'.repeat(200_000) })
      .expect(413);
    expect(res.body).toEqual({
      statusCode: 413,
      error: 'Payload Too Large',
      message: expect.any(String),
      path: '/api/v1/candidates/validate',
      timestamp: expect.any(String),
    });
  });

  it('un cuerpo normal sigue pasando', async () => {
    await request(app.getHttpServer()).post('/api/v1/candidates/validate').send({ dni: '38412907' }).expect(200);
  });

  it('un JSON mal formado es un 400 con el formato de siempre, no un 500', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/candidates/validate')
      .set('Content-Type', 'application/json')
      .send('{"dni": ')
      .expect(400);
    expect(res.body).toEqual(expect.objectContaining({ statusCode: 400, error: 'Bad Request', path: '/api/v1/candidates/validate' }));
  });
});
