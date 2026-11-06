import { IsOptional, Matches } from 'class-validator';
import { CandidateChannel } from '../../candidates/entities/candidate.entity';
import { ApplicationStatus } from '../../applications/entities/application.entity';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ApplicationsReportQueryDto {
  /** Desde (inclusive), AAAA-MM-DD, en UTC. */
  @IsOptional()
  @Matches(DAY, { message: 'from debe tener el formato AAAA-MM-DD' })
  from?: string;

  /** Hasta (inclusive), AAAA-MM-DD, en UTC. */
  @IsOptional()
  @Matches(DAY, { message: 'to debe tener el formato AAAA-MM-DD' })
  to?: string;
}

export interface ApplicationsReportDto {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  byChannel: Record<CandidateChannel, number>;
  hired: number;
  /** Contratadas sobre el total, de 0 a 1 con dos decimales. */
  hireRate: number;
  /** Ofertas con más postulaciones. */
  topOffers: { code: string; title: string; applications: number }[];
}
