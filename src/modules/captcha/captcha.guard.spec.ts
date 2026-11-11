import { BadRequestException, ExecutionContext, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { AppEnv } from '../../config/env.validation';
import { CaptchaGuard } from './captcha.guard';
import { CaptchaVerifier } from './ports/captcha-verifier';

const context = (headers: Record<string, string> = {}, ip = '203.0.113.7') =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers, ip }) }) }) as unknown as ExecutionContext;

const build = (enabled: boolean, verify: CaptchaVerifier['verify'] = async () => true) => {
  const verifier = { verify: jest.fn(verify) };
  return { guard: new CaptchaGuard({ CAPTCHA_ENABLED: enabled } as AppEnv, verifier), verifier };
};

describe('CaptchaGuard', () => {
  it('apagado (lo normal en local): deja pasar sin pedir nada ni consultar al proveedor', async () => {
    const { guard, verifier } = build(false);
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('encendido y sin token: 400', async () => {
    const { guard, verifier } = build(true);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(BadRequestException);
    await expect(guard.canActivate(context({ 'x-captcha-token': '   ' }))).rejects.toBeInstanceOf(BadRequestException);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it('encendido con un token que el proveedor rechaza: 403', async () => {
    const { guard } = build(true, async () => false);
    await expect(guard.canActivate(context({ 'x-captcha-token': 'malo' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('encendido con un token válido: pasa, y el proveedor recibe el token y la IP', async () => {
    const { guard, verifier } = build(true);
    await expect(guard.canActivate(context({ 'x-captcha-token': 'bueno' }, '198.51.100.9'))).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('bueno', '198.51.100.9');
  });

  it('si el proveedor no responde no se deja pasar (falla cerrado) y no se filtra el detalle', async () => {
    const { guard } = build(true, async () => {
      throw new Error('ECONNRESET api.captcha.example secret=abc123');
    });
    const error = await guard.canActivate(context({ 'x-captcha-token': 'x' })).catch((e: Error) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toMatch(/abc123|ECONNRESET/);
  });
});
