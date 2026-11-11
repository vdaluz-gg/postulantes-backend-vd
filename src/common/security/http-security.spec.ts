import { Request, Response } from 'express';
import { forceHttps, helmetOptions, securityHeaders } from './http-security';

const fakeRes = () => {
  const headers: Record<string, string> = {};
  return {
    headers,
    redirected: undefined as { status: number; url: string } | undefined,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    redirect(status: number, url: string) {
      this.redirected = { status, url };
    },
  };
};

describe('helmetOptions', () => {
  it('HSTS por 180 días y sin includeSubDomains: no arrastra a otros subdominios de la empresa', () => {
    const hsts = helmetOptions(false).hsts as { maxAge: number; includeSubDomains: boolean };
    expect(hsts).toEqual({ maxAge: 15_552_000, includeSubDomains: false });
  });

  it('en producción la API (solo JSON) usa una política de contenido que no permite nada', () => {
    const csp = helmetOptions(true).contentSecurityPolicy as { useDefaults: boolean; directives: Record<string, string[]> };
    expect(csp.useDefaults).toBe(false);
    expect(csp.directives).toEqual({
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    });
  });

  it('fuera de producción deja la política por defecto, para que Swagger siga funcionando', () => {
    expect(helmetOptions(false).contentSecurityPolicy).toBeUndefined();
  });
});

describe('securityHeaders', () => {
  it('prohíbe cachear las respuestas (traen datos personales) y apaga cámara, micrófono y ubicación', () => {
    const res = fakeRes();
    const next = jest.fn();
    securityHeaders({} as Request, res as unknown as Response, next);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('forceHttps', () => {
  const run = (req: Partial<Request>) => {
    const res = fakeRes();
    const next = jest.fn();
    forceHttps('/api/v1/health')(req as Request, res as unknown as Response, next);
    return { res, next };
  };

  it('deja pasar lo que ya llegó por https', () => {
    const { res, next } = run({ secure: true, path: '/api/v1/zones', originalUrl: '/api/v1/zones', hostname: 'api.ejemplo.com' });
    expect(next).toHaveBeenCalled();
    expect(res.redirected).toBeUndefined();
  });

  it('redirige a https conservando ruta y query (308 mantiene el método y el cuerpo)', () => {
    const { res, next } = run({ secure: false, path: '/api/v1/job-offers', originalUrl: '/api/v1/job-offers?q=chofer', hostname: 'api.ejemplo.com' });
    expect(next).not.toHaveBeenCalled();
    expect(res.redirected).toEqual({ status: 308, url: 'https://api.ejemplo.com/api/v1/job-offers?q=chofer' });
  });

  it('no redirige el chequeo de salud: Docker y el balanceador lo consultan por http', () => {
    const { res, next } = run({ secure: false, path: '/api/v1/health', originalUrl: '/api/v1/health', hostname: 'localhost' });
    expect(next).toHaveBeenCalled();
    expect(res.redirected).toBeUndefined();
  });
});
