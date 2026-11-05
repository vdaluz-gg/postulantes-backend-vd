import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { FileStorage } from './ports/file-storage';

/** Guarda los archivos en una carpeta local. La clave la genera el servidor; igual se valida contra path traversal. */
@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  private pathFor(key: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error('Clave de archivo inválida');
    return join(this.root, key);
  }

  async save(key: string, content: Buffer): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(this.pathFor(key), content, { flag: 'wx' });
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.pathFor(key), { force: true });
  }
}
