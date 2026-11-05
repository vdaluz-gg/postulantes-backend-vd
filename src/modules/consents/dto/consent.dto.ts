import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, Matches, ValidateNested } from 'class-validator';
import { CONSENT_TYPES, ConsentType } from '../entities/consent.entity';

export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export class ConsentDecisionDto {
  @IsIn(CONSENT_TYPES)
  type: ConsentType;

  @IsBoolean()
  granted: boolean;
}

export class RecordConsentsDto {
  /** Identificador anónimo de la sesión del navegador (lo genera el front). */
  @Matches(SESSION_ID_PATTERN, { message: 'sessionId debe tener entre 8 y 64 caracteres: letras, números, guion o guion bajo' })
  sessionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CONSENT_TYPES.length)
  @ValidateNested({ each: true })
  @Type(() => ConsentDecisionDto)
  decisions: ConsentDecisionDto[];
}
