import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_ENV } from '../config/app-config.module';
import { AppEnv } from '../config/env.validation';
import { dbSslOptions } from './db-ssl';
import { ALL_ENTITIES } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => ({
        type: 'postgres' as const,
        host: env.DB_HOST,
        port: env.DB_PORT,
        username: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        ssl: dbSslOptions(env),
        entities: ALL_ENTITIES,
        synchronize: env.DB_SYNCHRONIZE,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
