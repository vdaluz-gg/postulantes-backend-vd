import { distanceKm } from '../../common/utils/geo';
import { normalizeText, termsOf } from '../job-offers/job-search';

export interface MatchCandidate {
  readonly zoneId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly position: string | null;
  readonly identityVerified: boolean;
  readonly hasCv: boolean;
}

export interface MatchOffer {
  readonly zoneId: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly radiusKm: number;
  readonly title: string;
  readonly area: string;
  readonly requirements: readonly string[];
}

export type MatchReason = 'zone' | 'nearby' | 'position' | 'identity' | 'cv';

export interface MatchScore {
  readonly score: number;
  /** Por qué puntúa: la selectora ve qué pesó en la sugerencia. */
  readonly reasons: MatchReason[];
}

/** Pesos de la sugerencia (suman 100). Cambiarlos acá cambia el ranking sin tocar el resto. */
export const MATCH_WEIGHTS = { zone: 40, nearby: 20, position: 40, identity: 10, cv: 10 } as const;

const hasCoords = (p: { latitude: number | null; longitude: number | null }): p is { latitude: number; longitude: number } =>
  p.latitude !== null && p.longitude !== null;

/**
 * Puntaje de afinidad entre un postulante y una oferta (0-100), con reglas simples y explicables:
 * ubicación (misma zona o dentro del radio de la oferta), puesto (palabras en común con título, rubro y
 * requisitos), identidad verificada y CV cargado. Es la versión de reglas del "matching"; la de IA reemplaza
 * al motor completo (ver MatchingEngine) y no a esta función.
 */
export function scoreMatch(c: MatchCandidate, o: MatchOffer): MatchScore {
  let score = 0;
  const reasons: MatchReason[] = [];
  const add = (reason: MatchReason, points: number): void => {
    score += points;
    reasons.push(reason);
  };

  if (c.zoneId && c.zoneId === o.zoneId) add('zone', MATCH_WEIGHTS.zone);
  else if (hasCoords(c) && hasCoords(o) && distanceKm({ lat: c.latitude, lng: c.longitude }, { lat: o.latitude, lng: o.longitude }) <= o.radiusKm) {
    add('nearby', MATCH_WEIGHTS.nearby);
  }

  const wanted = c.position ? termsOf(c.position) : [];
  if (wanted.length) {
    const text = normalizeText([o.title, o.area, ...o.requirements].join(' '));
    const hits = wanted.filter((w) => text.includes(w)).length;
    if (hits) add('position', Math.round((MATCH_WEIGHTS.position * hits) / wanted.length));
  }

  if (c.identityVerified) add('identity', MATCH_WEIGHTS.identity);
  if (c.hasCv) add('cv', MATCH_WEIGHTS.cv);
  return { score, reasons };
}
