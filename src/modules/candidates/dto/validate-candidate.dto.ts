import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Campos a validar. Todos opcionales: se evalúan solo los que llegan (validación mientras se completa el formulario). */
export class ValidateCandidateDto {
  @IsOptional() @IsString() @MaxLength(300) fullName?: string;
  @IsOptional() @IsString() @MaxLength(300) email?: string;
  @IsOptional() @IsString() @MaxLength(300) dni?: string;
  @IsOptional() @IsString() @MaxLength(300) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(64) zoneId?: string;
  @IsOptional() @IsString() @MaxLength(300) position?: string;
}

export interface FieldValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
  normalized?: string;
  formatted?: string;
}

export interface ValidateCandidateResponse {
  valid: boolean;
  fields: Record<string, FieldValidationResult>;
}
