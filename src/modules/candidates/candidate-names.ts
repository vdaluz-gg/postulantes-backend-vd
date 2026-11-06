/**
 * Nombre y apellido del postulante. Se guardan por separado y, además, el nombre completo (lo usan los
 * resúmenes, el alta en el ERP y los reportes): siempre es "nombre apellido" cuando se conocen los dos.
 * Funciones puras: las usan el servicio de postulantes y el lector de CV.
 */

export interface NameParts {
  firstName: string | null;
  lastName: string | null;
}

export interface CandidateNames extends NameParts {
  fullName: string;
}

const words = (value: string | null | undefined): string[] =>
  (value ?? '').trim().split(/\s+/).filter(Boolean);
const join = (...parts: (string | null | undefined)[]): string => parts.flatMap(words).join(' ');

/**
 * Separa un nombre completo: con 2 palabras, 1 y 1; con 3, las 2 primeras son el nombre y la última el
 * apellido; con 4 o más, 2 de nombre y el resto de apellido. Con una sola palabra no inventa el apellido.
 */
export function splitFullName(fullName: string | null | undefined): NameParts {
  const w = words(fullName);
  if (!w.length) return { firstName: null, lastName: null };
  if (w.length === 1) return { firstName: w[0], lastName: null };
  const firstCount = w.length === 2 ? 1 : 2;
  return { firstName: w.slice(0, firstCount).join(' '), lastName: w.slice(firstCount).join(' ') };
}

/**
 * Nombre, apellido y nombre completo a guardar, o null si lo enviado no toca el nombre.
 * - Nombre y apellido juntos ganan (sobre un nombre completo enviado también).
 * - Si llega el nombre completo (clientes anteriores), se separa.
 * - Al editar (`current`), una sola parte reemplaza esa parte y conserva la otra.
 */
export function resolveCandidateNames(
  input: { firstName?: string | null; lastName?: string | null; fullName?: string | null },
  current?: { firstName: string | null; lastName: string | null; fullName: string },
): CandidateNames | null {
  const firstName = join(input.firstName) || null;
  const lastName = join(input.lastName) || null;
  const fullName = join(input.fullName);

  if (firstName && lastName) return { firstName, lastName, fullName: join(firstName, lastName) };
  if (fullName) return { ...splitFullName(fullName), fullName };
  if (current && (firstName || lastName)) {
    const known = current.firstName && current.lastName ? current : splitFullName(current.fullName);
    const parts = { firstName: firstName ?? known.firstName, lastName: lastName ?? known.lastName };
    return { ...parts, fullName: join(parts.firstName, parts.lastName) };
  }
  return null;
}
