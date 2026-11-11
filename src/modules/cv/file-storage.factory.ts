import { AppEnv } from '../../config/env.validation';
import { EncryptedFileStorage } from './encrypted-file-storage';
import { LocalFileStorage } from './local-file-storage';
import { FileStorage } from './ports/file-storage';

/**
 * Almacenamiento de los CV según la configuración: carpeta local, cifrada si hay CV_ENCRYPTION_KEY (obligatoria en
 * producción; en local es opcional para poder abrir los archivos a mano). Para pasar a S3/Blob se cambia acá.
 */
export function createFileStorage(env: AppEnv): FileStorage {
  const local = new LocalFileStorage(env.UPLOAD_DIR);
  return env.CV_ENCRYPTION_KEY ? new EncryptedFileStorage(local, Buffer.from(env.CV_ENCRYPTION_KEY, 'base64')) : local;
}
