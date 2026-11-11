import { AppEnv } from '../../config/env.validation';
import { CaptchaVerifier } from './ports/captcha-verifier';

/** Único token que acepta el verificador de prueba: sirve para probar el flujo del front con el captcha encendido. */
export const MOCK_CAPTCHA_TOKEN = 'captcha-ok';

/** Verificador de prueba: no consulta a ningún proveedor. No protege de nada; es solo para probar el flujo. */
export class MockCaptchaVerifier implements CaptchaVerifier {
  async verify(token: string): Promise<boolean> {
    return token === MOCK_CAPTCHA_TOKEN;
  }
}

/**
 * Verificador según la configuración. Hoy solo existe el de prueba, así que en producción con el captcha encendido
 * se niega a arrancar: sería un captcha que no frena a nadie y daría una falsa sensación de seguridad. Para el
 * proveedor real se devuelve acá una clase que cumpla CaptchaVerifier.
 */
export function createCaptchaVerifier(env: AppEnv): CaptchaVerifier {
  if (env.NODE_ENV === 'production' && env.CAPTCHA_ENABLED) {
    throw new Error('CAPTCHA_ENABLED=true en producción, pero solo hay un verificador de prueba: conectá un proveedor real (CaptchaVerifier)');
  }
  return new MockCaptchaVerifier();
}
