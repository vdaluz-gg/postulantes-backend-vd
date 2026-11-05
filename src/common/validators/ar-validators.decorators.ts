import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import {
  normalizeDni,
  normalizeWhatsapp,
  validateDni,
  validateEmail,
  validateFullName,
  validateWhatsapp,
  ValidationOutcome,
} from './ar-validators';
import { messageFor } from './messages';

function rule(field: string, check: (value: unknown) => ValidationOutcome, options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: `ar_${field}`,
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => check(value).valid,
        defaultMessage: (args) => {
          const outcome = check(args?.value);
          return messageFor(field, outcome.valid ? 'invalid' : outcome.code);
        },
      },
    });
}

export const IsFullName = (o?: ValidationOptions) => rule('fullName', validateFullName, o);
export const IsEmailAr = (o?: ValidationOptions) => rule('email', validateEmail, o);
export const IsDni = (o?: ValidationOptions) => rule('dni', validateDni, o);
export const IsWhatsappAr = (o?: ValidationOptions) => rule('whatsapp', validateWhatsapp, o);

/** Recorta espacios de los extremos. */
export const TrimString = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
/** Mail en minúsculas y sin espacios. */
export const NormalizeEmail = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
/** DNI solo con dígitos, pero únicamente si era válido: un dato inválido no se "arregla" en silencio. */
export const NormalizeDni = () => Transform(({ value }) => (validateDni(value).valid ? normalizeDni(value) : value));
/** WhatsApp en formato internacional, solo si era válido. */
export const NormalizeWhatsapp = () => Transform(({ value }) => (validateWhatsapp(value).valid ? normalizeWhatsapp(value) : value));
