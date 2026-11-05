import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TrimString } from '../../../common/validators/ar-validators.decorators';
import { Candidate, CANDIDATE_SOURCES, CandidateSource, IDENTITY_STATUSES, IdentityStatus } from '../entities/candidate.entity';
import { CandidateContactDto } from './candidate-contact.dto';

export class CreateCandidateDto extends CandidateContactDto {}
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
  whatsappOptIn: c.whatsappOptIn,
  identityStatus: c.identityStatus,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
