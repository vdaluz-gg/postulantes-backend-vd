import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const person = {
  fullName: 'Martina Rodríguez',
  email: 'martina@ejemplo.com',
  dni: '38412907',
  cuil: '27-38412907-8',
  whatsapp: '11 5555-0142',
};

describe('Datos personales enmascarados en los listados (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let candidateId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
    const created = await http().post('/api/v1/backoffice/candidates').set(bearer(token)).send(person).expect(201);
    candidateId = created.body.id;
    await http().post('/api/v1/applications').send({ ...person, offerCode: 'IND3307418' }).expect(201);
  });
  afterAll(async () => {
    await app.close();
  });

  it('el listado de postulantes muestra DNI, CUIL y WhatsApp enmascarados', async () => {
    const res = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).expect(200);
    const item = res.body.items.find((c: { id: string }) => c.id === candidateId);
    expect(item.dni).toBe('****2907');
    expect(item.cuil).toBe('**-****2907-*');
    expect(item.whatsapp).toBe('+54*******0142');
    expect(JSON.stringify(res.body)).not.toMatch(/38412907|27384129078|27-38412907-8|5491155550142/);
  });

  it('se puede seguir buscando por DNI completo aunque el listado lo muestre tapado', async () => {
    const res = await http().get('/api/v1/backoffice/candidates').set(bearer(token)).query({ q: '38412907' }).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].dni).toBe('****2907');
  });

  it('el detalle de un postulante sí trae los datos completos', async () => {
    const res = await http().get(`/api/v1/backoffice/candidates/${candidateId}`).set(bearer(token)).expect(200);
    expect(res.body).toEqual(expect.objectContaining({ dni: '38412907', cuil: '27-38412907-8', whatsapp: '+5491155550142' }));
  });

  it('crear y editar devuelven la ficha completa (la persona recién cargó esos datos)', async () => {
    const res = await http().patch(`/api/v1/backoffice/candidates/${candidateId}`).set(bearer(token)).send({ position: 'Operario' }).expect(200);
    expect(res.body.dni).toBe('38412907');
  });

  it('el listado de postulaciones muestra el DNI y el CUIL enmascarados', async () => {
    const res = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
    expect(res.body.items[0].candidate.dni).toBe('****2907');
    expect(res.body.items[0].candidate.cuil).toBe('**-****2907-*');
    expect(JSON.stringify(res.body)).not.toMatch(/38412907|27384129078|27-38412907-8/);
  });

  it('el detalle de una postulación mantiene el DNI tapado; el contacto completo está en candidateContact', async () => {
    const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
    const res = await http().get(`/api/v1/backoffice/applications/${list.body.items[0].id}`).set(bearer(token)).expect(200);
    expect(res.body.candidate.dni).toBe('****2907');
    expect(res.body.candidateContact).toEqual({ email: 'martina@ejemplo.com', whatsapp: '+5491155550142' });
  });
});
