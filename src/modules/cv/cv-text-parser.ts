import { formatDni, validateDni, validateEmail, validateFullName } from '../../common/validators/ar-validators';
import { CvExtractedData } from './entities/cv-document.entity';

/**
 * Busca los datos del postulante en el texto de su CV con reglas simples (sin IA): mail, DNI, celular, nombre y
 * apellido y zona. Si un dato no aparece con claridad se omite: nunca se inventa. Lo que devuelve pasa después
 * por las mismas validaciones del formulario.
 */

const NAME_SCAN_LINES = 8;
const MAX_TEXT_CHARS = 200_000;
const ZONE_SCAN_LINES = 15;
const MAX_ZONE_TEXT = 60;

/** Minúsculas y sin acentos, carácter por carácter (mismo largo que el original, así los índices coinciden). */
function fold(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const base = s[i].normalize('NFD')[0] ?? s[i];
    const lower = base.toLowerCase();
    out += lower.length === 1 ? lower : s[i];
  }
  return out;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[\t\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** El renglón y, si el renglón es solo el rótulo, también el siguiente (muchos CV ponen el valor abajo). */
const withNext = (lines: string[], i: number, hasValue: boolean): string => (hasValue ? lines[i] : `${lines[i]} ${lines[i + 1] ?? ''}`);

// ---------------------------------------------------------------------------------------------------------------
// Mail
// ---------------------------------------------------------------------------------------------------------------

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

function findEmail(lines: string[]): string | undefined {
  // Solo las palabras con @ (y de largo razonable): la regex sobre todo el texto podría ser cuadrática.
  for (const word of lines.flatMap((l) => l.split(' '))) {
    if (!word.includes('@') || word.length > 320) continue;
    for (const m of word.matchAll(EMAIL_IN_TEXT)) {
      const email = m[0].replace(/^[._%+-]+/, '').replace(/[.-]+$/, '');
      if (validateEmail(email).valid) return email;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// DNI
// ---------------------------------------------------------------------------------------------------------------

const DNI_LABELLED = /(?<!\p{L})(?:d\.?\s?n\.?\s?i|documento|doc(?=[\s.:#]))\.?[^\d\n]{0,25}?(?<!\d)(\d{1,2}[.\s]?\d{3}[.\s]?\d{3})(?!\d)/iu;
const DNI_DOTTED = /(?<![\d.,$])(?<!\$\s)(\d{1,2}\.\d{3}\.\d{3})(?!\d|[.,]\d)/;
const CUIL = /(?<!\p{L})cui[lt](?!\p{L})[^\d\n]{0,15}\d{2}[-\s.]?(\d{1,2}\.?\d{3}\.?\d{3})[-\s.]?\d(?!\d)/iu;

function findDni(lines: string[]): string | undefined {
  const accept = (raw: string | undefined): string | undefined => (raw && validateDni(raw.replace(/\s/g, '')).valid ? formatDni(raw) : undefined);
  for (let i = 0; i < lines.length; i++) {
    const found = accept(DNI_LABELLED.exec(withNext(lines, i, /\d/.test(lines[i])))?.[1]);
    if (found) return found;
  }
  for (const line of lines) {
    const found = accept(DNI_DOTTED.exec(line)?.[1]);
    if (found) return found;
  }
  for (const line of lines) {
    const found = accept(CUIL.exec(line)?.[1]);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Celular (WhatsApp)
// ---------------------------------------------------------------------------------------------------------------

const PHONE_RUN = /\+?\(?\d[\d ().-]{6,24}\d/g;
const MOBILE_LABEL = /(?<!\p{L})(?:cel|celular|celulares|m[oó]vil|whats\s?app|wsp|wpp)(?!\p{L})/iu;
const PHONE_LABEL = /(?<!\p{L})(?:tel|tels|tel[eé]fono|tel[eé]fonos|contacto)(?!\p{L})/iu;

const validArea = (area: string): boolean => area === '11' || (area.length >= 3 && /^[23]/.test(area));

/** Celular local de 10 dígitos (área + número) o null. Saca +54, 9, 0 y el 15 después del código de área. */
function toLocalMobile(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('54') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) {
    for (const n of [2, 3, 4]) {
      if (d.slice(n, n + 2) === '15' && validArea(d.slice(0, n))) {
        d = d.slice(0, n) + d.slice(n + 2);
        break;
      }
    }
  }
  return d.length === 10 && /^(11|[23])/.test(d) ? d : null;
}

function mobileInLine(line: string): string | null {
  for (const m of line.matchAll(PHONE_RUN)) {
    // Dos números en la misma tira ("11 4444-0101 - 11 5555-0202") se separan antes de probar.
    for (const part of [m[0], ...m[0].split(/\s+[-–]\s+|\s{2,}/)]) {
      const local = toLocalMobile(part);
      if (local) return local;
    }
  }
  return null;
}

const formatMobile = (d: string): string => (d.startsWith('11') ? `11 ${d.slice(2, 6)}-${d.slice(6)}` : `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}`);

function findWhatsapp(lines: string[]): string | undefined {
  for (const label of [MOBILE_LABEL, PHONE_LABEL, null]) {
    for (let i = 0; i < lines.length; i++) {
      if (label && !label.test(lines[i])) continue;
      const local = mobileInLine(lines[i]) ?? (label ? mobileInLine(lines[i + 1] ?? '') : null);
      if (local) return formatMobile(local);
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Nombre y apellido
// ---------------------------------------------------------------------------------------------------------------

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'das', 'do', 'dos', 'di', 'van', 'von']);

/** Palabras de títulos, rótulos y puestos: un renglón que las tiene no es un nombre. Sin acentos y en minúsculas. */
const NOT_NAME_WORDS = new Set(
  (
    'curriculum curricular vitae cv resume datos personales personal perfil profesional experiencia experiencias laboral ' +
    'laborales educacion formacion academica academicos contacto objetivo objetivos resumen habilidades competencias ' +
    'idiomas idioma referencias conocimientos estudios informacion sobre mi mis cursos certificaciones aptitudes ' +
    'logros intereses skills experience education profile summary contact languages references about me details ' +
    'nombre nombres apellido apellidos direccion domicilio telefono celular email mail correo localidad nacionalidad ' +
    'fecha nacimiento estado civil edad dni argentina argentino buenos aires provincia republica calle avenida av ' +
    'barrio ciudad capital federal pagina ' +
    'analista licenciado licenciada licenciatura tecnico tecnica tecnicatura ingeniero ingeniera ingenieria operario ' +
    'operaria vendedor vendedora administrativo administrativa administracion contador contadora estudiante chofer ' +
    'repositor repositora cajero cajera desarrollador desarrolladora disenador disenadora asistente auxiliar gerente ' +
    'supervisor supervisora encargado encargada docente profesor profesora enfermero enfermera abogado abogada ' +
    'recepcionista secretario secretaria mozo moza camarero camarera cocinero cocinera electricista mecanico ' +
    'programador programadora developer manager junior senior trainee pasante ayudante operador operadora atencion ' +
    'cliente clientes ventas logistica deposito recursos humanos marketing sistemas contable comercial gastronomia ' +
    'limpieza seguridad vigilador vigiladora empleado empleada en con para por anos'
  ).split(' '),
);

/** "LUCÍA FERNÁNDEZ" → "Lucía Fernández"; las palabras ya escritas con mayúscula inicial se respetan. */
function fixCase(name: string): string {
  return name
    .split(' ')
    .map((w, i) => {
      const lower = w.toLowerCase();
      const allCaps = w === w.toUpperCase() && w !== lower;
      if (!allCaps && w !== lower) return w;
      if (i > 0 && PARTICLES.has(lower)) return lower;
      return lower.replace(/(^|[-'])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
    })
    .join(' ');
}

function cleanName(raw: string): string | undefined {
  const name = fixCase(
    raw
      .replace(/[’`´]/g, "'")
      .replace(/[.,;:|]+$/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  return validateFullName(name).valid && name.split(' ').length <= 6 ? name : undefined;
}

const FULL_NAME_LABEL = /^(?:(nombres?\s+y\s+apellidos?|nombre\s+completo)|(apellidos?\s+y\s+nombres?))\s*[:\-–]?\s*(.*)$/iu;
const FIRST_NAME_LABEL = /(?<!\p{L})nombres?\s*:\s*([\p{L}'’ -]+?)\s*(?=apellidos?\s*:|[|,;]|$)/iu;
const LAST_NAME_LABEL = /(?<!\p{L})apellidos?\s*:\s*([\p{L}'’ -]+?)\s*(?=nombres?\s*:|[|,;]|$)/iu;

function labelledName(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = FULL_NAME_LABEL.exec(lines[i]);
    if (!m) continue;
    let value = m[3] || lines[i + 1] || '';
    // "Apellido y nombre: Fernández, Lucía" → "Lucía Fernández"
    const comma = /^([^,]+),\s*([^,]+)$/.exec(value);
    if (comma) value = m[2] ? `${comma[2]} ${comma[1]}` : `${comma[1]} ${comma[2]}`;
    const name = cleanName(value);
    if (name) return name;
  }
  let first: string | undefined;
  let last: string | undefined;
  for (let i = 0; i < lines.length && !(first && last); i++) {
    const line = lines[i];
    first ??= FIRST_NAME_LABEL.exec(/nombres?\s*:\s*$/i.test(line) ? `${line} ${lines[i + 1] ?? ''}` : line)?.[1];
    last ??= LAST_NAME_LABEL.exec(/apellidos?\s*:\s*$/i.test(line) ? `${line} ${lines[i + 1] ?? ''}` : line)?.[1];
  }
  return first && last ? cleanName(`${first.trim()} ${last.trim()}`) : undefined;
}

function looksLikeName(line: string, zoneAliases: Set<string>): string | undefined {
  const candidate = line
    .split(/\s*[|•·–—]\s*|\s+-\s+/)[0]
    .replace(/[’`´]/g, "'")
    .replace(/[.,;:]+$/, '')
    .trim();
  if (!/^\p{L}[\p{L}' -]*$/u.test(candidate) || zoneAliases.has(fold(candidate))) return undefined;
  const words = candidate.split(' ');
  if (words.length < 2 || words.length > 5) return undefined;
  if (words.some((w) => NOT_NAME_WORDS.has(fold(w)))) return undefined;
  if (!words.every((w, i) => /^\p{Lu}/u.test(w) || (i > 0 && PARTICLES.has(w)))) return undefined;
  return cleanName(candidate);
}

function findFullName(lines: string[], zoneAliases: Set<string>): { name?: string; line: number } {
  const labelled = labelledName(lines);
  if (labelled) return { name: labelled, line: -1 };
  for (let i = 0; i < Math.min(lines.length, NAME_SCAN_LINES); i++) {
    const name = looksLikeName(lines[i], zoneAliases);
    if (name) return { name, line: i };
  }
  return { line: -1 };
}

// ---------------------------------------------------------------------------------------------------------------
// Zona
// ---------------------------------------------------------------------------------------------------------------

interface ZoneMatcher {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly patterns: ReadonlyArray<RegExp>;
}

/** Formas en que puede aparecer una zona: completa, cada parte de "A / B", lo anterior a la coma y "Gral." = "General". */
function aliasesOf(zone: string): string[] {
  const full = fold(zone).replace(/\s+/g, ' ').trim();
  const aliases = new Set([full, ...full.split(/\s*\/\s*/)]);
  if (full.includes(',')) aliases.add(full.split(',')[0].trim());
  if (full === 'caba') ['ciudad autonoma de buenos aires', 'capital federal'].forEach((a) => aliases.add(a));
  for (const a of [...aliases]) if (/(^|\s)gral\.?\s/.test(a)) aliases.add(a.replace(/(^|\s)gral\.?\s/, '$1general '));
  return [...aliases].filter((a) => a.length >= 3);
}

function zoneMatchers(zoneNames: readonly string[]): ZoneMatcher[] {
  return zoneNames
    .filter((n) => n && n.trim())
    .map((name) => {
      const aliases = aliasesOf(name);
      const patterns = aliases.map(
        (a) => new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(a).replace(/\\\./g, '\\.?').replace(/ /g, '\\s+')}(?![\\p{L}\\d])`, 'u'),
      );
      return { name, aliases, patterns };
    });
}

/** La zona que aparece primero en el renglón (y, si empatan, la de nombre más largo: "Palermo, CABA" antes que "CABA"). */
function zoneInLine(line: string, matchers: ZoneMatcher[], requireCapital: boolean): string | undefined {
  const folded = fold(line);
  let best: { name: string; index: number; length: number } | undefined;
  for (const matcher of matchers) {
    for (const re of matcher.patterns) {
      const m = re.exec(folded);
      if (!m) continue;
      // Fuera de un rótulo se exige mayúscula inicial ("Salta", no "salta"; "Pilar", no "pilar").
      if (requireCapital && !/\p{Lu}/u.test(line[m.index])) continue;
      if (!best || m.index < best.index || (m.index === best.index && m[0].length > best.length)) {
        best = { name: matcher.name, index: m.index, length: m[0].length };
      }
    }
  }
  return best?.name;
}

const ADDRESS_LABEL = /(?<!\p{L})(?:domicilio|direccion|localidad|residencia|barrio|ciudad|zona|partido|ubicacion|vivo en|resido en|reside en)(?!\p{L})/u;
const PLACE_LABEL = /(?<!\p{L})(?:localidad|ciudad|barrio|zona|partido)\s*:\s*(.*)$/iu;

function placeValue(raw: string): string | undefined {
  let value = raw
    .split(/\s+\p{L}+\s*:/u)[0]
    .replace(/[.,;:|-]+$/, '')
    .trim();
  if (!/\p{L}/u.test(value) || value.includes('@') || /\d{5,}/.test(value)) return undefined;
  if (value.length > MAX_ZONE_TEXT) value = value.slice(0, value.lastIndexOf(' ', MAX_ZONE_TEXT)).trim() || value.slice(0, MAX_ZONE_TEXT);
  return value || undefined;
}

function findZone(lines: string[], matchers: ZoneMatcher[], nameLine: number, fullName: string | undefined): string | undefined {
  // Un apellido puede coincidir con una zona ("Moreno", "Pilar"): el renglón del nombre no cuenta.
  const isNameLine = (i: number): boolean =>
    i === nameLine || /nombre|apellido/i.test(lines[i]) || (!!fullName && fold(lines[i]).includes(fold(fullName)));
  for (let i = 0; i < lines.length; i++) {
    if (!ADDRESS_LABEL.test(fold(lines[i]))) continue;
    const zone = zoneInLine(lines[i], matchers, false) ?? (/[:\-–]\s*$/.test(lines[i]) ? zoneInLine(lines[i + 1] ?? '', matchers, false) : undefined);
    if (zone) return zone;
  }
  for (let i = 0; i < Math.min(lines.length, ZONE_SCAN_LINES); i++) {
    if (isNameLine(i)) continue;
    const zone = zoneInLine(lines[i], matchers, true);
    if (zone) return zone;
  }
  for (let i = 0; i < lines.length; i++) {
    const m = PLACE_LABEL.exec(lines[i]);
    if (!m) continue;
    const value = placeValue(m[1] || lines[i + 1] || '');
    if (value) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------

/** Datos del postulante encontrados en el texto del CV. `zoneNames` son las zonas activas (se devuelve el nombre tal cual). */
export function parseCvText(text: string, zoneNames: readonly string[]): CvExtractedData {
  const lines = toLines((text ?? '').slice(0, MAX_TEXT_CHARS));
  if (!lines.length) return {};
  const matchers = zoneMatchers(zoneNames);
  const allAliases = new Set(matchers.flatMap((m) => m.aliases));
  const { name, line: nameLine } = findFullName(lines, allAliases);

  const result: CvExtractedData = {};
  if (name) result.fullName = name;
  const email = findEmail(lines);
  if (email) result.email = email;
  const dni = findDni(lines);
  if (dni) result.dni = dni;
  const whatsapp = findWhatsapp(lines);
  if (whatsapp) result.whatsapp = whatsapp;
  const zone = findZone(lines, matchers, nameLine, name);
  if (zone) result.zone = zone;
  return result;
}
