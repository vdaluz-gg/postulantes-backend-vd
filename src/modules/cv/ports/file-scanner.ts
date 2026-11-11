export interface ScanInput {
  readonly buffer: Buffer;
  /** Nombre original ya depurado (sin carpetas ni caracteres de control). */
  readonly fileName: string;
}

export interface ScanResult {
  readonly clean: boolean;
  /** Nombre de la amenaza detectada; es solo para el log, no se le muestra a quien sube el archivo. */
  readonly threat?: string;
}

/**
 * Puerto del análisis de archivos (antivirus) que corre antes de guardar un CV. Hoy no hay ninguno configurado
 * (NoopFileScanner); la versión real (por ejemplo, ClamAV) cumple este puerto sin tocar el servicio. Debe lanzar un
 * error si no pudo analizar el archivo: en ese caso el archivo NO se acepta (falla cerrado).
 */
export interface FileScanner {
  scan(input: ScanInput): Promise<ScanResult>;
}

export const FILE_SCANNER = Symbol('FILE_SCANNER');
