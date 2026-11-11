import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Express } from 'express';
import helmet from 'helmet';
import { forceHttps, helmetOptions, securityHeaders } from './common/security/http-security';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppEnv } from './config/env.validation';

export const API_PREFIX = 'api/v1';

/** Configuración común a la app real y a la de los tests, para que se comporten igual. */
export function configureApp(app: INestApplication, env: AppEnv): void {
  app.setGlobalPrefix(API_PREFIX);
  // Detrás de un proxy o balanceador: sin esto todos los pedidos parecen venir de la misma IP (el límite de pedidos
  // las cuenta juntas) y no se sabe si llegaron por https. 0 = sin proxy (local).
  if (env.TRUST_PROXY > 0) (app.getHttpAdapter().getInstance() as Express).set('trust proxy', env.TRUST_PROXY);
  if (env.FORCE_HTTPS) app.use(forceHttps(`/${API_PREFIX}/health`));
  app.use(helmet(helmetOptions(env.NODE_ENV === 'production')));
  app.use(securityHeaders);
  // Sin `credentials`: la sesión del backoffice viaja en el header Authorization, no en cookies.
  app.enableCors({ origin: [...env.corsOrigins] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Portal de empleo · Grupo Gestión')
      .setDescription('API del portal de postulantes y de su backoffice (mock).')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }
}
