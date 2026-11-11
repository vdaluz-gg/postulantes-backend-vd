import { AppEnv } from '../../config/env.validation';
import { createCaptchaVerifier, MockCaptchaVerifier, MOCK_CAPTCHA_TOKEN } from './captcha-verifier.factory';

const env = (extra: Partial<AppEnv>): AppEnv => ({ NODE_ENV: 'development', CAPTCHA_ENABLED: false, CAPTCHA_SECRET: '', ...extra }) as AppEnv;

describe('createCaptchaVerifier', () => {
  it('hoy devuelve el verificador de prueba, que solo acepta el token de ejemplo', async () => {
    const verifier = createCaptchaVerifier(env({}));
    expect(verifier).toBeInstanceOf(MockCaptchaVerifier);
    expect(await verifier.verify(MOCK_CAPTCHA_TOKEN, '127.0.0.1')).toBe(true);
    expect(await verifier.verify('cualquier-otro', '127.0.0.1')).toBe(false);
  });

  it('en producción con el captcha encendido se niega a arrancar con el verificador de prueba', () => {
    expect(() => createCaptchaVerifier(env({ NODE_ENV: 'production', CAPTCHA_ENABLED: true, CAPTCHA_SECRET: 's' }))).toThrow(/verificador de prueba/);
  });

  it('en producción con el captcha apagado no molesta', () => {
    expect(() => createCaptchaVerifier(env({ NODE_ENV: 'production', CAPTCHA_ENABLED: false }))).not.toThrow();
  });
});
