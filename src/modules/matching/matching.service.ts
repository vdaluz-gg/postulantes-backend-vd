import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Application } from '../applications/entities/application.entity';
import { Candidate } from '../candidates/entities/candidate.entity';
import { CvDocument } from '../cv/entities/cv-document.entity';
import { JobOffer } from '../job-offers/entities/job-offer.entity';
import { MatchesDto, MatchesQueryDto } from './dto/matches.dto';
import { MATCHING_ENGINE, MatchingEngine, MatchPoolMember } from './ports/matching-engine';

/** Tope de postulantes que se evalúan por pedido: los más recientes. Con volumen real, el motor filtra en SQL. */
export const POOL_LIMIT = 1000;

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(JobOffer) private readonly offers: Repository<JobOffer>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(CvDocument) private readonly cvs: Repository<CvDocument>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @Inject(MATCHING_ENGINE) private readonly engine: MatchingEngine,
  ) {}

  /** Postulantes sugeridos para una oferta, de mayor a menor afinidad. */
  async suggestCandidates(offerId: string, query: MatchesQueryDto): Promise<MatchesDto> {
    const offer = await this.offers.findOneBy({ id: offerId });
    if (!offer) throw new NotFoundException('Oferta no encontrada');

    // Quedan afuera quienes ya son colaboradores y quienes no pasaron la validación de identidad.
    const people = await this.candidates
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.zone', 'z')
      .where("c.profileStage = 'applicant'")
      .andWhere("c.identityStatus <> 'rejected'")
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .take(POOL_LIMIT)
      .getMany();
    if (!people.length) return { offer: { id: offer.id, code: offer.code, title: offer.title }, items: [] };

    const ids = people.map((p) => p.id);
    const [withCv, applied] = await Promise.all([
      this.cvs.find({ where: { candidateId: In(ids) }, select: { candidateId: true } }),
      this.applications.find({ where: { jobOfferId: offer.id, candidateId: In(ids) }, select: { candidateId: true } }),
    ]);
    const hasCv = new Set(withCv.map((d) => d.candidateId));
    const alreadyApplied = new Set(applied.map((a) => a.candidateId));

    const pool: MatchPoolMember[] = people.map((p) => ({
      id: p.id,
      zoneId: p.zoneId,
      latitude: p.latitude,
      longitude: p.longitude,
      position: p.position,
      identityVerified: p.identityStatus === 'verified',
      hasCv: hasCv.has(p.id),
    }));
    const byId = new Map(people.map((p, order) => [p.id, { person: p, order }]));

    const ranked = (await this.engine.rank(offer, pool))
      .filter((r) => r.score > 0 && r.score >= query.minScore)
      // Desempate estable: primero el más reciente (el pool ya viene ordenado así).
      .sort((a, b) => b.score - a.score || byId.get(a.id)!.order - byId.get(b.id)!.order)
      .slice(0, query.limit);

    return {
      offer: { id: offer.id, code: offer.code, title: offer.title },
      items: ranked.map((r) => {
        const { person } = byId.get(r.id)!;
        return {
          candidate: {
            id: person.id,
            fullName: person.fullName,
            zone: person.zone?.name ?? null,
            position: person.position,
            identityStatus: person.identityStatus,
          },
          score: r.score,
          reasons: r.reasons,
          alreadyApplied: alreadyApplied.has(person.id),
        };
      }),
    };
  }
}
