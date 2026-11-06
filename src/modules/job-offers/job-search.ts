/** Datos de una oferta sobre los que se busca texto. */
export interface SearchableOffer {
  readonly title: string;
  readonly description: string;
  readonly area: string;
  readonly zone: string;
  readonly requirements: readonly string[];
}

export interface SearchResult<T> {
  /** Consulta tal como la escribió la persona (vacía: todas las ofertas). */
  readonly query: string;
  readonly items: readonly T[];
  /** false cuando ninguna oferta coincide y se devuelven todas. */
  readonly matched: boolean;
}

/** Palabras que no ayudan a encontrar el tipo de trabajo (mismas que usa el front). */
const STOPWORDS = new Set(['algo', 'trabajo', 'empleo', 'cerca', 'busco', 'quiero', 'para', 'con', 'una', 'uno', 'del', 'las', 'los', 'que', 'por', 'mas']);

export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const termsOf = (query: string): string[] =>
  normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

const searchableText = (o: SearchableOffer): string =>
  normalizeText([o.title, o.description, o.area, o.zone, ...o.requirements].join(' '));

/**
 * Ofertas que comparten alguna palabra con la consulta (puesto, descripción, rubro, zona o requisitos),
 * de más a menos coincidencias. Sin consulta devuelve todas; sin coincidencias, también todas (matched=false).
 * Es el mismo criterio que usa el buscador del front, para que el texto libre dé lo mismo en ambos lados.
 */
export function searchOffers<T extends SearchableOffer>(query: string, offers: readonly T[]): SearchResult<T> {
  const trimmed = query.trim();
  const words = termsOf(trimmed);
  if (!words.length) return { query: trimmed, items: offers, matched: true };

  const hits = offers
    .map((offer, order) => {
      const text = searchableText(offer);
      return { offer, order, score: words.filter((w) => text.includes(w)).length };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((h) => h.offer);

  return hits.length ? { query: trimmed, items: hits, matched: true } : { query: trimmed, items: offers, matched: false };
}
