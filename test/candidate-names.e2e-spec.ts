import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

// Datos ficticios. Los CUIL tienen el dígito verificador bien calculado.
const lucia = {
  firstName: 'Lucía',
  lastName: 'Fernández',
  email: 'lucia@ejemplo.com',
  dni: '40.123.456',
  whatsapp: '11 4444-0101',
  cuil: '27-40123456-5',
};

describe('Nombre, apellido y CUIL del postulante (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());
  const candidate = (dni: string) => ds.getRepository(Candidate).findOneByOrFail({ dni });

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /applications (público)', () => {
    it('se postula con nombre y apellido separados y CUIL: se guardan por separado y el nombre completo se arma', async () => {
      await http()
        .post('/api/v1/applications')
        .send({ ...lucia, firstName: ' Lucía ', cuil: '27 40123456 5' })
        .expect(201);
      expect(await candidate('40123456')).toEqual(
        expect.objectContaining({
          firstName: 'Lucía',
          lastName: 'Fernández',
          fullName: 'Lucía Fernández',
          cuil: '27401234565',
        }),
      );
    });

    it('al reutilizar al postulante (mismo DNI y mail) actualiza nombre, apellido y CUIL', async () => {
      const martina = {
        fullName: 'Martina Rodríguez',
        email: 'martina@ejemplo.com',
        dni: '38.412.907',
        whatsapp: '11 5555-0142',
      };
      await http().post('/api/v1/applications').send(martina).expect(201);
      expect(await candidate('38412907')).toEqual(
        expect.objectContaining({ firstName: 'Martina', lastName: 'Rodríguez', cuil: null }),
      );

      await http()
        .post('/api/v1/applications')
        .send({
          ...martina,
          fullName: undefined,
          firstName: 'Martina Belén',
          lastName: 'Rodríguez',
          cuil: '27-38412907-8',
        })
        .expect(201);
      expect(await candidate('38412907')).toEqual(
        expect.objectContaining({
          firstName: 'Martina Belén',
          lastName: 'Rodríguez',
          fullName: 'Martina Belén Rodríguez',
          cuil: '27384129078',
        }),
      );
    });

    it('rechaza un CUIL que no coincide con el DNI y no registra nada', async () => {
      const res = await http()
        .post('/api/v1/applications')
        .send({ ...lucia, email: 'otra@ejemplo.com', dni: '41.222.333' })
        .expect(400);
      expect(res.body.message).toBe('El CUIL no coincide con el DNI.');
      expect(await ds.getRepository(Candidate).countBy({ dni: '41222333' })).toBe(0);
    });

    it.each([
      ['solo el nombre, sin apellido ni nombre completo', { lastName: undefined }],
      ['apellido con números', { lastName: 'Fernández 2' }],
      ['nombre vacío', { firstName: '  ' }],
      ['CUIL con dígito verificador incorrecto', { cuil: '27-41222333-0' }],
      ['CUIL de empresa', { cuil: '30-41222333-6' }],
    ])('valida: %s', async (_n, patch) => {
      await http()
        .post('/api/v1/applications')
        .send({ ...lucia, email: 'tomas@ejemplo.com', dni: '41.222.333', cuil: '20-41222333-1', ...patch })
        .expect(400);
    });

    it('un CUIL vacío es lo mismo que no mandarlo', async () => {
      await http()
        .post('/api/v1/applications')
        .send({
          ...lucia,
          firstName: 'Tomás',
          lastName: 'Acosta',
          email: 'tomas@ejemplo.com',
          dni: '41.222.333',
          cuil: '',
        })
        .expect(201);
      expect((await candidate('41222333')).cuil).toBeNull();
    });
  });

  describe('Backoffice /backoffice/candidates', () => {
    let id: string;

    it('crea con nombre, apellido y CUIL; devuelve el CUIL con guiones', async () => {
      const res = await http()
        .post('/api/v1/backoffice/candidates')
        .set(bearer(token))
        .send({
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@ejemplo.com',
          dni: '30.111.222',
          whatsapp: '11 4444-1111',
          cuil: '20301112220',
        })
        .expect(201);
      id = res.body.id;
      expect(res.body).toEqual(
        expect.objectContaining({
          firstName: 'Juan',
          lastName: 'Pérez',
          fullName: 'Juan Pérez',
          cuil: '20-30111222-0',
        }),
      );
    });

    it('con solo el nombre completo lo separa y deja el CUIL vacío', async () => {
      const res = await http()
        .post('/api/v1/backoffice/candidates')
        .set(bearer(token))
        .send({
          fullName: 'Ana María de la Torre',
          email: 'ana@ejemplo.com',
          dni: '41.222.444',
          whatsapp: '11 4444-2222',
        })
        .expect(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          firstName: 'Ana María',
          lastName: 'de la Torre',
          fullName: 'Ana María de la Torre',
          cuil: null,
        }),
      );
    });

    it('la lista y el detalle traen nombre, apellido y CUIL', async () => {
      const list = await http()
        .get('/api/v1/backoffice/candidates')
        .set(bearer(token))
        .query({ q: 'juan@' })
        .expect(200);
      // En el listado el CUIL va tapado (lleva el DNI adentro); el detalle lo trae completo.
      expect(list.body.items[0]).toEqual(
        expect.objectContaining({ firstName: 'Juan', lastName: 'Pérez', cuil: '**-****1222-*' }),
      );
      const detail = await http().get(`/api/v1/backoffice/candidates/${id}`).set(bearer(token)).expect(200);
      expect(detail.body).toEqual(
        expect.objectContaining({ firstName: 'Juan', lastName: 'Pérez', cuil: '20-30111222-0' }),
      );
    });

    it('editar solo el apellido rearma el nombre completo', async () => {
      const res = await http()
        .patch(`/api/v1/backoffice/candidates/${id}`)
        .set(bearer(token))
        .send({ lastName: 'Pérez Gómez' })
        .expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({ firstName: 'Juan', lastName: 'Pérez Gómez', fullName: 'Juan Pérez Gómez' }),
      );
    });

    it('un CUIL que no coincide con el DNI guardado no se acepta', async () => {
      const res = await http()
        .patch(`/api/v1/backoffice/candidates/${id}`)
        .set(bearer(token))
        .send({ cuil: '20-30111333-2' })
        .expect(400);
      expect(res.body.message).toBe('El CUIL no coincide con el DNI.');
    });

    it('cambia DNI y CUIL juntos, y el CUIL se borra con null', async () => {
      const both = await http()
        .patch(`/api/v1/backoffice/candidates/${id}`)
        .set(bearer(token))
        .send({ dni: '30.111.333', cuil: '20-30111333-2' })
        .expect(200);
      expect(both.body).toEqual(expect.objectContaining({ dni: '30111333', cuil: '20-30111333-2' }));
      const cleared = await http()
        .patch(`/api/v1/backoffice/candidates/${id}`)
        .set(bearer(token))
        .send({ cuil: null })
        .expect(200);
      expect(cleared.body.cuil).toBeNull();
    });

    it('la lista de postulaciones trae nombre, apellido y CUIL del postulante', async () => {
      const res = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
      const item = res.body.items.find((a: { candidate: { fullName: string } }) => a.candidate.fullName === 'Lucía Fernández');
      // DNI y CUIL tapados en el listado de postulaciones.
      expect(item.candidate).toEqual(
        expect.objectContaining({
          fullName: 'Lucía Fernández',
          firstName: 'Lucía',
          lastName: 'Fernández',
          dni: '****3456',
          cuil: '**-****3456-*',
        }),
      );
    });
  });

  describe('POST /candidates/validate', () => {
    it('valida nombre, apellido y CUIL; el CUIL vuelve normalizado y con guiones', async () => {
      const res = await http()
        .post('/api/v1/candidates/validate')
        .send({ firstName: 'Lucía', lastName: 'Fernández', cuil: '27 40123456 5', dni: '40.123.456' })
        .expect(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.fields.firstName).toEqual({ valid: true });
      expect(res.body.fields.lastName).toEqual({ valid: true });
      expect(res.body.fields.cuil).toEqual({
        valid: true,
        normalized: '27401234565',
        formatted: '27-40123456-5',
      });
    });

    it('marca qué falla y por qué', async () => {
      const res = await http()
        .post('/api/v1/candidates/validate')
        .send({ firstName: ' ', lastName: 'Pérez 2', cuil: '27-40123456-3' })
        .expect(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.fields.firstName).toEqual({
        valid: false,
        code: 'required',
        message: 'Ingresá tu nombre',
      });
      expect(res.body.fields.lastName).toEqual({
        valid: false,
        code: 'invalidChars',
        message: 'El apellido solo puede tener letras, espacios, apóstrofos y guiones',
      });
      expect(res.body.fields.cuil).toEqual(expect.objectContaining({ valid: false, code: 'invalid' }));
      expect(res.body.fields.cuil.normalized).toBeUndefined();
    });

    it('avisa si el CUIL no coincide con el DNI', async () => {
      const res = await http()
        .post('/api/v1/candidates/validate')
        .send({ cuil: '27-40123456-5', dni: '41.222.333' })
        .expect(200);
      expect(res.body.fields.dni.valid).toBe(true);
      expect(res.body.fields.cuil).toEqual({
        valid: false,
        code: 'dniMismatch',
        message: 'El CUIL no coincide con el DNI.',
      });
    });
  });
});
