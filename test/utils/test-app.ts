import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataType, newDb } from 'pg-mem';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { ALL_ENTITIES } from '../../src/database/entities';
import { validateEnv } from '../../src/config/env.validation';
import { FILE_STORAGE, FileStorage } from '../../src/modules/cv/ports/file-storage';

/** Postgres en memoria con las extensiones y funciones que TypeORM espera. No requiere Docker. */
export async function createTestDataSource(): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({ name: 'current_database', implementation: () => 'test' });
  db.public.registerFunction({ name: 'version', implementation: () => 'PostgreSQL 16.0 (pg-mem)' });
  db.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({ name: 'uuid_generate_v4', returns: DataType.uuid, implementation: randomUUID, impure: true });
  });
  const ds = (await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: ALL_ENTITIES,
    synchronize: true,
  })) as DataSource;
  await ds.initialize();
  return ds;
}

/** Almacenamiento en memoria: los tests no escriben en disco. */
export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Buffer>();
  async save(key: string, content: Buffer): Promise<void> {
    this.files.set(key, content);
  }
  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
}

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  storage: InMemoryFileStorage;
}

export async function createTestApp(): Promise<TestApp> {
  const dataSource = await createTestDataSource();
  const storage = new InMemoryFileStorage();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(dataSource)
    .overrideProvider(FILE_STORAGE)
    .useValue(storage)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, validateEnv(process.env));
  await app.init();
  return { app, dataSource, storage };
}
