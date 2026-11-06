import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SITE_CONFIG_STATUSES, SiteConfigStatus } from '../entities/site-config-version.entity';

/**
 * Lo que manda el backoffice al guardar o publicar. `version` es la versión que se estaba editando (para no
 * pisar cambios de otra persona). Estado, fecha y autor los pone el servidor: si vienen, se ignoran.
 * El contenido de `audiences` se revisa con las reglas de site-config.rules.ts.
 */
export class SaveSiteConfigDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsObject()
  audiences: Record<string, unknown>;

  @IsOptional()
  @IsIn(SITE_CONFIG_STATUSES)
  status?: SiteConfigStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  updatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  updatedBy?: string;
}

export interface SiteConfigDto {
  version: number;
  status: SiteConfigStatus;
  /** ISO 8601. */
  updatedAt: string;
  updatedBy: string;
  audiences: Record<string, unknown>;
}
