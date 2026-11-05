import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Admin } from '../src/modules/auth/entities/admin.entity';
import { createTestApp } from './utils/test-app';

const REG_KEY = 'test-registration-key';
const valid = { email: 'Ana.Admin@Grupo-Gestion.com.ar', fullName: 'Ana Admin', password: 'Clave-Segura-2026', registrationKey: REG_KEY };

describe('Autenticación de administradores (integración)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, dataSource: ds } = await createTestApp());
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('registra un administrador y no devuelve el hash ni la contraseña', async () => {
      const res = await http().post('/api/v1/auth/register').send(valid).expect(201);
      expect(res.body).toEqual({ id: expect.any(String), email: 'ana.admin@grupo-gestion.com.ar', fullName: 'Ana Admin', role: 'admin' });
      const stored = await ds.getRepository(Admin).findOneByOrFail({ email: 'ana.admin@grupo-gestion.com.ar' });
      expect(stored.passwordHash).not.toContain('Clave-Segura-2026');
      expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('rechaza una clave de alta incorrecta', async () => {
      const res = await http().post('/api/v1/auth/register').send({ ...valid, email: 'otro@x.com', registrationKey: 'mala' }).expect(403);
      expect(res.body.message).toBe('Clave de alta inválida');
      expect(await ds.getRepository(Admin).countBy({ email: 'otro@x.com' })).toBe(0);
    });

    it('rechaza un mail ya registrado (sin importar mayúsculas)', async () => {
      await http().post('/api/v1/auth/register').send({ ...valid, email: 'ANA.ADMIN@grupo-gestion.com.ar' }).expect(409);
    });

    it.each([
      ['mail inválido', { email: 'no-es-mail' }],
      ['contraseña corta', { password: 'Corta1' }],
      ['contraseña sin mayúscula', { password: 'sin-mayuscula-2026' }],
      ['contraseña sin número', { password: 'Sin-Numero-Aqui' }],
      ['nombre vacío', { fullName: '' }],
      ['falta la clave de alta', { registrationKey: undefined }],
      ['intento de elegir rol', { role: 'superadmin' }],
    ])('valida: %s', async (_name, patch) => {
      await http().post('/api/v1/auth/register').send({ ...valid, email: 'nuevo@x.com', ...patch }).expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('devuelve un token y los datos del admin', async () => {
      const res = await http().post('/api/v1/auth/login').send({ email: 'ana.admin@grupo-gestion.com.ar', password: valid.password }).expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.admin).toEqual({ id: expect.any(String), email: 'ana.admin@grupo-gestion.com.ar', fullName: 'Ana Admin', role: 'admin' });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    });

    it('el mail no distingue mayúsculas', async () => {
      await http().post('/api/v1/auth/login').send({ email: 'ANA.ADMIN@grupo-gestion.com.ar', password: valid.password }).expect(200);
    });

    it('responde igual ante contraseña mala y usuario inexistente (no revela cuál falló)', async () => {
      const a = await http().post('/api/v1/auth/login').send({ email: 'ana.admin@grupo-gestion.com.ar', password: 'incorrecta' }).expect(401);
      const b = await http().post('/api/v1/auth/login').send({ email: 'nadie@x.com', password: 'incorrecta' }).expect(401);
      expect(a.body.message).toBe('Credenciales inválidas');
      expect(b.body.message).toBe('Credenciales inválidas');
    });

    it('un admin desactivado no puede entrar', async () => {
      const repo = ds.getRepository(Admin);
      await repo.save(repo.create({ email: 'baja@x.com', fullName: 'Baja Admin', passwordHash: bcrypt.hashSync(valid.password, 4), role: 'admin', active: false }));
      await http().post('/api/v1/auth/login').send({ email: 'baja@x.com', password: valid.password }).expect(401);
    });
  });

  describe('GET /auth/me y guards', () => {
    it('sin token → 401', async () => {
      await http().get('/api/v1/auth/me').expect(401);
    });

    it('con token inválido → 401', async () => {
      await http().get('/api/v1/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    });

    it('con token válido devuelve el perfil', async () => {
      const login = await http().post('/api/v1/auth/login').send({ email: 'ana.admin@grupo-gestion.com.ar', password: valid.password });
      const res = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
      expect(res.body.email).toBe('ana.admin@grupo-gestion.com.ar');
    });

    it('un token de un admin dado de baja deja de servir', async () => {
      const login = await http().post('/api/v1/auth/login').send({ email: 'ana.admin@grupo-gestion.com.ar', password: valid.password });
      await ds.getRepository(Admin).update({ email: 'ana.admin@grupo-gestion.com.ar' }, { active: false });
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(401);
      await ds.getRepository(Admin).update({ email: 'ana.admin@grupo-gestion.com.ar' }, { active: true });
    });
  });

  // Va al final: agota el cupo de login del minuto.
  describe('límite de intentos', () => {
    it('limita los intentos repetidos', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) {
        codes.push((await http().post('/api/v1/auth/login').send({ email: 'brute@x.com', password: 'x' })).status);
      }
      expect(codes).toContain(429);
    });
  });
});
