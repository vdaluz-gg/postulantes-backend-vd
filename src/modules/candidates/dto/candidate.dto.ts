import { PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { maskCuil, maskDni, maskWhatsapp } from '../../../common/utils/mask';
import { formatCuil } from '../../../common/validators/ar-validators';
import { TrimString } from '../../../common/validators/ar-validators.decorators';
import { splitFullName } from '../candidate-names';
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
  firstName: string | null;
  lastName: string | null;
  email: string;
  dni: string;
  /** Con guiones: 27-40123456-5. */
  cuil: string | null;
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

/** Nombre y apellido guardados; en fichas anteriores a separarlos, los del nombre completo. */
export function candidateNameParts(c: Pick<Candidate, 'fullName' | 'firstName' | 'lastName'>): { firstName: string | null; lastName: string | null } {
  return c.firstName || c.lastName ? { firstName: c.firstName, lastName: c.lastName } : splitFullName(c.fullName);
}

/** Datos de identificación del postulante para las vistas del backoffice. */
export const candidateIdentity = (c: Candidate) => ({
  fullName: c.fullName,
  ...candidateNameParts(c),
  cuil: c.cuil ? formatCuil(c.cuil) : null,
});

/** Datos de identificación con DNI y CUIL tapados, para listados (el detalle de la persona los muestra completos). */
export const maskedCandidateIdentity = (c: Candidate) => {
  const identity = candidateIdentity(c);
  return { ...identity, cuil: maskCuil(identity.cuil), dni: maskDni(c.dni) };
};

export const toCandidateDto = (c: Candidate): CandidateDto => ({
  id: c.id,
  ...candidateIdentity(c),
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

/** Para los listados: igual que toCandidateDto pero con DNI, CUIL y WhatsApp enmascarados. */
export const toCandidateListItemDto = (c: Candidate): CandidateDto => ({
  ...toCandidateDto(c),
  ...maskedCandidateIdentity(c),
  whatsapp: maskWhatsapp(c.whatsapp),
});
