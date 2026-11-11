import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { seedReferenceData } from '../src/database/seed/seed';
import { MOCK_CAPTCHA_TOKEN } from '../src/modules/captcha/captcha-verifier.factory';
import { createTestApp } from './utils/test-app';

const pdf = () => Buffer.from('%PDF-1.4\nCV de prueba\n%%EOF');
const person = { fullName: 'Martina Rodríguez', email: 'martina@ejemplo.com', dni: '38412907', whatsapp: '11 5555-0142' };

describe('Captcha apagado (integración)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    ({ app } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('por defecto (local) nada pide captcha: postularse y subir el CV funcionan como siempre', async () => {
    await request(app.getHttpServer()).post('/api/v1/applications').send(person).expect(201);
    await request(app.getHttpServer()).post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(201);
  });
});

describe('Captcha encendido (integración)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.CAPTCHA_ENABLED = 'true';
    process.env.CAPTCHA_SECRET = 'clave-del-proveedor-de-prueba';
    try {
      let dataSource;
      ({ app, dataSource } = await createTestApp());
      await seedReferenceData(dataSource);
    } finally {
      delete process.env.CAPTCHA_ENABLED;
      delete process.env.CAPTCHA_SECRET;
    }
  });
  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('postularse sin token es un 400', async () => {
    const res = await http().post('/api/v1/applications').send(person).expect(400);
    expect(res.body.message).toBe('Falta la verificación anti-robots');
  });

  it('subir un CV sin token es un 400', async () => {
    await http().post('/api/v1/cv').attach('file', pdf(), { filename: 'cv.pdf' }).expect(400);
  });

  it('un token que el proveedor rechaza es un 403', async () => {
    const res = await http().post('/api/v1/applications').set('X-Captcha-Token', 'inventado').send(person).expect(403);
    expect(res.body.message).toBe('No pudimos verificar que no sos un robot');
  });

  it('con un token válido se postula y se sube el CV', async () => {
    await http().post('/api/v1/applications').set('X-Captcha-Token', MOCK_CAPTCHA_TOKEN).send(person).expect(201);
    await http().post('/api/v1/cv').set('X-Captcha-Token', MOCK_CAPTCHA_TOKEN).attach('file', pdf(), { filename: 'cv.pdf' }).expect(201);
  });

  it('el resto de las rutas públicas no piden captcha (ofertas, validación, permisos, seguimiento, salud)', async () => {
    await http().get('/api/v1/health').expect(200);
    await http().get('/api/v1/zones').expect(200);
    await http().get('/api/v1/job-offers').expect(200);
    await http().post('/api/v1/candidates/validate').send({ dni: '38412907' }).expect(200);
    await http().post('/api/v1/consents').send({ sessionId: 'sesion-navegador-123', decisions: [{ type: 'location', granted: true }] }).expect(201);
  });

  it('las rutas del backoffice siguen usando solo la sesión de administrador', async () => {
    await http().get('/api/v1/backoffice/candidates').expect(401);
  });
});
