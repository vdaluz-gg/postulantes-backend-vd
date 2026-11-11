import { AppEnv } from '../config/env.validation';

/**
 * Opciones TLS de la conexión a PostgreSQL. Apagado por defecto (la base de Docker de local no usa TLS). Encendido
 * siempre verifica el certificado del servidor: `rejectUnauthorized: false` cifraría el tráfico pero aceptaría a
 * cualquiera que se haga pasar por la base. Si la base usa un certificado propio, se pasa su CA en DB_SSL_CA (PEM; los
 * saltos de línea pueden escribirse como \n para caber en una sola línea del .env).
 */
export function dbSslOptions(env: Pick<AppEnv, 'DB_SSL' | 'DB_SSL_CA'>): false | { rejectUnauthorized: true; ca?: string } {
  if (!env.DB_SSL) return false;
  return env.DB_SSL_CA ? { rejectUnauthorized: true, ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : { rejectUnauthorized: true };
}
