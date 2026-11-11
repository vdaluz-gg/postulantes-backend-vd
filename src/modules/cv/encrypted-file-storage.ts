import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { FileStorage } from './ports/file-storage';

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

/**
 * Cifra los archivos antes de pasárselos al almacenamiento real (disco, S3…): quien robe el disco o un backup no
 * puede leer los CV. AES-256-GCM, con un IV nuevo por archivo y el nombre del archivo como dato autenticado, así
 * que un archivo modificado o intercambiado por otro no se puede leer.
 *
 * Formato guardado: [versión 1 byte][IV 12 bytes][tag 16 bytes][contenido cifrado].
 * La clave es de 32 bytes y vive en CV_ENCRYPTION_KEY; si se pierde, los CV guardados no se pueden recuperar.
 */
export class EncryptedFileStorage implements FileStorage {
  constructor(
    private readonly inner: FileStorage,
    private readonly key: Buffer,
  ) {
    if (key.length !== 32) throw new Error('La clave de cifrado debe tener 32 bytes');
  }

  async save(name: string, content: Buffer): Promise<void> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(name));
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
    await this.inner.save(name, Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), encrypted]));
  }

  async read(name: string): Promise<Buffer> {
    const stored = await this.inner.read(name);
    try {
      if (stored.length < HEADER_BYTES || stored[0] !== VERSION) throw new Error('formato desconocido');
      const iv = stored.subarray(1, 1 + IV_BYTES);
      const tag = stored.subarray(1 + IV_BYTES, HEADER_BYTES);
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(Buffer.from(name));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(stored.subarray(HEADER_BYTES)), decipher.final()]);
    } catch {
      // Sin detalle: no hay que dar pistas de por qué falló (clave incorrecta, archivo alterado, formato viejo).
      throw new Error('No se pudo descifrar el archivo');
    }
  }

  remove(name: string): Promise<void> {
    return this.inner.remove(name);
  }
}
