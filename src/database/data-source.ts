import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { dbSslOptions } from './db-ssl';
import { ALL_ENTITIES } from './entities';

// Solo para el CLI de migraciones (npm run migration:generate / migration:run).
config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: dbSslOptions({ DB_SSL: process.env.DB_SSL === 'true', DB_SSL_CA: process.env.DB_SSL_CA ?? '' }),
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
