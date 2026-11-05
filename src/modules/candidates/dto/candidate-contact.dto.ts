import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import {
  IsDni,
  IsEmailAr,
  IsFullName,
  IsWhatsappAr,
  NormalizeDni,
  NormalizeEmail,
  NormalizeWhatsapp,
  TrimString,
} from '../../../common/validators/ar-validators.decorators';

/**
 * Datos de contacto del postulante, con las mismas reglas que el formulario del front. Los comparten el alta
 * del backoffice y la postulación pública.
 */
export class CandidateContactDto {
  @TrimString()
  @IsFullName()
  @MaxLength(160)
  fullName: string;

  @NormalizeEmail()
  @IsEmailAr()
  email: string;

  @NormalizeDni()
  @IsDni()
  dni: string;

  @NormalizeWhatsapp()
  @IsWhatsappAr()
  whatsapp: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  /** Puesto al que aspira. */
  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(160)
  position?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  /** Acepta recibir avisos de ofertas por WhatsApp oficial. */
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
