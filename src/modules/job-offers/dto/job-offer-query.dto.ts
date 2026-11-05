import { Transform, Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const OFFER_SORTS = ['recent', 'nearest'] as const;
export type OfferSort = (typeof OFFER_SORTS)[number];

/** Búsqueda de ofertas: texto libre, chips (rubro, zona) y cercanía. */
export class ListJobOffersQueryDto extends PaginationQueryDto {
  /** Texto libre: puesto, zona, rubro o lo que escriba la persona. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  area?: string;

  @IsOptional()
  @IsUUID()
  zone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** Si se indica junto con lat/lng, solo ofertas dentro de ese radio. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @IsOptional()
  @IsIn(OFFER_SORTS)
  sort?: OfferSort;
}

/** Ofertas cerca de la ubicación de la persona. */
export class NearbyJobOffersQueryDto extends PaginationQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm: number = 30;
}
