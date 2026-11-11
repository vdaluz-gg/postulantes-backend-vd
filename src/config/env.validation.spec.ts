import { validateEnv } from './env.validation';

const base = {
  NODE_ENV: 'development',
  JWT_SECRET: 'x'.repeat(32),
  ADMIN_REGISTRATION_KEY: 'clave-de-alta',
  DB_PASSWORD: 'pw',
};

describe('validateEnv', () => {
  it('aplica valores por defecto', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.DB_HOST).toBe('localhost');
    expect(env.DB_SYNCHRONIZE).toBe(false);
    expect(env.RENAPER_ENABLED).toBe(false);
    expect(env.corsOrigins).toEqual(['http://localhost:4200']);
  });

  it('proxy y https forzado vienen apagados: no cambian nada al probar en local', () => {
    const env = validateEnv(base);
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.FORCE_HTTPS).toBe(false);
  });

  it('TRUST_PROXY es la cantidad de proxies delante de la API (entero de 0 a 10)', () => {
    expect(validateEnv({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    for (const bad of ['-1', '11', 'dos', '1.5']) expect(() => validateEnv({ ...base, TRUST_PROXY: bad })).toThrow(/TRUST_PROXY/);
  });

  it('FORCE_HTTPS exige TRUST_PROXY: sin saber que hay un proxy la API redirigiría en bucle', () => {
    expect(() => validateEnv({ ...base, FORCE_HTTPS: 'true' })).toThrow(/FORCE_HTTPS.*TRUST_PROXY/);
    expect(validateEnv({ ...base, FORCE_HTTPS: 'true', TRUST_PROXY: '1' }).FORCE_HTTPS).toBe(true);
  });

  describe('CV_ENCRYPTION_KEY (cifrado de los CV guardados)', () => {
    const key = Buffer.alloc(32, 7).toString('base64');

    it('en local es opcional: sin clave los CV se guardan sin cifrar', () => {
      expect(validateEnv(base).CV_ENCRYPTION_KEY).toBe('');
      expect(validateEnv({ ...base, CV_ENCRYPTION_KEY: key }).CV_ENCRYPTION_KEY).toBe(key);
    });

    it('si se define tiene que ser base64 de exactamente 32 bytes', () => {
      for (const bad of ['corta', Buffer.alloc(16).toString('base64'), Buffer.alloc(33).toString('base64'), '!!!no-es-base64!!!']) {
        expect(() => validateEnv({ ...base, CV_ENCRYPTION_KEY: bad })).toThrow(/CV_ENCRYPTION_KEY/);
      }
    });

    it('en producción es obligatoria', () => {
      const prod = {
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'k8Zp2vQ9xLw4TnR7bYc1dFg6HjM3sUa0EeIoXz5',
        ADMIN_REGISTRATION_KEY: 'alta-9fT2qLmX',
        DB_PASSWORD: 'Pw-real-8sK2',
        CORS_ORIGINS: 'https://portal.ejemplo.com',
      };
      expect(() => validateEnv(prod)).toThrow(/CV_ENCRYPTION_KEY.*obligatoria/);
      expect(validateEnv({ ...prod, CV_ENCRYPTION_KEY: key }).CV_ENCRYPTION_KEY).toBe(key);
    });
  });

  it('convierte tipos desde strings', () => {
    const env = validateEnv({ ...base, PORT: '4000', DB_SYNCHRONIZE: 'true', CORS_ORIGINS: 'http://a.com, http://b.com' });
    expect(env.PORT).toBe(4000);
    expect(env.DB_SYNCHRONIZE).toBe(true);
    expect(env.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
  });

  it('exige un JWT_SECRET de al menos 32 caracteres', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('exige la clave de alta de administradores', () => {
    expect(() => validateEnv({ ...base, ADMIN_REGISTRATION_KEY: undefined })).toThrow(/ADMIN_REGISTRATION_KEY/);
  });

  it('rechaza un puerto fuera de rango', () => {
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('en producción no permite synchronize ni el seed automático', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', DB_SYNCHRONIZE: 'true' })).toThrow(/DB_SYNCHRONIZE/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', SEED_ON_BOOT: 'true' })).toThrow(/SEED_ON_BOOT/);
  });

  describe('en producción', () => {
    const prod = {
      ...base,
      NODE_ENV: 'production',
      JWT_SECRET: 'k8Zp2vQ9xLw4TnR7bYc1dFg6HjM3sUa0EeIoXz5',
      ADMIN_REGISTRATION_KEY: 'alta-9fT2qLmX',
      DB_PASSWORD: 'Pw-real-8sK2',
      CORS_ORIGINS: 'https://portal.ejemplo.com',
      CV_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    };

    it('acepta una configuración completa', () => {
      expect(validateEnv(prod).NODE_ENV).toBe('production');
    });

    it.each(['JWT_SECRET', 'ADMIN_REGISTRATION_KEY', 'DB_PASSWORD'])('rechaza el valor de ejemplo de %s', (key) => {
      expect(() => validateEnv({ ...prod, [key]: 'cambiar-por-un-valor-de-ejemplo-largo-1234' })).toThrow(new RegExp(`${key}.*ejemplo`));
    });

    it('en desarrollo sí deja usar los valores de ejemplo del .env.example', () => {
      expect(() => validateEnv({ ...base, JWT_SECRET: 'cambiar-por-un-secreto-largo-de-al-menos-32-caracteres' })).not.toThrow();
    });

    it('exige que todos los orígenes del front sean https', () => {
      expect(() => validateEnv({ ...prod, CORS_ORIGINS: 'https://a.com,http://b.com' })).toThrow(/CORS_ORIGINS.*https/);
      expect(() => validateEnv({ ...prod, CORS_ORIGINS: undefined })).toThrow(/CORS_ORIGINS.*https/);
    });

    it('en desarrollo acepta orígenes http', () => {
      expect(validateEnv({ ...base, CORS_ORIGINS: 'http://localhost:4200' }).corsOrigins).toEqual(['http://localhost:4200']);
    });
  });

  it('si RENAPER está activo exige sus credenciales', () => {
    expect(() => validateEnv({ ...base, RENAPER_ENABLED: 'true' })).toThrow(/RENAPER_BASE_URL/);
    expect(
      validateEnv({
        ...base,
        RENAPER_ENABLED: 'true',
        RENAPER_BASE_URL: 'https://renaper.example',
        RENAPER_CLIENT_ID: 'id',
        RENAPER_CLIENT_SECRET: 'secret',
      }).RENAPER_ENABLED,
    ).toBe(true);
  });
});
