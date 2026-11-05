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
