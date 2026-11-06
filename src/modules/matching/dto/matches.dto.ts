import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MatchReason } from '../match-scoring';

export class MatchesQueryDto {
  /** Puntaje mínimo (0-100) para aparecer en las sugerencias. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface MatchItemDto {
  /** Solo lo necesario para decidir; el contacto y el DNI se ven en la ficha del postulante. */
  candidate: {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    zone: string | null;
    position: string | null;
    identityStatus: string;
  };
  score: number;
  reasons: MatchReason[];
  /** Ya se postuló a esta oferta. */
  alreadyApplied: boolean;
}

export interface MatchesDto {
  offer: { id: string; code: string; title: string };
  items: MatchItemDto[];
}
