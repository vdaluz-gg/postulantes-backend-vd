/**
 * Reglas de la configuración de los portales que edita el backoffice del front (campos, documentos, avisos,
 * canales y textos de cada público). Funciones puras: las usan el servicio y sus tests.
 */

export const AUDIENCES = ['postulantes', 'clientes', 'colaboradores'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const FIELD_TYPES = ['text', 'email', 'tel', 'number', 'date', 'textarea', 'select', 'chips', 'switch'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Sección del público postulantes con el formulario de postulación de la portada. */
export const APPLICATION_SECTION = 'application';

/** Datos sin los que no se puede registrar una postulación: no se pueden ocultar, borrar ni volver opcionales. */
export const CORE_APPLICATION_FIELDS = ['firstName', 'lastName', 'email', 'dni', 'whatsapp'] as const;

/**
 * Campos propios del formulario: viajan como datos del postulante, no como respuestas extra. Incluye
 * `fullName` para que una configuración guardada antes de separar nombre y apellido no lo vuelva una respuesta.
 */
export const BUILT_IN_APPLICATION_FIELDS: readonly string[] = [...CORE_APPLICATION_FIELDS, 'zone', 'position', 'cuil', 'fullName'];

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldRule {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  visible: boolean;
  readonly: boolean;
  options?: FieldOption[];
  validation?: { min?: number; max?: number; maxLength?: number; message?: string };
}

export type AnswerValue = string | number | boolean | string[];

/** Respuesta a un campo agregado desde el backoffice. Se guarda con la etiqueta que tenía al postularse. */
export interface ApplicationAnswer {
  id: string;
  label: string;
  value: AnswerValue;
}

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,59}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 100;
const MAX_FREE_TEXT = 2000;
/** Largo máximo de cada texto de un campo. */
const FIELD_TEXT_LIMITS: Record<string, number> = { label: 120, placeholder: 160, help: 300 };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isList = (v: unknown): v is unknown[] => Array.isArray(v) && v.length <= MAX_ITEMS;
const tooLong = (text: string) => `El texto «${text.slice(0, 24)}…» es demasiado largo.`;

/** Primer texto (en cualquier nivel) que supera el largo permitido. */
function longText(value: unknown, max: number): string | null {
  if (typeof value === 'string') return value.length > max ? value : null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = longText(v, max);
      if (found) return found;
    }
  } else if (isObject(value)) {
    for (const v of Object.values(value)) {
      const found = longText(v, max);
      if (found) return found;
    }
  }
  return null;
}

function fieldProblem(f: unknown, sectionTitle: string): string | null {
  if (!isObject(f)) return `Hay un campo inválido en «${sectionTitle}».`;
  if (typeof f.id !== 'string' || !ID_PATTERN.test(f.id)) return `La clave «${String(f.id)}» no es válida.`;
  if (typeof f.label !== 'string' || !f.label.trim()) return `Hay un campo sin etiqueta en «${sectionTitle}».`;
  if (!FIELD_TYPES.includes(f.type as FieldType)) return `El campo «${f.label}» tiene un tipo que no existe.`;
  if (['required', 'visible', 'readonly'].some((k) => typeof f[k] !== 'boolean')) return `El campo «${f.label}» no es válido.`;
  for (const [key, max] of Object.entries(FIELD_TEXT_LIMITS)) {
    if (f[key] !== undefined && typeof f[key] !== 'string') return `El campo «${f.label}» no es válido.`;
    const long = longText(f[key], max);
    if (long) return tooLong(long);
  }
  if (f.options !== undefined && (!isList(f.options) || !f.options.every((o) => isObject(o) && typeof o.value === 'string' && typeof o.label === 'string'))) {
    return `Las opciones de «${f.label}» no son válidas.`;
  }
  if (f.validation !== undefined && !isObject(f.validation)) return `La validación de «${f.label}» no es válida.`;
  const long = longText(f.options, 120) ?? longText(f.validation, 300);
  return long ? tooLong(long) : null;
}

function audienceProblem(name: Audience, a: unknown): string | null {
  const lists = ['sections', 'documents', 'alerts', 'channels', 'copy'];
  if (!isObject(a) || !lists.every((k) => isList(a[k]))) return `La configuración de «${name}» no es válida.`;
  for (const s of a.sections as unknown[]) {
    if (!isObject(s) || typeof s.id !== 'string' || !ID_PATTERN.test(s.id) || typeof s.title !== 'string' || !isList(s.fields)) {
      return `Hay una sección inválida en «${name}».`;
    }
    const long = longText(s.title, 120) ?? longText([s.description, s.screen], 500);
    if (long) return tooLong(long);
    for (const f of s.fields) {
      const problem = fieldProblem(f, s.title);
      if (problem) return problem;
    }
  }
  for (const list of lists.slice(1)) {
    for (const item of a[list] as unknown[]) {
      if (!isObject(item) || typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) return `Hay un dato inválido en «${name}».`;
      const long = longText(item, MAX_FREE_TEXT);
      if (long) return tooLong(long);
    }
  }
  return null;
}

/** Campos del formulario de postulación dentro de la configuración (vacío si no está). */
export function applicationFields(audiences: unknown): FieldRule[] {
  const postulantes = isObject(audiences) ? audiences.postulantes : null;
  const sections = isObject(postulantes) && Array.isArray(postulantes.sections) ? postulantes.sections : [];
  const section = sections.find((s) => isObject(s) && s.id === APPLICATION_SECTION) as Json | undefined;
  return section && Array.isArray(section.fields) ? (section.fields as FieldRule[]) : [];
}

/** Primer problema que impide guardar la configuración, o null si está bien. */
export function findConfigProblem(audiences: unknown): string | null {
  for (const name of AUDIENCES) {
    if (!isObject(audiences) || !(name in audiences)) return `La configuración está incompleta: falta «${name}».`;
  }
  for (const name of AUDIENCES) {
    const problem = audienceProblem(name, (audiences as Json)[name]);
    if (problem) return problem;
  }
  const fields = applicationFields(audiences);
  for (const id of CORE_APPLICATION_FIELDS) {
    const f = fields.find((x) => x.id === id);
    if (!f) return `Falta el campo «${id}» en la postulación: el sistema lo necesita.`;
    if (!f.visible || !f.required || f.readonly) {
      return `«${f.label}» lo necesita el sistema para registrar la postulación: dejalo visible y obligatorio.`;
    }
  }
  return null;
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const optionValues = (f: FieldRule) => new Set((f.options ?? []).map((o) => o.value));

/** Valor limpio para el campo, o undefined si no cumple las reglas. */
function cleanValue(f: FieldRule, raw: unknown): AnswerValue | undefined {
  const rules = f.validation ?? {};
  switch (f.type) {
    case 'switch':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'number': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return undefined;
      if ((rules.min !== undefined && n < rules.min) || (rules.max !== undefined && n > rules.max)) return undefined;
      return n;
    }
    case 'select':
      return typeof raw === 'string' && optionValues(f).has(raw) ? raw : undefined;
    case 'chips': {
      const values = optionValues(f);
      if (!Array.isArray(raw) || raw.length > values.size || !raw.every((v) => typeof v === 'string' && values.has(v))) return undefined;
      return [...new Set(raw as string[])];
    }
    default: {
      if (typeof raw !== 'string') return undefined;
      const text = raw.trim();
      const max = rules.maxLength ?? (f.type === 'textarea' ? MAX_FREE_TEXT : 200);
      if (text.length > Math.min(max, MAX_FREE_TEXT)) return undefined;
      if (f.type === 'email' && !EMAIL_PATTERN.test(text)) return undefined;
      if (f.type === 'date' && (!DATE_PATTERN.test(text) || Number.isNaN(Date.parse(text)))) return undefined;
      return text;
    }
  }
}

/**
 * Revisa las respuestas a los campos agregados desde el backoffice contra la configuración publicada.
 * Se descartan las claves que no son de esos campos (o que están ocultos o son de solo lectura). Las
 * expresiones regulares de formato las aplica el formulario: el servidor no ejecuta patrones escritos a mano.
 */
export function checkAnswers(fields: readonly FieldRule[], answers: Record<string, unknown>): { answers: ApplicationAnswer[] } | { error: string } {
  const result: ApplicationAnswer[] = [];
  for (const f of fields) {
    if (!f.visible || f.readonly || BUILT_IN_APPLICATION_FIELDS.includes(f.id)) continue;
    const raw = Object.prototype.hasOwnProperty.call(answers, f.id) ? answers[f.id] : undefined;
    const missing = isEmpty(raw) || (f.type === 'switch' && f.required && raw === false);
    if (missing) {
      if (f.required) return { error: `Completá «${f.label}».` };
      if (isEmpty(raw)) continue;
    }
    const value = cleanValue(f, raw);
    if (value === undefined) return { error: f.validation?.message?.trim() || `Revisá «${f.label}».` };
    if (value === '') continue;
    result.push({ id: f.id, label: f.label, value });
  }
  return { answers: result };
}
