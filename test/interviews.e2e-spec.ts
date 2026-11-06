import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Zone } from '../src/modules/zones/entities/zone.entity';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const NO_ID = '8d6c5f6e-0000-4000-8000-000000000000';
const contact = (n: number) => ({ fullName: 'Persona Prueba', email: `p${n}@x.com`, dni: String(31_000_000 + n), whatsapp: '11 5555-0142' });

/** Un día hábil a futuro, a la hora indicada (UTC), para que los tests no dependan de la fecha de hoy. */
const slot = (hour: number, minute = 0, days = 30): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};

describe('Salas y entrevistas (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let zoneId: string;
  let roomA: string;
  let roomB: string;
  const http = () => request(app.getHttpServer());
  const auth = () => bearer(token);

  /** Crea una postulación y la lleva a "Selectora" (recruiter_review), que es cuando se puede entrevistar. */
  const reviewedApplication = async (n: number): Promise<{ id: string; trackingCode: string }> => {
    const pub = await http().post('/api/v1/applications').send(contact(n)).expect(201);
    const list = await http().get('/api/v1/backoffice/applications').set(auth()).query({ limit: 100 }).expect(200);
    const found = list.body.items.find((a: { trackingCode: string }) => a.trackingCode === pub.body.trackingCode);
    await http().patch(`/api/v1/backoffice/applications/${found.id}/status`).set(auth()).send({ status: 'recruiter_review' }).expect(200);
    return { id: found.id, trackingCode: pub.body.trackingCode };
  };
  const schedule = (applicationId: string, body: Record<string, unknown>) =>
    http().post(`/api/v1/backoffice/applications/${applicationId}/interviews`).set(auth()).send(body);

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
    await seedReferenceData(ds);
    token = await adminToken(app, ds);
    zoneId = (await ds.getRepository(Zone).findOneByOrFail({ name: 'Monte Grande' })).id;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('Salas /backoffice/interview-rooms', () => {
    it.each([
      ['get', '/api/v1/backoffice/interview-rooms'],
      ['post', '/api/v1/backoffice/interview-rooms'],
      ['patch', `/api/v1/backoffice/interview-rooms/${NO_ID}`],
    ] as const)('%s %s exige sesión de administrador', async (method, url) => {
      await request(app.getHttpServer())[method](url).expect(401);
    });

    it('crea, lista y edita salas', async () => {
      const a = await http().post('/api/v1/backoffice/interview-rooms').set(auth()).send({ name: 'Sala 1', zoneId, address: 'Av. Siempre Viva 123', capacity: 4 }).expect(201);
      expect(a.body).toEqual({ id: expect.any(String), name: 'Sala 1', zone: { id: zoneId, name: 'Monte Grande' }, address: 'Av. Siempre Viva 123', capacity: 4, active: true });
      roomA = a.body.id;
      const b = await http().post('/api/v1/backoffice/interview-rooms').set(auth()).send({ name: 'Sala 2', zoneId }).expect(201);
      expect(b.body.capacity).toBe(1);
      roomB = b.body.id;

      const list = await http().get('/api/v1/backoffice/interview-rooms').set(auth()).expect(200);
      expect(list.body.map((r: { name: string }) => r.name)).toEqual(['Sala 1', 'Sala 2']);

      const upd = await http().patch(`/api/v1/backoffice/interview-rooms/${roomB}`).set(auth()).send({ capacity: 2 }).expect(200);
      expect(upd.body.capacity).toBe(2);
    });

    it('rechaza nombres repetidos, zonas inexistentes y datos inválidos', async () => {
      await http().post('/api/v1/backoffice/interview-rooms').set(auth()).send({ name: 'Sala 1', zoneId }).expect(409);
      await http().post('/api/v1/backoffice/interview-rooms').set(auth()).send({ name: 'Sala X', zoneId: NO_ID }).expect(400);
      await http().post('/api/v1/backoffice/interview-rooms').set(auth()).send({ name: '', zoneId }).expect(400);
      await http().post('/api/v1/backoffice/interview-rooms').set(auth()).send({ name: 'Sala Y', zoneId, capacity: 0 }).expect(400);
      await http().patch(`/api/v1/backoffice/interview-rooms/${NO_ID}`).set(auth()).send({ capacity: 3 }).expect(404);
    });
  });

  describe('Entrevistas', () => {
    it.each([
      ['post', `/api/v1/backoffice/applications/${NO_ID}/interviews`],
      ['get', `/api/v1/backoffice/applications/${NO_ID}/interviews`],
      ['get', '/api/v1/backoffice/interviews'],
      ['patch', `/api/v1/backoffice/interviews/${NO_ID}/status`],
    ] as const)('%s %s exige sesión de administrador', async (method, url) => {
      await request(app.getHttpServer())[method](url).expect(401);
    });

    it('solo se agenda cuando la postulación está en revisión de la selectora o ya en entrevista', async () => {
      const pub = await http().post('/api/v1/applications').send(contact(1)).expect(201);
      const list = await http().get('/api/v1/backoffice/applications').set(auth()).query({ limit: 100 }).expect(200);
      const id = list.body.items.find((a: { trackingCode: string }) => a.trackingCode === pub.body.trackingCode).id;
      const res = await schedule(id, { roomId: roomA, startsAt: slot(10) }).expect(409);
      expect(res.body.message).toBe('Solo se puede agendar una entrevista cuando la postulación está en revisión de la selectora');
    });

    it('agenda, pasa la postulación a "entrevista" y la muestra al postulante', async () => {
      const { id, trackingCode } = await reviewedApplication(2);
      const res = await schedule(id, { roomId: roomA, startsAt: slot(10), durationMinutes: 45 }).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        applicationId: id,
        room: { id: roomA, name: 'Sala 1' },
        startsAt: slot(10),
        endsAt: slot(10, 45),
        status: 'scheduled',
      });

      const detail = await http().get(`/api/v1/backoffice/applications/${id}`).set(auth()).expect(200);
      expect(detail.body.status).toBe('interview');
      expect(detail.body.history.map((h: { status: string }) => h.status)).toEqual(['received', 'recruiter_review', 'interview']);

      const pub = await http().get(`/api/v1/applications/track/${trackingCode}`).expect(200);
      expect(pub.body.interview).toEqual({
        startsAt: slot(10),
        endsAt: slot(10, 45),
        place: { name: 'Sala 1', address: 'Av. Siempre Viva 123' },
      });
    });

    it('la duración por defecto es de 30 minutos', async () => {
      const { id } = await reviewedApplication(3);
      const res = await schedule(id, { roomId: roomB, startsAt: slot(14) }).expect(201);
      expect(res.body.endsAt).toBe(slot(14, 30));
    });

    it('no deja pisar otra entrevista en la misma sala, pero sí agendar justo a continuación', async () => {
      const { id } = await reviewedApplication(4);
      const clash = await schedule(id, { roomId: roomA, startsAt: slot(10, 30) }).expect(409);
      expect(clash.body.message).toBe('La sala ya está ocupada en ese horario');
      await schedule(id, { roomId: roomA, startsAt: slot(10, 45) }).expect(201);
    });

    it('un postulante no puede tener dos entrevistas a la vez', async () => {
      const { id } = await reviewedApplication(5);
      await schedule(id, { roomId: roomA, startsAt: slot(16) }).expect(201);
      const res = await schedule(id, { roomId: roomB, startsAt: slot(16, 15) }).expect(409);
      expect(res.body.message).toBe('El postulante ya tiene una entrevista en ese horario');
    });

    it('rechaza fechas pasadas, duraciones fuera de rango, salas inexistentes o inactivas y datos inválidos', async () => {
      const { id } = await reviewedApplication(6);
      await schedule(id, { roomId: roomA, startsAt: slot(10, 0, -1) }).expect(400);
      await schedule(id, { roomId: roomA, startsAt: slot(12), durationMinutes: 10 }).expect(400);
      await schedule(id, { roomId: roomA, startsAt: slot(12), durationMinutes: 181 }).expect(400);
      await schedule(id, { roomId: roomA, startsAt: 'mañana' }).expect(400);
      await schedule(id, { roomId: 'abc', startsAt: slot(12) }).expect(400);
      await schedule(id, { startsAt: slot(12) }).expect(400);
      await schedule(id, { roomId: NO_ID, startsAt: slot(12) }).expect(404);
      await schedule(NO_ID, { roomId: roomA, startsAt: slot(12) }).expect(404);

      await http().patch(`/api/v1/backoffice/interview-rooms/${roomB}`).set(auth()).send({ active: false }).expect(200);
      const res = await schedule(id, { roomId: roomB, startsAt: slot(12) }).expect(409);
      expect(res.body.message).toBe('La sala no está disponible');
      await http().patch(`/api/v1/backoffice/interview-rooms/${roomB}`).set(auth()).send({ active: true }).expect(200);
    });

    it('lista las entrevistas de una postulación y la agenda general con filtros', async () => {
      const { id } = await reviewedApplication(7);
      await schedule(id, { roomId: roomB, startsAt: slot(9, 0, 31) }).expect(201);
      const mine = await http().get(`/api/v1/backoffice/applications/${id}/interviews`).set(auth()).expect(200);
      expect(mine.body).toHaveLength(1);

      const day = slot(0, 0, 31).slice(0, 10);
      const agenda = await http().get('/api/v1/backoffice/interviews').set(auth()).query({ from: `${day}T00:00:00.000Z`, to: `${day}T23:59:59.999Z` }).expect(200);
      expect(agenda.body.total).toBe(1);
      expect(agenda.body.items[0]).toEqual(
        expect.objectContaining({ applicationId: id, room: { id: roomB, name: 'Sala 2' }, candidate: expect.objectContaining({ fullName: 'Persona Prueba' }) }),
      );
      const byRoom = await http().get('/api/v1/backoffice/interviews').set(auth()).query({ roomId: roomA }).expect(200);
      expect(byRoom.body.items.every((i: { room: { id: string } }) => i.room.id === roomA)).toBe(true);
      await http().get('/api/v1/backoffice/interviews').set(auth()).query({ from: 'ayer' }).expect(400);
      await http().get('/api/v1/backoffice/interviews').set(auth()).query({ status: 'raro' }).expect(400);
    });

    it('al cancelar la entrevista el postulante ya no la ve y se libera la sala', async () => {
      const { id, trackingCode } = await reviewedApplication(8);
      const iv = await schedule(id, { roomId: roomA, startsAt: slot(18) }).expect(201);
      const res = await http().patch(`/api/v1/backoffice/interviews/${iv.body.id}/status`).set(auth()).send({ status: 'cancelled' }).expect(200);
      expect(res.body.status).toBe('cancelled');
      expect((await http().get(`/api/v1/applications/track/${trackingCode}`).expect(200)).body.interview).toBeNull();
      const other = await reviewedApplication(9);
      await schedule(other.id, { roomId: roomA, startsAt: slot(18) }).expect(201);
    });

    it('una entrevista cerrada no se vuelve a modificar y el estado debe ser válido', async () => {
      const { id } = await reviewedApplication(10);
      const iv = await schedule(id, { roomId: roomB, startsAt: slot(19) }).expect(201);
      await http().patch(`/api/v1/backoffice/interviews/${iv.body.id}/status`).set(auth()).send({ status: 'done' }).expect(200);
      await http().patch(`/api/v1/backoffice/interviews/${iv.body.id}/status`).set(auth()).send({ status: 'cancelled' }).expect(409);
      await http().patch(`/api/v1/backoffice/interviews/${iv.body.id}/status`).set(auth()).send({ status: 'scheduled' }).expect(400);
      await http().patch(`/api/v1/backoffice/interviews/${iv.body.id}/status`).set(auth()).send({ status: 'raro' }).expect(400);
      await http().patch(`/api/v1/backoffice/interviews/${NO_ID}/status`).set(auth()).send({ status: 'done' }).expect(404);
    });

    it('al rechazar o dar de baja la postulación se cancelan sus entrevistas pendientes', async () => {
      const { id, trackingCode } = await reviewedApplication(11);
      await schedule(id, { roomId: roomA, startsAt: slot(8) }).expect(201);
      await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(auth()).send({ status: 'rejected' }).expect(200);
      const list = await http().get(`/api/v1/backoffice/applications/${id}/interviews`).set(auth()).expect(200);
      expect(list.body.map((i: { status: string }) => i.status)).toEqual(['cancelled']);
      expect((await http().get(`/api/v1/applications/track/${trackingCode}`).expect(200)).body.interview).toBeNull();
    });
  });
});
