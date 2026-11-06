import { Injectable } from '@nestjs/common';
import { MatchOffer, scoreMatch } from './match-scoring';
import { MatchingEngine, MatchPoolMember, ScoredMember } from './ports/matching-engine';

/** Motor de matching por reglas explicables (ver scoreMatch). */
@Injectable()
export class RulesMatchingEngine implements MatchingEngine {
  async rank(offer: MatchOffer, pool: readonly MatchPoolMember[]): Promise<ScoredMember[]> {
    return pool.map((member) => ({ id: member.id, ...scoreMatch(member, offer) }));
  }
}
