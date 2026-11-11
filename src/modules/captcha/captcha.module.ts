import { Global, Module } from '@nestjs/common';
import { APP_ENV } from '../../config/app-config.module';
import { createCaptchaVerifier } from './captcha-verifier.factory';
import { CAPTCHA_VERIFIER } from './ports/captcha-verifier';

/** Provee el verificador de captcha (ver createCaptchaVerifier). Global: lo usa el guard de las rutas públicas. */
@Global()
@Module({
  providers: [{ provide: CAPTCHA_VERIFIER, inject: [APP_ENV], useFactory: createCaptchaVerifier }],
  exports: [CAPTCHA_VERIFIER],
})
export class CaptchaModule {}
