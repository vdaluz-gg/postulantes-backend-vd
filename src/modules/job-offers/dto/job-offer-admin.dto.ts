import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TrimString } from '../../../common/validators/ar-validators.decorators';
import { JobOffer, OFFER_STATUSES, OfferInternalData, OfferStatus } from '../entities/job-offer.entity';

/** Ficha interna de la búsqueda (solo backoffice). */
export class OfferInternalDto implements OfferInternalData {
  @IsOptional() @IsString() @MaxLength(200) client?: string;
  @IsOptional() @IsString() @MaxLength(200) managingCompany?: string;
  @IsOptional() @IsString() @MaxLength(200) businessArea?: string;
  @IsOptional() @IsInt() positionId?: number;
  @IsOptional() @IsString() @MaxLength(100) type?: string;
  @IsOptional() @IsString() @MaxLength(100) scope?: string;
  @IsOptional() @IsString() @MaxLength(50) priority?: string;
  @IsOptional() @IsInt() searchTypeId?: number;
  @IsOptional() @IsInt() modalityId?: number;
  @IsOptional() @IsInt() hierarchyId?: number;
  @IsOptional() @IsString() @MaxLength(255) collectiveAgreement?: string;
  @IsOptional() @IsString() @MaxLength(255) branch?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsBoolean() experienceRequired?: boolean;
  @IsOptional() @IsBoolean() reinstatableDismissal?: boolean;
  @IsOptional() @IsBoolean() requiresUniform?: boolean;
  @IsOptional() @IsBoolean() preEmploymentExam?: boolean;
  @IsOptional() @IsString() @MaxLength(1000) clientNotes?: string;
}

const CODE = /^[A-Za-z0-9_-]{1,40}$/;

export class CreateJobOfferDto {
  @Matches(CODE, { message: 'code admite letras, números, guion y guion bajo (hasta 40)' })
  code: string;

  @TrimString() @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @TrimString() @IsString() @IsNotEmpty() @MaxLength(5000) description: string;
  @IsUUID() zoneId: string;
  @TrimString() @IsString() @IsNotEmpty() @MaxLength(80) area: string;
  @TrimString() @IsString() @IsNotEmpty() @MaxLength(160) schedule: string;

  /** AAAA-MM-DD. Si falta, hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'publishedAt debe ser AAAA-MM-DD' })
  @IsISO8601({ strict: true })
  publishedAt?: string;

  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) requirements: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) benefits: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) vacancies?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) salary?: number | null;
  @IsOptional() @TrimString() @IsString() @MaxLength(240) address?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) radiusKm?: number;
  @IsOptional() @IsIn(OFFER_STATUSES) status?: OfferStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => OfferInternalDto)
  internal?: OfferInternalDto;
}

export class UpdateJobOfferDto extends PartialType(CreateJobOfferDto) {}

export class ListAdminOffersQueryDto extends PaginationQueryDto {
  /** Busca en título y código. */
  @IsOptional() @TrimString() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(OFFER_STATUSES) status?: OfferStatus;
  @IsOptional() @IsUUID() zoneId?: string;
}

export interface AdminJobOfferDto {
  id: string;
  code: string;
  title: string;
  description: string;
  zone: { id: string; name: string };
  area: string;
  schedule: string;
  publishedAt: string;
  requirements: string[];
  benefits: string[];
  vacancies: number;
  salary: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  status: OfferStatus;
  internal: OfferInternalData;
  createdAt: Date;
  updatedAt: Date;
}

export const toAdminOfferDto = (o: JobOffer): AdminJobOfferDto => ({
  id: o.id,
  code: o.code,
  title: o.title,
  description: o.description,
  zone: { id: o.zone.id, name: o.zone.name },
  area: o.area,
  schedule: o.schedule,
  publishedAt: o.publishedAt,
  requirements: o.requirements,
  benefits: o.benefits,
  vacancies: o.vacancies,
  salary: o.salary,
  address: o.address,
  latitude: o.latitude,
  longitude: o.longitude,
  radiusKm: o.radiusKm,
  status: o.status,
  internal: o.internal,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
