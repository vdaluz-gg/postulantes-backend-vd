import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { adminToken, bearer } from './utils/admin';
import { coreApplicationFields, field, siteConfig } from './utils/site-config';
import { createTestApp } from './utils/test-app';

describe('Configuración de los portales (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());
  const base = '/api/v1/backoffice/site-config';

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['get', base],
    ['put', base],
    ['post', `${base}/publish`],
  ] as const)('%s %s exige sesión de administrador', async (method, url) => {
    await http()[method](url).expect(401);
  });

  it('sin nada guardado, el backoffice y los portales reciben 404 (el front arranca con su configuración inicial)', async () => {
    const res = await http().get(base).set(bearer(token)).expect(404);
    expect(res.body.message).toBe('Todavía no hay configuración guardada');
    await http().get('/api/v1/site-config/postulantes').expect(404);
  });

  it('guarda un borrador con versión, fecha y autor del servidor; los portales todavía no lo ven', async () => {
    const draft = siteConfig([...coreApplicationFields(), field('middleName', 'Segundo nombre')]);
    const res = await http()
      .put(base)
      .set(bearer(token))
      .send({ ...draft, updatedBy: 'Otra persona', updatedAt: '2000-01-01T00:00:00.000Z' })
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({ version: 2, status: 'draft', updatedBy: 'Tester Admin' }));
    expect(Date.parse(res.body.updatedAt)).toBeGreaterThan(Date.parse('2026-01-01'));
    expect(res.body.audiences.postulantes.sections[0].fields).toHaveLength(7);

    expect((await http().get(base).set(bearer(token)).expect(200)).body.version).toBe(2);
    await http().get('/api/v1/site-config/postulantes').expect(404);
  });

  it('no pisa los cambios de otra persona: la versión tiene que ser la última', async () => {
    const res = await http().put(base).set(bearer(token)).send(siteConfig(coreApplicationFields(), 1)).expect(409);
    expect(res.body.message).toBe('Otra persona guardó cambios mientras editabas. Recargá para ver la última versión.');
  });

  it('publica: desde ese momento el portal ve la configuración de su público', async () => {
    const config = siteConfig([...coreApplicationFields(), field('middleName', 'Segundo nombre', 'text', { placeholder: 'Si tenés' })], 2);
    const res = await http().post(`${base}/publish`).set(bearer(token)).send(config).expect(200);
    expect(res.body).toEqual(expect.objectContaining({ version: 3, status: 'published' }));

    const pub = await http().get('/api/v1/site-config/postulantes').expect(200);
    expect(pub.body.audience).toBe('postulantes');
    expect(pub.body.sections[0].fields.map((f: { id: string }) => f.id)).toContain('middleName');
    expect(pub.body.copy[0].value).toBe('El trabajo de la Argentina, en movimiento.');
    await http().get('/api/v1/site-config/clientes').expect(200);
  });

  it('un borrador nuevo no cambia lo publicado', async () => {
    await http().put(base).set(bearer(token)).send(siteConfig(coreApplicationFields(), 3)).expect(200);
    const pub = await http().get('/api/v1/site-config/postulantes').expect(200);
    expect(pub.body.sections[0].fields.map((f: { id: string }) => f.id)).toContain('middleName');
    expect((await http().get(base).set(bearer(token)).expect(200)).body).toEqual(expect.objectContaining({ version: 4, status: 'draft' }));
  });

  it.each([
    ['sin público', { version: 4, audiences: {} }, 'La configuración está incompleta: falta «postulantes».'],
    ['sin DNI visible', siteConfig(coreApplicationFields().map((f) => (f.id === 'dni' ? { ...f, visible: false } : f)), 4), '«DNI» lo necesita el sistema para registrar la postulación: dejalo visible y obligatorio.'],
  ])('rechaza una configuración inválida: %s', async (_n, body, message) => {
    const res = await http().put(base).set(bearer(token)).send(body).expect(400);
    expect(res.body.message).toBe(message);
  });

  it.each([
    ['versión no numérica', { version: 'x', audiences: {} }],
    ['campo desconocido', { ...siteConfig(coreApplicationFields(), 4), foo: 1 }],
  ])('valida el cuerpo: %s', async (_n, body) => {
    await http().put(base).set(bearer(token)).send(body).expect(400);
  });

  it('un público que no existe da 404', async () => {
    await http().get('/api/v1/site-config/proveedores').expect(404);
  });
});
