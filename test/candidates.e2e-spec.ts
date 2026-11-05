import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Zone } from '../src/modules/zones/entities/zone.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const base = {
  fullName: 'Martina Rodríguez',
  email: 'Martina.R@Ejemplo.com',
  dni: '38.412.907',
  whatsapp: '11 5555-0142',
  position: 'Operario/a de producción',
};

describe('Postulantes (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let zoneId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
    zoneId = (await ds.getRepository(Zone).findOneByOrFail({ name: 'Monte Grande' })).id;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /candidates/validate (público)', () => {
    it('valida cada campo por separado y devuelve el valor normalizado', async () => {
      const res = await http().post('/api/v1/candidates/validate').send({ ...base, zoneId }).expect(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.fields.fullName).toEqual({ valid: true });
      expect(res.body.fields.email).toEqual({ valid: true, normalized: 'martina.r@ejemplo.com' });
      expect(res.body.fields.dni).toEqual({ valid: true, normalized: '38412907', formatted: '38.412.907' });
      expect(res.body.fields.whatsapp).toEqual({ valid: true, normalized: '+5491155550142' });
      expect(res.body.fields.zoneId).toEqual({ valid: true });
      expect(res.body.fields.position).toEqual({ valid: true });
    });

    it('marca qué campo falla y por qué, con mensaje para mostrar', async () => {
      const res = await http()
        .post('/api/v1/candidates/validate')
        .send({ fullName: 'Martina', email: 'martina@', dni: '123', whatsapp: '555', zoneId: '8d6c5f6e-0000-4000-8000-000000000000', position: '  ' })
        .expect(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.fields.fullName).toEqual({ valid: false, code: 'missingLastName', message: 'Ingresá tu nombre y apellido' });
      expect(res.body.fields.email).toEqual({ valid: false, code: 'invalid', message: 'Revisá el mail: parece incompleto' });
      expect(res.body.fields.dni).toEqual({ valid: false, code: 'invalid', message: 'El DNI debe tener 7 u 8 números' });
      expect(res.body.fields.whatsapp).toEqual({ valid: false, code: 'invalid', message: 'Ingresá tu celular con código de área, por ejemplo 11 5555-0142' });
      expect(res.body.fields.zoneId).toEqual({ valid: false, code: 'unknownZone', message: 'Elegí una zona de la lista' });
      expect(res.body.fields.position).toEqual({ valid: false, code: 'required', message: 'Indicá el puesto que buscás' });
    });

    it('evalúa solo los campos enviados (para validar mientras se completa el formulario)', async () => {
      const res = await http().post('/api/v1/candidates/validate').send({ dni: '38412907' }).expect(200);
      expect(Object.keys(res.body.fields)).toEqual(['dni']);
      expect(res.body.valid).toBe(true);
    });

    it('rechaza un cuerpo vacío o con campos desconocidos', async () => {
      await http().post('/api/v1/candidates/validate').send({}).expect(400);
      await http().post('/api/v1/candidates/validate').send({ dni: '38412907', admin: true }).expect(400);
    });

    it('no guarda nada', async () => {
      const res = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).expect(200);
      expect(res.body.total).toBe(0);
    });
  });

  describe('Backoffice /backoffice/candidates', () => {
    it.each([
      ['get', '/api/v1/backoffice/candidates'],
      ['post', '/api/v1/backoffice/candidates'],
      ['get', '/api/v1/backoffice/candidates/8d6c5f6e-0000-4000-8000-000000000000'],
      ['patch', '/api/v1/backoffice/candidates/8d6c5f6e-0000-4000-8000-000000000000'],
      ['delete', '/api/v1/backoffice/candidates/8d6c5f6e-0000-4000-8000-000000000000'],
    ] as const)('%s %s exige sesión de administrador', async (method, url) => {
      await request(app.getHttpServer())[method](url).expect(401);
    });

    let id: string;

    it('crea un postulante normalizando los datos', async () => {
      const res = await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...base, zoneId }).expect(201);
      id = res.body.id;
      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          fullName: 'Martina Rodríguez',
          email: 'martina.r@ejemplo.com',
          dni: '38412907',
          whatsapp: '+5491155550142',
          position: 'Operario/a de producción',
          zone: { id: zoneId, name: 'Monte Grande' },
          source: 'backoffice',
          identityStatus: 'unverified',
          whatsappOptIn: false,
        }),
      );
    });

    it('rechaza un DNI repetido', async () => {
      const res = await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...base, email: 'otra@x.com', dni: '38412907' }).expect(409);
      expect(res.body.message).toBe('Ya existe un postulante con ese DNI');
    });

    it.each([
      ['nombre sin apellido', { fullName: 'Martina' }],
      ['nombre con números', { fullName: 'Martina 3 Pérez' }],
      ['mail inválido', { email: 'x@' }],
      ['DNI corto', { dni: '123' }],
      ['DNI con letras', { dni: '38A12907' }],
      ['WhatsApp inválido', { whatsapp: '1234' }],
      ['zona inexistente', { zoneId: '8d6c5f6e-0000-4000-8000-000000000000' }],
      ['zona que no es UUID', { zoneId: 'abc' }],
      ['solo latitud', { latitude: -34.8 }],
      ['latitud fuera de rango', { latitude: 120, longitude: 0 }],
      ['campo no permitido', { identityStatus: 'verified' }],
    ])('valida: %s', async (_n, patch) => {
      await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...base, dni: '20123456', email: 'v@x.com', ...patch }).expect(400);
    });

    it('lista con paginación y sin datos internos extra', async () => {
      await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...base, fullName: 'Juan Pérez', email: 'juan@x.com', dni: '30111222', whatsapp: '11 4444-1111' }).expect(201);
      const res = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ limit: 1, page: 2 }).expect(200);
      expect(res.body).toEqual(expect.objectContaining({ total: 2, page: 2, limit: 1 }));
      expect(res.body.items).toHaveLength(1);
    });

    it('busca por nombre, mail, DNI o WhatsApp', async () => {
      const by = async (q: string) => (await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ q }).expect(200)).body.total;
      expect(await by('martina')).toBe(1);
      expect(await by('juan@x')).toBe(1);
      expect(await by('30.111.222')).toBe(1);
      expect(await by('4444-1111')).toBe(1);
      expect(await by('inexistente')).toBe(0);
    });

    it('los comodines y la inyección se buscan como texto literal', async () => {
      const by = async (q: string) => (await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ q }).expect(200)).body.total;
      expect(await by('%')).toBe(0);
      expect(await by('_')).toBe(0);
      expect(await by("'; DROP TABLE candidates; --")).toBe(0);
      expect((await http().get('/api/v1/backoffice/candidates').set(bearer(token))).body.total).toBe(2);
    });

    it('filtra por zona y por estado de identidad', async () => {
      const z = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ zoneId }).expect(200);
      expect(z.body.total).toBe(1);
      const v = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ identityStatus: 'verified' }).expect(200);
      expect(v.body.total).toBe(0);
      await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ identityStatus: 'raro' }).expect(400);
    });

    it('devuelve el detalle con sus postulaciones y CV', async () => {
      const res = await http().get(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).expect(200);
      expect(res.body.id).toBe(id);
      expect(res.body.applications).toEqual([]);
      expect(res.body.cvDocuments).toEqual([]);
    });

    it('404 si no existe y 400 si el id no es UUID', async () => {
      const res = await http().get('/api/v1/backoffice/candidates/8d6c5f6e-0000-4000-8000-000000000000').set(bearer(token)).expect(404);
      expect(res.body.message).toBe('Postulante no encontrado');
      await http().get('/api/v1/backoffice/candidates/abc').set(bearer(token)).expect(400);
    });

    it('edita parcialmente y re-normaliza', async () => {
      const res = await http().patch(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).send({ whatsapp: '+54 9 11 6666-7777', position: 'Chofer' }).expect(200);
      expect(res.body.whatsapp).toBe('+5491166667777');
      expect(res.body.position).toBe('Chofer');
      expect(res.body.fullName).toBe('Martina Rodríguez');
    });

    it('no permite editar el DNI a uno que ya tiene otra persona', async () => {
      await http().patch(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).send({ dni: '30.111.222' }).expect(409);
    });

    it('permite quitar la zona con null', async () => {
      const res = await http().patch(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).send({ zoneId: null }).expect(200);
      expect(res.body.zone).toBeNull();
    });

    it('elimina y después ya no existe', async () => {
      await http().delete(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).expect(204);
      await http().get(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).expect(404);
      await http().delete(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).expect(404);
    });
  });
});
