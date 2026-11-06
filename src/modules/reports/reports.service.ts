import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { APPLICATION_STATUSES, Application, ApplicationStatus } from '../applications/entities/application.entity';
import { CANDIDATE_CHANNELS, CandidateChannel } from '../candidates/entities/candidate.entity';
import { ApplicationsReportDto, ApplicationsReportQueryDto } from './dto/reports.dto';

const TOP_OFFERS = 10;
const DAY_MS = 86_400_000;

/** Convierte AAAA-MM-DD en el inicio de ese día (UTC); rechaza fechas que no existen (2026-13-45). */
function parseDay(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new BadRequestException(`Fecha inválida: ${value}`);
  return d;
}

const zeroed = <K extends string>(keys: readonly K[]): Record<K, number> => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

@Injectable()
export class ReportsService {
  constructor(@InjectRepository(Application) private readonly applications: Repository<Application>) {}

  private scoped(query: ApplicationsReportQueryDto): SelectQueryBuilder<Application> {
    const qb = this.applications.createQueryBuilder('a');
    const from = query.from ? parseDay(query.from) : null;
    const to = query.to ? parseDay(query.to) : null;
    if (from && to && from > to) throw new BadRequestException('"from" no puede ser posterior a "to"');
    if (from) qb.andWhere('a.createdAt >= :from', { from });
    if (to) qb.andWhere('a.createdAt < :toExclusive', { toExclusive: new Date(to.getTime() + DAY_MS) });
    return qb;
  }

  /** Números para el tablero de RyS (los consume Tableau): sin datos personales, solo agregados. */
  async applicationsReport(query: ApplicationsReportQueryDto): Promise<ApplicationsReportDto> {
    const [statusRows, channelRows, offerRows] = await Promise.all([
      this.scoped(query).select('a.status', 'key').addSelect('COUNT(*)', 'n').groupBy('a.status').getRawMany<{ key: ApplicationStatus; n: string }>(),
      this.scoped(query)
        .innerJoin('a.candidate', 'c')
        .select('c.channel', 'key')
        .addSelect('COUNT(*)', 'n')
        .groupBy('c.channel')
        .getRawMany<{ key: CandidateChannel; n: string }>(),
      this.scoped(query)
        .innerJoin('a.jobOffer', 'o')
        .select('o.code', 'code')
        .addSelect('o.title', 'title')
        .addSelect('COUNT(*)', 'n')
        .groupBy('o.code')
        .addGroupBy('o.title')
        .orderBy('COUNT(*)', 'DESC')
        .addOrderBy('o.code', 'ASC')
        .limit(TOP_OFFERS)
        .getRawMany<{ code: string; title: string; n: string }>(),
    ]);

    const byStatus = zeroed(APPLICATION_STATUSES);
    for (const r of statusRows) byStatus[r.key] = Number(r.n);
    const byChannel = zeroed(CANDIDATE_CHANNELS);
    for (const r of channelRows) byChannel[r.key] = Number(r.n);

    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    return {
      total,
      byStatus,
      byChannel,
      hired: byStatus.hired,
      hireRate: total ? Math.round((byStatus.hired / total) * 100) / 100 : 0,
      topOffers: offerRows.map((r) => ({ code: r.code, title: r.title, applications: Number(r.n) })),
    };
  }
}
