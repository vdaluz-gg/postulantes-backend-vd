import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppEnv, validateEnv } from './env.validation';

/** Token con la configuración ya validada y tipada. */
export const APP_ENV = Symbol('APP_ENV');

/**
 * Carga el .env (si existe) a process.env y expone la configuración validada. Cualquier clase la pide con
 * `@Inject(APP_ENV)`: así no se lee process.env suelto por el código.
 */
@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: false, ignoreEnvFile: process.env.NODE_ENV === 'test' })],
  providers: [{ provide: APP_ENV, useFactory: (): AppEnv => validateEnv(process.env) }],
  exports: [APP_ENV],
})
export class AppConfigModule {}
