import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Admin } from '../../src/modules/auth/entities/admin.entity';

const PASSWORD = 'Clave-Segura-2026';

/** Crea un admin directo en la base y devuelve su JWT por el login real. */
export async function adminToken(app: INestApplication, ds: DataSource, email = 'tester@grupo-gestion.com.ar'): Promise<string> {
  const repo = ds.getRepository(Admin);
  if (!(await repo.existsBy({ email }))) {
    await repo.save(repo.create({ email, fullName: 'Tester Admin', passwordHash: bcrypt.hashSync(PASSWORD, 4), role: 'admin', active: true }));
  }
  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
