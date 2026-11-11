import { Injectable } from '@nestjs/common';
import { FileScanner, ScanResult } from './ports/file-scanner';

/**
 * Sin antivirus: da todo por limpio. Es el valor de local. Antes de recibir CV de personas reales conviene
 * reemplazarlo por un analizador (ver el puerto FileScanner).
 */
@Injectable()
export class NoopFileScanner implements FileScanner {
  async scan(): Promise<ScanResult> {
    return { clean: true };
  }
}
