import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppEnv } from '../../config/env.validation';
import { EncryptedFileStorage } from './encrypted-file-storage';
import { createFileStorage } from './file-storage.factory';
import { LocalFileStorage } from './local-file-storage';

describe('createFileStorage', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'cv-storage-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const env = (extra: Partial<AppEnv>): AppEnv => ({ UPLOAD_DIR: dir, CV_ENCRYPTION_KEY: '', ...extra }) as AppEnv;

  it('sin clave (local) guarda los archivos tal cual, como hasta ahora', async () => {
    const storage = createFileStorage(env({}));
    expect(storage).toBeInstanceOf(LocalFileStorage);
    await storage.save('a.pdf', Buffer.from('%PDF-1.4 hola'));
    expect((await fs.readFile(join(dir, 'a.pdf'))).toString()).toBe('%PDF-1.4 hola');
  });

  it('con CV_ENCRYPTION_KEY los archivos quedan cifrados en disco y se leen de vuelta', async () => {
    const storage = createFileStorage(env({ CV_ENCRYPTION_KEY: randomBytes(32).toString('base64') }));
    expect(storage).toBeInstanceOf(EncryptedFileStorage);
    await storage.save('a.pdf', Buffer.from('%PDF-1.4 hola'));
    expect((await fs.readFile(join(dir, 'a.pdf'))).includes('hola')).toBe(false);
    expect((await storage.read('a.pdf')).toString()).toBe('%PDF-1.4 hola');
  });
});

describe('LocalFileStorage.read', () => {
  it('devuelve lo guardado y rechaza claves con rutas', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'cv-local-'));
    try {
      const storage = new LocalFileStorage(dir);
      await storage.save('b.pdf', Buffer.from('contenido'));
      expect((await storage.read('b.pdf')).toString()).toBe('contenido');
      await expect(storage.read('../b.pdf')).rejects.toThrow('Clave de archivo inválida');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
