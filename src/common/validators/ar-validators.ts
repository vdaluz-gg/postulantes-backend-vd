/**
 * Reglas de validación de los datos del postulante. Son funciones puras: las usan los decoradores de los DTO
 * y el endpoint de validación campo por campo. Replican las reglas del formulario del front para que ambos
 * lados respondan lo mismo ante el mismo dato.
 */

export type ValidationCode = 'required' | 'invalid' | 'invalidChars' | 'missingLastName';

export type ValidationOutcome = { readonly valid: true } | { readonly valid: false; readonly code: ValidationCode };

const OK: ValidationOutcome = { valid: true };
const fail = (code: ValidationCode): ValidationOutcome => ({ valid: false, code });

const digitsOf = (value: unknown): string => String(value ?? '').replace(/\D/g, '');
const text = (value: unknown): string => String(value ?? '').trim();

const NAME_CHARS = /^[\p{L}][\p{L}' -]*$/u;

/** Largo máximo del nombre y del apellido, cada uno por separado. */
export const NAME_PART_MAX_LENGTH = 80;

/** Nombre y apellido: al menos dos palabras; solo letras, espacios, apóstrofos y guiones. */
export function validateFullName(value: unknown): ValidationOutcome {
  const v = text(value);
  if (!v) return fail('required');
  if (!NAME_CHARS.test(v)) return fail('invalidChars');
  return v.split(/\s+/).length < 2 ? fail('missingLastName') : OK;
}

/** Nombre o apellido por separado: solo letras, espacios, apóstrofos y guiones; hasta 80 caracteres. */
export function validateName(value: unknown): ValidationOutcome {
  const v = text(value);
  if (!v) return fail('required');
  if (!NAME_CHARS.test(v)) return fail('invalidChars');
  return v.length > NAME_PART_MAX_LENGTH ? fail('invalid') : OK;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mail con formato usual (no verifica que el buzón exista). */
export function validateEmail(value: unknown): ValidationOutcome {
  const v = text(value);
  if (!v) return fail('required');
  return v.length <= 254 && EMAIL.test(v) ? OK : fail('invalid');
}

/** DNI argentino: 7 u 8 dígitos; acepta puntos y espacios. */
export function validateDni(value: unknown): ValidationOutcome {
  const v = text(value);
  if (!v) return fail('required');
  if (!/^[\d.\s]+$/.test(v)) return fail('invalid');
  const n = digitsOf(v).length;
  return n === 7 || n === 8 ? OK : fail('invalid');
}

/** Deja solo los dígitos: 38.412.907 → 38412907. */
export const normalizeDni = (value: unknown): string => digitsOf(value);

/** Formatea con puntos de miles: 38412907 → 38.412.907. */
export function formatDni(value: unknown): string {
  const d = digitsOf(value);
  return d ? Number(d).toLocaleString('es-AR') : '';
}

/** Celular local de 10 dígitos (código de área + número) sin 0 ni +54 9. Null si no se puede interpretar. */
function localMobile(value: unknown): string | null {
  const raw = text(value);
  if (!/^[+\d\s()-]+$/.test(raw)) return null;
  let d = digitsOf(raw);
  if (d.startsWith('54')) d = d.slice(2).replace(/^9/, '');
  d = d.replace(/^0/, '');
  return d.length === 10 ? d : null;
}

/** Celular argentino para WhatsApp: 10 dígitos con código de área, con o sin +54 9 o 0 adelante. */
export function validateWhatsapp(value: unknown): ValidationOutcome {
  if (!text(value)) return fail('required');
  return localMobile(value) ? OK : fail('invalid');
}

/** Formato internacional de WhatsApp: 11 5555-0142 → +5491155550142. Devuelve '' si no es válido. */
export function normalizeWhatsapp(value: unknown): string {
  const local = localMobile(value);
  return local ? `+549${local}` : '';
}

/** Prefijos de CUIL de personas (20, 23, 24, 27). Los de empresas (30, 33, 34) no son un CUIL personal. */
const CUIL_PERSON_PREFIXES = new Set(['20', '23', '24', '27']);
const CUIL_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Dígito verificador (módulo 11) de los 10 primeros dígitos; null si daría 10, que no es válido. */
function cuilCheckDigit(first10: string): number | null {
  const sum = CUIL_WEIGHTS.reduce((acc, w, i) => acc + w * Number(first10[i]), 0);
  const check = 11 - (sum % 11);
  if (check === 11) return 0;
  return check === 10 ? null : check;
}

/** CUIL de una persona: 11 dígitos (con o sin guiones o espacios), prefijo 20/23/24/27 y verificador correcto. */
export function validateCuil(value: unknown): ValidationOutcome {
  const v = text(value);
  if (!v) return fail('required');
  if (!/^[\d\s-]+$/.test(v)) return fail('invalid');
  const d = digitsOf(v);
  if (d.length !== 11 || !CUIL_PERSON_PREFIXES.has(d.slice(0, 2))) return fail('invalid');
  return cuilCheckDigit(d.slice(0, 10)) === Number(d[10]) ? OK : fail('invalid');
}

/** Deja solo los dígitos: 27-40123456-5 → 27401234565. */
export const normalizeCuil = (value: unknown): string => digitsOf(value);

/** Con guiones: 27401234565 → 27-40123456-5. Devuelve '' si no tiene 11 dígitos. */
export function formatCuil(value: unknown): string {
  const d = digitsOf(value);
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : '';
}

/** Los 8 dígitos del medio del CUIL son el DNI (con ceros a la izquierda si tiene 7 dígitos). */
export const cuilMatchesDni = (cuil: unknown, dni: unknown): boolean => digitsOf(cuil).slice(2, 10) === digitsOf(dni).padStart(8, '0');
