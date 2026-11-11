import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, ModulesContainer } from '@nestjs/core';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../src/modules/auth/decorators/public.decorator';
import { createTestApp } from './utils/test-app';

interface RouteInfo {
  method: string;
  path: string;
  isPublic: boolean;
}

const UUID = '8d6c5f6e-0000-4000-8000-000000000000';

/** Rutas abiertas a cualquiera. Agregar una acá es una decisión consciente: por defecto todo exige sesión. */
const PUBLIC_ROUTES = [
  'GET /api/v1/health',
  'GET /api/v1/zones',
  'GET /api/v1/site-config/:audience',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'GET /api/v1/job-offers',
  'GET /api/v1/job-offers/nearby',
  'GET /api/v1/job-offers/filters',
  'GET /api/v1/job-offers/:code',
  'POST /api/v1/candidates/validate',
  'POST /api/v1/cv',
  'POST /api/v1/consents',
  'POST /api/v1/applications',
  'GET /api/v1/applications/track/:code',
].sort();

const join = (...parts: string[]): string => '/' + parts.flatMap((p) => p.split('/')).filter(Boolean).join('/');

/** Todas las rutas HTTP registradas, leídas de los metadatos de Nest (no de una lista escrita a mano). */
function collectRoutes(app: INestApplication): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const discovery = new DiscoveryService(app.get(ModulesContainer, { strict: false }));
  for (const { metatype, instance } of discovery.getControllers()) {
    if (!metatype || !instance) continue;
    const base = Reflect.getMetadata(PATH_METADATA, metatype) as string;
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, metatype) === true;
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(instance))) {
      const handler = (instance as Record<string, unknown>)[name];
      if (typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      routes.push({
        method: RequestMethod[method],
        path: join('api/v1', base, Reflect.getMetadata(PATH_METADATA, handler) as string),
        isPublic: classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true,
      });
    }
  }
  return routes;
}

describe('Autenticación por defecto (integración)', () => {
  let app: INestApplication;
  let routes: RouteInfo[];

  beforeAll(async () => {
    ({ app } = await createTestApp());
    routes = collectRoutes(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('encuentra las rutas de la app (si esto falla, el resto del test no prueba nada)', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('solo las rutas de la lista cerrada están marcadas como públicas', () => {
    const marked = routes.filter((r) => r.isPublic).map((r) => `${r.method} ${r.path}`).sort();
    expect(marked).toEqual(PUBLIC_ROUTES);
  });

  it('todas las demás rutas responden 401 sin token, aunque el cuerpo o el id sean inválidos', async () => {
    const closed = routes.filter((r) => !r.isPublic);
    expect(closed.length).toBeGreaterThan(30);
    for (const r of closed) {
      const url = r.path.replace(/:\w+/g, UUID);
      const res = await request(app.getHttpServer())[r.method.toLowerCase() as 'get'](url);
      if (res.status !== 401) throw new Error(`${r.method} ${r.path} respondió ${res.status} sin sesión: debería ser 401`);
    }
  });

  it('un token inventado tampoco abre ninguna ruta cerrada', async () => {
    const closed = routes.filter((r) => !r.isPublic).slice(0, 5);
    for (const r of closed) {
      const res = await request(app.getHttpServer())
        [r.method.toLowerCase() as 'get'](r.path.replace(/:\w+/g, UUID))
        .set('Authorization', 'Bearer abc.def.ghi');
      expect(res.status).toBe(401);
    }
  });
});
