import { CvExtractedData } from '../entities/cv-document.entity';

export interface CvReadInput {
  readonly buffer: Buffer;
  readonly mimeType: string;
  readonly fileName: string;
}

/**
 * Puerto del lector de CV. Hoy lo cumple `TextCvReader` (texto del archivo + reglas); una versión con IA puede
 * reemplazarlo sin que cambie el servicio ni el controlador. Si el archivo no tiene datos legibles devuelve {}
 * (el formulario queda para completar a mano); lanza un error solo si falla el lector o su proveedor.
 */
export interface CvReader {
  read(input: CvReadInput): Promise<CvExtractedData>;
}

export const CV_READER = Symbol('CV_READER');
