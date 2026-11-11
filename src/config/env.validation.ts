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
  /** Pedidos por minuto y por IP. */
  readonly THROTTLE_LIMIT: number;
  /** Clave (base64 de 32 bytes) con la que se cifran los CV guardados. Vacía = sin cifrar (solo local). */
  readonly CV_ENCRYPTION_KEY: string;
  /** Pide un token anti-robots (header X-Captcha-Token) al postularse y al subir un CV. Apagado por defecto. */
  readonly CAPTCHA_ENABLED: boolean;
  /** Clave secreta del proveedor de captcha. */
  readonly CAPTCHA_SECRET: string;
  /** Borra periódicamente los CV subidos que nunca se asociaron a un postulante. Por defecto, solo en producción. */
  readonly CV_CLEANUP_ENABLED: boolean;
  /** Horas que un CV sin postulante espera antes de borrarse. */
  readonly CV_ORPHAN_TTL_HOURS: number;
  /** Cantidad de proxies delante de la API (0 = ninguno, como en local). */
  readonly TRUST_PROXY: number;
  /** Redirige http a https (requiere TRUST_PROXY). Apagado por defecto. */
  readonly FORCE_HTTPS: boolean;
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
/** Textos típicos de un valor sin completar. */
const PLACEHOLDER = /cambiar|changeme|change-me/i;
/** base64 estricto (sin caracteres de más) que decodifica a exactamente 32 bytes. */
const isBase64Key32 = (value: string): boolean => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, 'base64').length === 32;
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

  if (production) {
    // El .env.example trae valores de ejemplo ("cambiar-…"): en producción no pueden quedar.
    for (const key of ['JWT_SECRET', 'ADMIN_REGISTRATION_KEY', 'DB_PASSWORD']) {
      if (PLACEHOLDER.test(str(raw, key))) errors.push(`${key} tiene el valor de ejemplo: generá uno propio`);
    }
    const origins = str(raw, 'CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (!origins.length || origins.some((o) => !o.startsWith('https://'))) {
      errors.push('CORS_ORIGINS es obligatoria en producción y todos los orígenes deben ser https://');
    }
  }

  const cvKey = str(raw, 'CV_ENCRYPTION_KEY');
  if (production && !cvKey) errors.push('CV_ENCRYPTION_KEY es obligatoria en producción (base64 de 32 bytes: openssl rand -base64 32)');
  if (cvKey && !isBase64Key32(cvKey)) errors.push('CV_ENCRYPTION_KEY debe ser base64 de exactamente 32 bytes (openssl rand -base64 32)');

  const captcha = bool(raw, 'CAPTCHA_ENABLED');
  if (captcha && !str(raw, 'CAPTCHA_SECRET')) errors.push('CAPTCHA_SECRET es obligatoria cuando CAPTCHA_ENABLED=true');

  const cvTtl = Number(str(raw, 'CV_ORPHAN_TTL_HOURS', '24'));
  if (!Number.isInteger(cvTtl) || cvTtl < 1 || cvTtl > 720) errors.push('CV_ORPHAN_TTL_HOURS debe ser un entero de horas entre 1 y 720');
  // Fuera de producción viene apagada: en local no se pierde ningún archivo mientras se prueba.
  const cvCleanup = str(raw, 'CV_CLEANUP_ENABLED') === '' ? production : bool(raw, 'CV_CLEANUP_ENABLED');

  const trustProxy = Number(str(raw, 'TRUST_PROXY', '0'));
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 10) errors.push('TRUST_PROXY debe ser un entero entre 0 y 10');
  const forceHttps = bool(raw, 'FORCE_HTTPS');
  if (forceHttps && !(trustProxy > 0)) errors.push('FORCE_HTTPS requiere TRUST_PROXY: la API tiene que saber que hay un proxy que termina el https');

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
    THROTTLE_LIMIT: Number(str(raw, 'THROTTLE_LIMIT', '120')) || 120,
    CAPTCHA_ENABLED: captcha,
    CAPTCHA_SECRET: str(raw, 'CAPTCHA_SECRET'),
    CV_ENCRYPTION_KEY: cvKey,
    CV_CLEANUP_ENABLED: cvCleanup,
    CV_ORPHAN_TTL_HOURS: cvTtl,
    TRUST_PROXY: trustProxy,
    FORCE_HTTPS: forceHttps,
    RENAPER_ENABLED: renaper,
    RENAPER_BASE_URL: str(raw, 'RENAPER_BASE_URL'),
    RENAPER_CLIENT_ID: str(raw, 'RENAPER_CLIENT_ID'),
    RENAPER_CLIENT_SECRET: str(raw, 'RENAPER_CLIENT_SECRET'),
  };
}
