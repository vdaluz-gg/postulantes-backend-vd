export interface CvFileType {
  readonly extension: 'pdf' | 'doc' | 'docx';
  readonly mimeType: string;
}

/** Tamaño máximo del CV (igual que en el front). */
export const CV_MAX_BYTES = 5 * 1024 * 1024;

const startsWith = (buf: Buffer, bytes: number[]): boolean => buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);

/**
 * Detecta el tipo real del archivo mirando su contenido (firma), no el nombre ni el Content-Type que manda el
 * cliente, que son falsificables. Devuelve null si no es PDF, DOC o DOCX.
 */
export function detectCvType(buf: Buffer): CvFileType | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { extension: 'pdf', mimeType: 'application/pdf' };
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { extension: 'doc', mimeType: 'application/msword' };
  // DOCX es un zip: firma PK + una entrada word/. Un zip cualquiera no pasa.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && buf.includes('word/')) {
    return { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  return null;
}

/** Nombre original apto para guardar como dato: sin carpetas, sin caracteres de control, máximo 255. Nunca se usa como ruta. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return /^\.*$/.test(clean) ? 'cv' : clean;
}
