/** Puerto de almacenamiento de archivos (CV). Hoy disco local; mañana puede ser S3/Blob sin tocar el servicio. */
export interface FileStorage {
  save(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
