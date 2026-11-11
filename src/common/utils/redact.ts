/**
 * Reglas para tapar datos personales y secretos en un texto que va a un log. Importa el orden: lo más específico
 * (un token, un CUIL) antes que lo genérico (una cifra de 8 dígitos que puede ser un DNI).
 */
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]'],
  // clave=valor / clave: valor para claves que guardan secretos (incluye "Authorization: Bearer xxx").
  [/\b(password|passwd|pwd|secret|client_secret|token|api[_-]?key|authorization)\b(\s*[=:]\s*)(?:Bearer\s+)?[^\s&,;"')]+/gi, '$1$2[redacted]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\bGG-[2-9A-HJ-NP-Z]{6}\b/g, '[codigo]'],
  [/\+54[\s-]*9?[\s-]*\d{2,4}[\s-]*\d{3,4}[\s-]*\d{4}/g, '[tel]'],
  [/\b\d{2}-?\d{8}-?\d\b/g, '[cuil]'],
  [/\b\d{1,2}\.\d{3}\.\d{3}\b|\b\d{7,8}\b/g, '[dni]'],
];

/**
 * Tapa mails, DNI, CUIL, teléfonos, códigos de seguimiento, tokens y valores de claves. Deja lo que sirve para
 * depurar: el tipo de error, nombres de tablas, ids técnicos (UUID) y direcciones IP.
 */
export function redact(text: string): string {
  return RULES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/** Mensaje de cualquier cosa lanzada, listo para escribir en un log. */
export function errorForLog(error: unknown): string {
  return redact(error instanceof Error ? error.message : String(error));
}
