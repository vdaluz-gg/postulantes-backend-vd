import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp } from './app.setup';
import { APP_ENV } from './config/app-config.module';
import { AppEnv } from './config/env.validation';
import { seedReferenceData } from './database/seed/seed';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<AppEnv>(APP_ENV);
  configureApp(app, env);

  // Datos de ejemplo (zonas y ofertas). Idempotente y nunca en producción (la validación de entorno lo impide).
  if (env.SEED_ON_BOOT) {
    const seeded = await seedReferenceData(app.get(DataSource));
    new Logger('Seed').log(`Zonas nuevas: ${seeded.zones} · ofertas nuevas: ${seeded.offers}`);
  }

  await app.listen(env.PORT);
  const logger = new Logger('Bootstrap');
  logger.log(`API en http://localhost:${env.PORT}/${API_PREFIX}`);
  if (env.NODE_ENV !== 'production') logger.log(`Swagger en http://localhost:${env.PORT}/api/docs`);
}

void bootstrap();
