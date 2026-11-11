import { NextFunction, Request, Response } from 'express';
import { HelmetOptions } from 'helmet';

/**
 * Opciones de helmet. HSTS por 180 días y SIN includeSubDomains: así no se obliga a https a otros subdominios
 * de la empresa que quizás todavía no lo tengan. En producción la API (que solo devuelve JSON) usa una política
 * de contenido que no permite cargar nada; fuera de producción queda la de helmet para que Swagger funcione.
 */
export function helmetOptions(production: boolean): HelmetOptions {
  return {
    hsts: { maxAge: 15_552_000, includeSubDomains: false },
    ...(production
      ? {
          contentSecurityPolicy: {
            useDefaults: false,
            directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
          },
        }
      : {}),
  };
}

/**
 * Las respuestas traen datos personales: que ni el navegador ni un proxy intermedio las guarden. Además se apagan
 * cámara, micrófono y ubicación para lo que sirva la propia API (no afecta a los permisos que pide el front).
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * Redirige a https lo que llegó por http (se sabe por X-Forwarded-Proto, con `trust proxy` configurado).
 * 308 conserva el método y el cuerpo. El chequeo de salud queda exento: Docker y los balanceadores lo consultan por http.
 */
export function forceHttps(healthPath: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.secure || req.path === healthPath) return next();
    res.redirect(308, `https://${req.hostname}${req.originalUrl}`);
  };
}
