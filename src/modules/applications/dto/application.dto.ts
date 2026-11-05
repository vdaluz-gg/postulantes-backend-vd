import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TrimString } from '../../../common/validators/ar-validators.decorators';
import { CandidateContactDto } from '../../candidates/dto/candidate-contact.dto';
import { SESSION_ID_PATTERN } from '../../consents/dto/consent.dto';
import { StepState } from '../application-flow';
import { Application, APPLICATION_STATUSES, ApplicationHistoryEntry, ApplicationStatus, STATUS_STAGE } from '../entities/application.entity';

/** Postulación pública: datos de contacto + oferta (opcional) + CV (opcional) + sesión (para vincular permisos). */
export class ApplyDto extends CandidateContactDto {
  /** Código de la oferta; sin él es una postulación espontánea. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  offerCode?: string;

  /** CV subido antes con POST /cv. */
  @IsOptional()
  @IsUUID()
  cvId?: string;

  @IsOptional()
  @Matches(SESSION_ID_PATTERN)
  sessionId?: string;
}

export class UpdateApplicationStatusDto {
  @IsIn(APPLICATION_STATUSES)
  status: ApplicationStatus;

  /** Nota interna: no la ve el postulante. */
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatus;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  jobOfferCode?: string;
}

export interface ApplyResponseDto {
  trackingCode: string;
  status: ApplicationStatus;
  stage: number;
  position: string;
  offer: { ref: string; title: string } | null;
}

export interface TrackingDto extends ApplyResponseDto {
  steps: { label: string; state: StepState }[];
  /** Historial sin notas internas. */
  history: { at: string; status: ApplicationStatus }[];
  updatedAt: Date;
}

export interface ApplicationSummaryDto {
  id: string;
  trackingCode: string;
  candidate: { id: string; fullName: string; dni: string };
  position: string;
  jobOfferCode: string | null;
  status: ApplicationStatus;
  stage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationDetailDto extends ApplicationSummaryDto {
  history: ApplicationHistoryEntry[];
  candidateContact: { email: string; whatsapp: string };
  cvDocumentId: string | null;
}

export const offerRef = (a: Application): { ref: string; title: string } | null =>
  a.jobOffer ? { ref: a.jobOffer.code, title: a.jobOffer.title } : null;

export const toSummary = (a: Application): ApplicationSummaryDto => ({
  id: a.id,
  trackingCode: a.trackingCode,
  candidate: { id: a.candidate.id, fullName: a.candidate.fullName, dni: a.candidate.dni },
  position: a.position,
  jobOfferCode: a.jobOffer?.code ?? null,
  status: a.status,
  stage: STATUS_STAGE[a.status],
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});
