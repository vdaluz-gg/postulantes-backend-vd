import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { seedReferenceData } from '../src/database/seed/seed';
import { Candidate } from '../src/modules/candidates/entities/candidate.entity';
import {
  EMPLOYEE_ONBOARDING,
  EmployeeOnboarding,
  OnboardingInput,
} from '../src/modules/applications/ports/employee-onboarding';
import { adminToken, bearer } from './utils/admin';
import { createTestApp } from './utils/test-app';

const contact = { fullName: 'Martina Rodríguez', email: 'martina@ejemplo.com', dni: '38.412.907', whatsapp: '11 5555-0142' };
const LEGAJO = /^KT-\d{6}$/;

/** Alta en el ERP que se puede hacer fallar y contar, en lugar del ADP BOT. */
class FlakyOnboarding implements EmployeeOnboarding {
  fail = true;
  calls: OnboardingInput[] = [];
  async register(input: OnboardingInput): Promise<{ employeeNumber: string }> {
    this.calls.push(input);
    if (this.fail) throw new Error('timeout del ERP 10.1.2.3');
    return { employeeNumber: 'KT-123456' };
  }
}

describe('Alta del colaborador al ser contratado (integración)', () => {
  describe('con el alta mock (ADP BOT)', () => {
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

    const apply = async (body: Record<string, unknown>): Promise<string> => {
      const pub = await http().post('/api/v1/applications').send(body).expect(201);
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ limit: 100 }).expect(200);
      return list.body.items.find((a: { trackingCode: string }) => a.trackingCode === pub.body.trackingCode).id;
    };
    const status = (id: string, s: string) => http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: s });

    it('antes de la contratación no hay alta', async () => {
      const id = await apply(contact);
      const res = await status(id, 'recruiter_review').expect(200);
      expect(res.body.onboarding).toEqual({ status: 'not_applicable', employeeNumber: null });
      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' });
      expect(c).toEqual(expect.objectContaining({ profileStage: 'applicant', employeeNumber: null }));
    });

    it('al contratar, el postulante pasa a colaborador con su legajo', async () => {
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
      const id = list.body.items[0].id;
      const res = await status(id, 'hired').expect(200);
      expect(res.body.status).toBe('hired');
      expect(res.body.onboarding).toEqual({ status: 'done', employeeNumber: expect.stringMatching(LEGAJO) });

      const c = await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' });
      expect(c.profileStage).toBe('collaborator');
      expect(c.employeeNumber).toBe(res.body.onboarding.employeeNumber);
      const detail = await http().get(`/api/v1/backoffice/candidates/${c.id}`).set(bearer(token)).expect(200);
      expect(detail.body).toEqual(expect.objectContaining({ profileStage: 'collaborator', employeeNumber: c.employeeNumber }));
    });

    it('el seguimiento público no muestra el legajo', async () => {
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
      const pub = await http().get(`/api/v1/applications/track/${list.body.items[0].trackingCode}`).expect(200);
      expect(JSON.stringify(pub.body)).not.toMatch(/KT-|employee|legajo|collaborator/i);
    });

    it('rechazar o dar de baja no genera alta', async () => {
      const id = await apply({ ...contact, dni: '30111222', email: 'a@x.com' });
      const res = await status(id, 'rejected').expect(200);
      expect(res.body.onboarding).toEqual({ status: 'not_applicable', employeeNumber: null });
      expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '30111222' })).profileStage).toBe('applicant');
    });

    it('reintentar el alta de una postulación que no está contratada o ya está dada de alta es un conflicto', async () => {
      const open = await apply({ ...contact, dni: '30111333', email: 'b@x.com' });
      await http().post(`/api/v1/backoffice/applications/${open}/onboarding`).set(bearer(token)).expect(409);
      const hired = (await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).id;
      const app1 = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ candidateId: hired }).expect(200);
      await http().post(`/api/v1/backoffice/applications/${app1.body.items[0].id}/onboarding`).set(bearer(token)).expect(409);
    });

    it('exige sesión de administrador y valida el id', async () => {
      await http().post('/api/v1/backoffice/applications/8d6c5f6e-0000-4000-8000-000000000000/onboarding').expect(401);
      await http().post('/api/v1/backoffice/applications/8d6c5f6e-0000-4000-8000-000000000000/onboarding').set(bearer(token)).expect(404);
      await http().post('/api/v1/backoffice/applications/abc/onboarding').set(bearer(token)).expect(400);
    });
  });

  describe('si el ERP falla', () => {
    let app: INestApplication;
    let ds: DataSource;
    let token: string;
    const erp = new FlakyOnboarding();
    const http = () => request(app.getHttpServer());

    beforeAll(async () => {
      ({ app, dataSource: ds } = await createTestApp((b) => b.overrideProvider(EMPLOYEE_ONBOARDING).useValue(erp)));
      await seedReferenceData(ds);
      token = await adminToken(app, ds);
    });
    afterAll(async () => {
      await app.close();
    });

    const hire = async (body: Record<string, unknown>): Promise<{ id: string; res: request.Response }> => {
      const pub = await http().post('/api/v1/applications').send(body).expect(201);
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).query({ limit: 100 }).expect(200);
      const id = list.body.items.find((a: { trackingCode: string }) => a.trackingCode === pub.body.trackingCode).id;
      const res = await http().patch(`/api/v1/backoffice/applications/${id}/status`).set(bearer(token)).send({ status: 'hired' }).expect(200);
      return { id, res };
    };

    it('la contratación igual se registra y el alta queda pendiente, sin filtrar el error del ERP', async () => {
      const { id, res } = await hire(contact);
      expect(res.body.status).toBe('hired');
      expect(res.body.onboarding).toEqual({ status: 'pending', employeeNumber: null });
      expect(JSON.stringify(res.body)).not.toContain('10.1.2.3');
      expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).profileStage).toBe('applicant');
      expect(erp.calls).toHaveLength(1);
      expect(erp.calls[0]).toEqual({ candidateId: expect.any(String), fullName: 'Martina Rodríguez', dni: '38412907', position: 'Postulación espontánea' });

      // Reintento mientras el ERP sigue caído: 502 genérico.
      const retry = await http().post(`/api/v1/backoffice/applications/${id}/onboarding`).set(bearer(token)).expect(502);
      expect(JSON.stringify(retry.body)).not.toContain('10.1.2.3');
    });

    it('cuando el ERP vuelve, el reintento completa el alta', async () => {
      const list = await http().get('/api/v1/backoffice/applications').set(bearer(token)).expect(200);
      const id = list.body.items[0].id;
      erp.fail = false;
      const res = await http().post(`/api/v1/backoffice/applications/${id}/onboarding`).set(bearer(token)).expect(201);
      expect(res.body.onboarding).toEqual({ status: 'done', employeeNumber: 'KT-123456' });
      expect((await ds.getRepository(Candidate).findOneByOrFail({ dni: '38412907' })).profileStage).toBe('collaborator');
    });

    it('si la persona ya tiene legajo no se da de alta de nuevo', async () => {
      const before = erp.calls.length;
      const { res } = await hire({ ...contact, offerCode: 'IND3307418' });
      expect(res.body.onboarding).toEqual({ status: 'done', employeeNumber: 'KT-123456' });
      expect(erp.calls).toHaveLength(before);
    });
  });
});
