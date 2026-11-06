import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Application } from '../src/modules/applications/entities/application.entity';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { adminToken, bearer } from './utils/admin';
import { coreApplicationFields, field, siteConfig } from './utils/site-config';
import { createTestApp } from './utils/test-app';

const contact = { fullName: 'Lucía Fernández', email: 'lucia@ejemplo.com', dni: '40.123.456', whatsapp: '11 4444-0101' };

describe('Postulación con campos agregados desde el backoffice (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it('sin configuración publicada, ignora respuestas que no corresponden y registra la postulación', async () => {
    await http().post('/api/v1/applications').send({ ...contact, answers: { inventado: 'x' } }).expect(201);
    const app1 = await ds.getRepository(Application).findOneByOrFail({ candidate: { dni: '40123456' } });
    expect(app1.answers).toEqual([]);
  });

  describe('con un campo nuevo publicado', () => {
    beforeAll(async () => {
      const fields = [
        ...coreApplicationFields(),
        field('middleName', 'Segundo nombre', 'text', { required: true }),
        field('shift', 'Turno', 'select', { options: [{ value: 'manana', label: 'Mañana' }, { value: 'tarde', label: 'Tarde' }] }),
      ];
      await http().post('/api/v1/backoffice/site-config/publish').set(bearer(token)).send(siteConfig(fields)).expect(200);
    });

    it('exige los obligatorios antes de registrar nada', async () => {
      const before = await ds.getRepository(Candidate).count();
      const res = await http().post('/api/v1/applications').send({ ...contact, dni: '40.123.457', email: 'otra@ejemplo.com' }).expect(400);
      expect(res.body.message).toBe('Completá «Segundo nombre».');
      expect(await ds.getRepository(Candidate).count()).toBe(before);
    });

    it('rechaza una opción que no existe', async () => {
      const res = await http()
        .post('/api/v1/applications')
        .send({ ...contact, answers: { middleName: 'Sofía', shift: 'noche' } })
        .expect(400);
      expect(res.body.message).toBe('Revisá «Turno».');
    });

    it('guarda las respuestas con su etiqueta y el backoffice las ve en el detalle', async () => {
      const res = await http()
        .post('/api/v1/applications')
        .send({ ...contact, answers: { middleName: ' Sofía ', shift: 'tarde' } })
        .expect(201);
      const saved = await ds.getRepository(Application).findOneByOrFail({ trackingCode: res.body.trackingCode });
      expect(saved.answers).toEqual([
        { id: 'middleName', label: 'Segundo nombre', value: 'Sofía' },
        { id: 'shift', label: 'Turno', value: 'tarde' },
      ]);
      const detail = await http().get(`/api/v1/backoffice/applications/${saved.id}`).set(bearer(token)).expect(200);
      expect(detail.body.answers).toEqual(saved.answers);
    });

    it.each([
      ['respuestas que no son un objeto', 'x'],
      ['una lista', ['a']],
    ])('valida el cuerpo: %s', async (_n, answers) => {
      await http().post('/api/v1/applications').send({ ...contact, answers }).expect(400);
    });
  });
});
