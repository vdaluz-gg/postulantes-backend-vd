import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { errorForLog } from '../../common/utils/redact';
import { APP_ENV } from '../../config/app-config.module';
import { AppEnv } from '../../config/env.validation';
import { CAPTCHA_VERIFIER, CaptchaVerifier } from './ports/captcha-verifier';

/** Header con el token que entrega el captcha del front. */
export const CAPTCHA_HEADER = 'x-captcha-token';

/**
 * Exige un token de captcha válido en las rutas que crean registros sin sesión (postularse, subir un CV). Con
 * CAPTCHA_ENABLED=false (el valor de local) no pide ni consulta nada. Si el proveedor no responde, no deja pasar.
 */
@Injectable()
export class CaptchaGuard implements CanActivate {
  private readonly logger = new Logger(CaptchaGuard.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(CAPTCHA_VERIFIER) private readonly verifier: CaptchaVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.env.CAPTCHA_ENABLED) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const token = String(req.headers[CAPTCHA_HEADER] ?? '').trim();
    if (!token) throw new BadRequestException('Falta la verificación anti-robots');
    const valid = await this.verifier.verify(token, req.ip ?? '').catch((e: unknown) => {
      this.logger.error(`Falló la verificación anti-robots: ${errorForLog(e)}`);
      throw new ServiceUnavailableException('No pudimos verificar que no sos un robot. Probá de nuevo más tarde');
    });
    if (!valid) throw new ForbiddenException('No pudimos verificar que no sos un robot');
    return true;
  }
}

/** Marca una ruta pública que exige captcha (cuando está encendido). */
export const RequireCaptcha = () => UseGuards(CaptchaGuard);
