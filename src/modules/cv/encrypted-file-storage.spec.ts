import { randomBytes } from 'crypto';
import { EncryptedFileStorage } from './encrypted-file-storage';
import { FileStorage } from './ports/file-storage';

/** Almacenamiento en memoria: lo que guarda es exactamente lo que vería quien robe el disco. */
class MemoryStorage implements FileStorage {
  readonly files = new Map<string, Buffer>();
  async save(key: string, content: Buffer): Promise<void> {
    this.files.set(key, content);
  }
  async read(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) throw new Error('no existe');
    return file;
  }
  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
}

const KEY = randomBytes(32);
const CV = Buffer.from('%PDF-1.4\nMartina Rodríguez · DNI 38412907 · martina@ejemplo.com');

describe('EncryptedFileStorage', () => {
  let inner: MemoryStorage;
  let storage: EncryptedFileStorage;

  beforeEach(() => {
    inner = new MemoryStorage();
    storage = new EncryptedFileStorage(inner, KEY);
  });

  it('guarda y devuelve el mismo archivo', async () => {
    await storage.save('a.pdf', CV);
    expect(await storage.read('a.pdf')).toEqual(CV);
  });

  it('en el almacenamiento de abajo no queda nada legible del contenido', async () => {
    await storage.save('a.pdf', CV);
    const stored = inner.files.get('a.pdf')!;
    expect(stored.includes('Martina')).toBe(false);
    expect(stored.includes('38412907')).toBe(false);
    expect(stored.includes('%PDF')).toBe(false);
    expect(stored.length).toBeGreaterThan(CV.length);
  });

  it('el mismo contenido guardado dos veces da bytes distintos (cada archivo usa su propio IV)', async () => {
    await storage.save('a.pdf', CV);
    await storage.save('b.pdf', CV);
    expect(inner.files.get('a.pdf')!.equals(inner.files.get('b.pdf')!)).toBe(false);
  });

  it('detecta que el archivo fue modificado', async () => {
    await storage.save('a.pdf', CV);
    const stored = Buffer.from(inner.files.get('a.pdf')!);
    stored[stored.length - 1] ^= 0xff;
    inner.files.set('a.pdf', stored);
    await expect(storage.read('a.pdf')).rejects.toThrow('No se pudo descifrar el archivo');
  });

  it('no sirve con otra clave', async () => {
    await storage.save('a.pdf', CV);
    const other = new EncryptedFileStorage(inner, randomBytes(32));
    await expect(other.read('a.pdf')).rejects.toThrow('No se pudo descifrar el archivo');
  });

  it('un archivo cifrado no se puede hacer pasar por otro: queda atado a su nombre', async () => {
    await storage.save('a.pdf', CV);
    await storage.save('b.pdf', Buffer.from('otro'));
    inner.files.set('b.pdf', inner.files.get('a.pdf')!);
    await expect(storage.read('b.pdf')).rejects.toThrow('No se pudo descifrar el archivo');
  });

  it('rechaza un archivo que no tiene el formato cifrado (por ejemplo, guardado antes de activar el cifrado)', async () => {
    inner.files.set('viejo.pdf', Buffer.from('%PDF-1.4 sin cifrar'));
    await expect(storage.read('viejo.pdf')).rejects.toThrow('No se pudo descifrar el archivo');
    inner.files.set('corto.pdf', Buffer.from([1, 2, 3]));
    await expect(storage.read('corto.pdf')).rejects.toThrow('No se pudo descifrar el archivo');
  });

  it('borra en el almacenamiento de abajo', async () => {
    await storage.save('a.pdf', CV);
    await storage.remove('a.pdf');
    expect(inner.files.size).toBe(0);
  });

  it('exige una clave de 32 bytes', () => {
    expect(() => new EncryptedFileStorage(inner, randomBytes(16))).toThrow(/32 bytes/);
    expect(() => new EncryptedFileStorage(inner, randomBytes(33))).toThrow(/32 bytes/);
  });
});
