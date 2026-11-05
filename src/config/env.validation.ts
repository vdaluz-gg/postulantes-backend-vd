export interface AppEnv {
  readonly NODE_ENV: 'development' | 'test' | 'production';
  readonly PORT: number;
  readonly corsOrigins: readonly string[];
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USER: string;
  readonly DB_PASSWORD: string;
  readonly DB_NAME: string;
  readonly DB_SYNCHRONIZE: boolean;
  readonly SEED_ON_BOOT: boolean;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: string;
  readonly ADMIN_REGISTRATION_KEY: string;
  readonly UPLOAD_DIR: string;
  readonly RENAPER_ENABLED: boolean;
  readonly RENAPER_BASE_URL: string;
  readonly RENAPER_CLIENT_ID: string;
  readonly RENAPER_CLIENT_SECRET: string;
}

type Raw = Record<string, unknown>;

const str = (raw: Raw, key: string, fallback = ''): string => {
  const v = raw[key];
  return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim();
};
const bool = (raw: Raw, key: string): boolean => str(raw, key, 'false').toLowerCase() === 'true';

/**
 * Valida y tipa las variables de entorno al arrancar. Falla rápido y con un mensaje claro en vez de
 * descubrir un secreto faltante en medio de un request.
 */
export function validateEnv(raw: Raw): AppEnv {
  const errors: string[] = [];
  const nodeEnv = str(raw, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) errors.push('NODE_ENV debe ser development, test o production');
  const production = nodeEnv === 'production';

  const port = Number(str(raw, 'PORT', '3000'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT debe ser un entero entre 1 y 65535');
  const dbPort = Number(str(raw, 'DB_PORT', '5432'));
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) errors.push('DB_PORT debe ser un entero entre 1 y 65535');

  const jwtSecret = str(raw, 'JWT_SECRET');
  if (jwtSecret.length < 32) errors.push('JWT_SECRET es obligatorio y debe tener al menos 32 caracteres');
  const registrationKey = str(raw, 'ADMIN_REGISTRATION_KEY');
  if (!registrationKey) errors.push('ADMIN_REGISTRATION_KEY es obligatoria');

  const dbSync = bool(raw, 'DB_SYNCHRONIZE');
  const seed = bool(raw, 'SEED_ON_BOOT');
  if (production && dbSync) errors.push('DB_SYNCHRONIZE no puede ser true en producción: usá migraciones');
  if (production && seed) errors.push('SEED_ON_BOOT no puede ser true en producción');
  if (production && !str(raw, 'DB_PASSWORD')) errors.push('DB_PASSWORD es obligatoria en producción');

  const renaper = bool(raw, 'RENAPER_ENABLED');
  if (renaper) {
    for (const key of ['RENAPER_BASE_URL', 'RENAPER_CLIENT_ID', 'RENAPER_CLIENT_SECRET']) {
      if (!str(raw, key)) errors.push(`${key} es obligatoria cuando RENAPER_ENABLED=true`);
    }
  }

  if (errors.length) throw new Error(`Configuración de entorno inválida:\n - ${errors.join('\n - ')}`);

  return {
    NODE_ENV: nodeEnv as AppEnv['NODE_ENV'],
    PORT: port,
    corsOrigins: str(raw, 'CORS_ORIGINS', 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    DB_HOST: str(raw, 'DB_HOST', 'localhost'),
    DB_PORT: dbPort,
    DB_USER: str(raw, 'DB_USER', 'gg_postulantes'),
    DB_PASSWORD: str(raw, 'DB_PASSWORD'),
    DB_NAME: str(raw, 'DB_NAME', 'gg_postulantes'),
    DB_SYNCHRONIZE: dbSync,
    SEED_ON_BOOT: seed,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: str(raw, 'JWT_EXPIRES_IN', '8h'),
    ADMIN_REGISTRATION_KEY: registrationKey,
    UPLOAD_DIR: str(raw, 'UPLOAD_DIR', './uploads'),
    RENAPER_ENABLED: renaper,
    RENAPER_BASE_URL: str(raw, 'RENAPER_BASE_URL'),
    RENAPER_CLIENT_ID: str(raw, 'RENAPER_CLIENT_ID'),
    RENAPER_CLIENT_SECRET: str(raw, 'RENAPER_CLIENT_SECRET'),
  };
}
