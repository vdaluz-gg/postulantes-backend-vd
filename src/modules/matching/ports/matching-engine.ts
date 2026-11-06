import { MatchCandidate, MatchOffer, MatchScore } from '../match-scoring';

export interface MatchPoolMember extends MatchCandidate {
  readonly id: string;
}

export interface ScoredMember extends MatchScore {
  readonly id: string;
}

/**
 * Puerto del motor de matching. Hoy lo cumple uno de reglas (zona, puesto, identidad y CV); la versión de IA
 * (Claude en AWS, "matching con IA" del Portal de Talento) lo reemplaza sin tocar el servicio ni el controlador.
 * Devuelve un puntaje de 0 a 100 por cada integrante del pool; el servicio ordena y recorta.
 */
export interface MatchingEngine {
  rank(offer: MatchOffer, pool: readonly MatchPoolMember[]): Promise<ScoredMember[]>;
}

export const MATCHING_ENGINE = Symbol('MATCHING_ENGINE');
