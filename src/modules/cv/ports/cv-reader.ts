import { CvExtractedData } from '../entities/cv-document.entity';

export interface CvReadInput {
  readonly buffer: Buffer;
  readonly mimeType: string;
  readonly fileName: string;
}

/**
 * Puerto del lector de CV con IA. Hoy lo cumple un mock; la versión real llamará al servicio de IA sin que
 * cambie el servicio ni el controlador. Debe lanzar un error si no puede leer el archivo.
 */
export interface CvReader {
  read(input: CvReadInput): Promise<CvExtractedData>;
}

export const CV_READER = Symbol('CV_READER');
