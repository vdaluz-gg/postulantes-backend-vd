import { readFileSync } from 'fs';
import { join } from 'path';
import { validateEnv } from './env.validation';

/** Lee el .env.example como lo haría `cp .env.example .env`: líneas CLAVE=valor, sin comentarios ni vacías. */
function parseEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

const example = parseEnvFile(join(__dirname, '..', '..', '.env.example'));

describe('.env.example (lo que usa el equipo para probar en local)', () => {
  it('copiado tal cual arranca en local', () => {
    expect(() => validateEnv(example)).not.toThrow();
  });

  it('deja apagado todo lo que endurece el entorno y complicaría probar: nada se activa sin pedirlo', () => {
    const env = validateEnv(example);
    expect(env.NODE_ENV).toBe('development');
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.FORCE_HTTPS).toBe(false);
    expect(env.CAPTCHA_ENABLED).toBe(false);
    expect(env.CV_ENCRYPTION_KEY).toBe('');
    expect(env.CV_CLEANUP_ENABLED).toBe(false);
    expect(env.DB_SSL).toBe(false);
    expect(env.DB_SYNCHRONIZE).toBe(true);
    expect(env.SEED_ON_BOOT).toBe(true);
    expect(env.corsOrigins).toEqual(['http://localhost:4200']);
  });

  it('en producción, en cambio, no pasa tal cual: obliga a completar los valores de ejemplo', () => {
    expect(() => validateEnv({ ...example, NODE_ENV: 'production', DB_SYNCHRONIZE: 'false', SEED_ON_BOOT: 'false' })).toThrow(/ejemplo/);
  });

  it('documenta cada variable nueva de seguridad', () => {
    for (const key of ['TRUST_PROXY', 'FORCE_HTTPS', 'CAPTCHA_ENABLED', 'CV_ENCRYPTION_KEY', 'CV_ORPHAN_TTL_HOURS', 'DB_SSL']) {
      expect(Object.keys(example)).toContain(key);
    }
  });
});
