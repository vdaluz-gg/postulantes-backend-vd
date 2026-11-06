import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const contact = { fullName: 'Martina Rodríguez', email: 'martina@ejemplo.com', dni: '38.412.907', whatsapp: '11 5555-0142' };

describe('Canal de origen del postulante (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
  });
  afterAll(async () => {
    await app.close();
  });

  it('por defecto la postulación pública entra por la nueva web', async () => {
    await http().post('/api/v1/applications').send(contact).expect(201);
    expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).channel).toBe('new_web');
  });

  it('el check-in (webapp) es un canal público válido', async () => {
    await http().post('/api/v1/applications').send({ ...contact, dni: '30111222', email: 'a@x.com', channel: 'checkin' }).expect(201);
    expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111222' })).channel).toBe('checkin');
  });

  it('los canales internos no se pueden declarar desde la API pública', async () => {
    for (const channel of ['job_board', 'social', 'cdc', 'backoffice', 'inventado']) {
      await http().post('/api/v1/applications').send({ ...contact, dni: '30111333', email: 'b@x.com', channel }).expect(400);
    }
  });

  it('quien vuelve a postularse conserva su canal original', async () => {
    await http().post('/api/v1/applications').send({ ...contact, offerCode: 'IND3307418', channel: 'checkin' }).expect(201);
    expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).channel).toBe('new_web');
  });

  it('el backoffice carga postulantes de portales de empleo, redes o CDC', async () => {
    const res = await http()
      .post('/api/v1/backoffice/candidates')
      .set(bearer(token))
      .send({ ...contact, dni: '30222333', email: 'c@x.com', channel: 'job_board' })
      .expect(201);
    expect(res.body.channel).toBe('job_board');
    const byDefault = await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...contact, dni: '30222444', email: 'd@x.com' }).expect(201);
    expect(byDefault.body.channel).toBe('backoffice');
    await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send({ ...contact, dni: '30222555', email: 'e@x.com', channel: 'inventado' }).expect(400);
  });

  it('el canal no se cambia después del alta', async () => {
    const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '30222333' });
    await http().patch(`/api/v1/backoffice/candidates/${c.id}`).set(bearer(token)).send({ channel: 'social' }).expect(400);
  });

  it('se puede filtrar el listado por canal', async () => {
    const res = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ channel: 'job_board' }).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toEqual(expect.objectContaining({ channel: 'job_board', profileStage: 'applicant', employeeNumber: null }));
    await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ channel: 'raro' }).expect(400);
  });
});
