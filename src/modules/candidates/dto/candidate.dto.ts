import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TrimString } from '../../../common/validators/ar-validators.decorators';
import {
  Candidate,
  CANDIDATE_CHANNELS,
  CANDIDATE_SOURCES,
  CandidateChannel,
  CandidateSource,
  IDENTITY_STATUSES,
  IdentityStatus,
  ProfileStage,
} from '../entities/candidate.entity';
import { CandidateContactDto } from './candidate-contact.dto';

export class CreateCandidateDto extends CandidateContactDto {
  /** Canal de origen; si no se indica, es una carga del backoffice. Después del alta no se modifica. */
  @IsOptional()
  @IsIn(CANDIDATE_CHANNELS)
  channel?: CandidateChannel;
}
export class UpdateCandidateDto extends PartialType(CandidateContactDto) {}

export class ListCandidatesQueryDto extends PaginationQueryDto {
  /** Busca en nombre, mail, DNI y WhatsApp. */
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsIn(IDENTITY_STATUSES)
  identityStatus?: IdentityStatus;

  @IsOptional()
  @IsIn(CANDIDATE_SOURCES)
  source?: CandidateSource;

  @IsOptional()
  @IsIn(CANDIDATE_CHANNELS)
  channel?: CandidateChannel;
}

export interface CandidateDto {
  id: string;
  fullName: string;
  email: string;
  dni: string;
  whatsapp: string;
  zone: { id: string; name: string } | null;
  position: string | null;
  latitude: number | null;
  longitude: number | null;
  source: CandidateSource;
  channel: CandidateChannel;
  profileStage: ProfileStage;
  employeeNumber: string | null;
  whatsappOptIn: boolean;
  identityStatus: IdentityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateDetailDto extends CandidateDto {
  applications: {
    id: string;
    trackingCode: string;
    position: string;
    status: string;
    jobOfferCode: string | null;
    createdAt: Date;
  }[];
  cvDocuments: { id: string; originalName: string; createdAt: Date }[];
  /** Última decisión de la persona sobre cada permiso (voz, imagen, ubicación). */
  consents: { type: string; granted: boolean; at: Date }[];
}

export const toCandidateDto = (c: Candidate): CandidateDto => ({
  id: c.id,
  fullName: c.fullName,
  email: c.email,
  dni: c.dni,
  whatsapp: c.whatsapp,
  zone: c.zone ? { id: c.zone.id, name: c.zone.name } : null,
  position: c.position,
  latitude: c.latitude,
  longitude: c.longitude,
  source: c.source,
  channel: c.channel,
  profileStage: c.profileStage,
  employeeNumber: c.employeeNumber,
  whatsappOptIn: c.whatsappOptIn,
  identityStatus: c.identityStatus,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
