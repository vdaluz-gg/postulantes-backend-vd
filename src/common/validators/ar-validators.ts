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

/** Nombre y apellido: al menos dos palabras; solo letras, espacios, apóstrofos y guiones. */
export function validateFullName(value: unknown): ValidationOutcome {
  const v = text(value);
  if (!v) return fail('required');
  if (!/^[\p{L}][\p{L}' -]*$/u.test(v)) return fail('invalidChars');
  return v.split(/\s+/).length < 2 ? fail('missingLastName') : OK;
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
