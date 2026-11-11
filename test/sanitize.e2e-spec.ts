import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import { Zone } from '../src/modules/zones/entities/zone.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const person = { fullName: 'Martina Rodríguez', email: 'martina@ejemplo.com', dni: '38412907', whatsapp: '11 5555-0142' };
const XSS = '<script>alert(1)</script>';

describe('Textos libres sanitizados (integración)', () => {
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

  it('el puesto que escribe el postulante no guarda etiquetas HTML', async () => {
    await http().post('/api/v1/applications').send({ ...person, position: `Operario ${XSS}<b>de planta</b>` }).expect(201);
    const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' });
    expect(c.position).toBe('Operario alert(1)de planta');
  });

  it('la nota interna de una postulación conserva los saltos de línea pero no las etiquetas', async () => {
    const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
    const id = list.body.items[0].id;
    const res = await http()
      .patch(`/api/v1/backoffice/applications/${id}/status`)
      .set(bearer(token))
      .send({ status: 'recruiter_review', note: 'Llamar el lunes\n<img src=x onerror=alert(1)>Confirmar zona' })
      .expect(200);
    expect(res.body.history[1].note).toBe('Llamar el lunes\nConfirmar zona');
  });

  it('una oferta cargada desde el backoffice se limpia en todos sus textos', async () => {
    const res = await http()
      .post('/api/v1/backoffice/job-offers')
      .set(bearer(token))
      .send({
        code: 'XSS0001',
        title: `Chofer ${XSS}`,
        description: `Tareas:\n${XSS}\n- Reparto`,
        zoneId,
        area: '<i>Logística</i>',
        schedule: 'Lunes a viernes',
        requirements: [`Registro ${XSS}`, 'Experiencia'],
        benefits: ['<b>Obra social</b>'],
        address: `Calle 123 ${XSS}`,
        internal: { clientNotes: `Nota\n<b>interna</b>`, client: `<u>Cliente</u>` },
      })
      .expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        title: 'Chofer alert(1)',
        description: 'Tareas:\nalert(1)\n- Reparto',
        area: 'Logística',
        requirements: ['Registro alert(1)', 'Experiencia'],
        benefits: ['Obra social'],
        address: 'Calle 123 alert(1)',
      }),
    );
    expect(res.body.internal).toEqual({ clientNotes: 'Nota\ninterna', client: 'Cliente' });
    expect(JSON.stringify(res.body)).not.toMatch(/<\/?script|<b>|<i>|<u>/);
  });

  it('una sala se limpia igual', async () => {
    const res = await http()
      .post('/api/v1/backoffice/interview-rooms')
      .set(bearer(token))
      .send({ name: `Sala <b>1</b>`, zoneId, address: `Av. Siempre Viva ${XSS}` })
      .expect(201);
    expect(res.body.name).toBe('Sala 1');
    expect(res.body.address).toBe('Av. Siempre Viva alert(1)');
  });

  it('un texto que queda vacío después de limpiarlo falla la validación en vez de guardarse vacío', async () => {
    await http()
      .post('/api/v1/backoffice/interview-rooms')
      .set(bearer(token))
      .send({ name: '<b></b>', zoneId })
      .expect(400);
  });
});
