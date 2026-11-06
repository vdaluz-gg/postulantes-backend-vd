import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  cuilMatchesDni,
  formatCuil,
  formatDni,
  normalizeCuil,
  normalizeDni,
  normalizeWhatsapp,
  validateCuil,
  validateDni,
  validateEmail,
  validateFullName,
  validateName,
  validateWhatsapp,
  ValidationOutcome,
} from '../../common/validators/ar-validators';
import { messageFor } from '../../common/validators/messages';
import { Zone } from '../zones/entities/zone.entity';
import { FieldValidationResult, ValidateCandidateDto, ValidateCandidateResponse } from './dto/validate-candidate.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida los campos del formulario uno por uno, sin guardar nada. */
@Injectable()
export class CandidateValidationService {
  constructor(@InjectRepository(Zone) private readonly zones: Repository<Zone>) {}

  private result(field: string, outcome: ValidationOutcome, extra: Partial<FieldValidationResult> = {}): FieldValidationResult {
    return outcome.valid
      ? { valid: true, ...extra }
      : { valid: false, code: outcome.code, message: messageFor(field, outcome.code) };
  }

  async validate(dto: ValidateCandidateDto): Promise<ValidateCandidateResponse> {
    const fields: Record<string, FieldValidationResult> = {};

    if (dto.fullName !== undefined) fields.fullName = this.result('fullName', validateFullName(dto.fullName));
    if (dto.firstName !== undefined) fields.firstName = this.result('firstName', validateName(dto.firstName));
    if (dto.lastName !== undefined) fields.lastName = this.result('lastName', validateName(dto.lastName));
    if (dto.email !== undefined) {
      fields.email = this.result('email', validateEmail(dto.email), { normalized: dto.email.trim().toLowerCase() });
    }
    if (dto.dni !== undefined) {
      fields.dni = this.result('dni', validateDni(dto.dni), { normalized: normalizeDni(dto.dni), formatted: formatDni(dto.dni) });
    }
    if (dto.cuil !== undefined) {
      fields.cuil = this.result('cuil', validateCuil(dto.cuil), { normalized: normalizeCuil(dto.cuil), formatted: formatCuil(dto.cuil) });
      // Con los dos datos bien escritos, el CUIL tiene que contener el DNI.
      if (fields.cuil.valid && fields.dni?.valid && !cuilMatchesDni(dto.cuil, dto.dni)) {
        fields.cuil = { valid: false, code: 'dniMismatch', message: messageFor('cuil', 'dniMismatch') };
      }
    }
    if (dto.whatsapp !== undefined) {
      fields.whatsapp = this.result('whatsapp', validateWhatsapp(dto.whatsapp), { normalized: normalizeWhatsapp(dto.whatsapp) });
    }
    if (dto.zoneId !== undefined) {
      const exists = UUID.test(dto.zoneId) && (await this.zones.existsBy({ id: dto.zoneId, active: true }));
      fields.zoneId = exists ? { valid: true } : { valid: false, code: 'unknownZone', message: messageFor('zoneId', 'unknownZone') };
    }
    if (dto.position !== undefined) {
      const empty = dto.position.trim() === '';
      fields.position = empty ? { valid: false, code: 'required', message: messageFor('position', 'required') } : { valid: true };
    }

    const keys = Object.keys(fields);
    if (!keys.length) throw new BadRequestException('Enviá al menos un campo para validar');
    // Los datos de un campo inválido no se devuelven normalizados: no sirven para nada.
    for (const k of keys) if (!fields[k].valid) delete fields[k].normalized;
    return { valid: keys.every((k) => fields[k].valid), fields };
  }
}
