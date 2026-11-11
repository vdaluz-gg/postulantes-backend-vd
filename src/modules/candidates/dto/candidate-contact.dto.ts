import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import {
  IsCuil,
  IsDni,
  IsEmailAr,
  IsFullName,
  IsPersonName,
  IsWhatsappAr,
  NormalizeCuil,
  NormalizeDni,
  NormalizeEmail,
  NormalizeWhatsapp,
  TrimString,
  SanitizeText,
} from '../../../common/validators/ar-validators.decorators';

/**
 * Datos de contacto del postulante, con las mismas reglas que el formulario del front. Los comparten el alta
 * del backoffice y la postulación pública. El nombre llega como nombre y apellido por separado o, en clientes
 * anteriores, como nombre completo (que entonces es obligatorio).
 */
export class CandidateContactDto {
  @IsOptional()
  @TrimString()
  @IsPersonName()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @TrimString()
  @IsPersonName()
  @MaxLength(80)
  lastName?: string;

  /** Obligatorio solo si no llegan nombre y apellido por separado; si llegan, ganan ellos. */
  @ValidateIf((o: CandidateContactDto) => !(o.firstName && o.lastName))
  @TrimString()
  @IsFullName()
  @MaxLength(160)
  fullName?: string;

  @NormalizeEmail()
  @IsEmailAr()
  email: string;

  @NormalizeDni()
  @IsDni()
  dni: string;

  @NormalizeWhatsapp()
  @IsWhatsappAr()
  whatsapp: string;

  /** CUIL (opcional): se guarda solo con dígitos y tiene que coincidir con el DNI. */
  @IsOptional()
  @NormalizeCuil()
  @IsCuil()
  cuil?: string | null;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  /** Puesto al que aspira. */
  @IsOptional()
  @SanitizeText()
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
