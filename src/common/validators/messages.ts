/** Mensajes para mostrar a la persona, por campo y tipo de error. Español rioplatense. */
export const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  fullName: {
    required: 'Ingresá tu nombre y apellido',
    missingLastName: 'Ingresá tu nombre y apellido',
    invalidChars: 'El nombre solo puede tener letras, espacios, apóstrofos y guiones',
  },
  firstName: {
    required: 'Ingresá tu nombre',
    invalidChars: 'El nombre solo puede tener letras, espacios, apóstrofos y guiones',
    invalid: 'El nombre puede tener hasta 80 caracteres',
  },
  lastName: {
    required: 'Ingresá tu apellido',
    invalidChars: 'El apellido solo puede tener letras, espacios, apóstrofos y guiones',
    invalid: 'El apellido puede tener hasta 80 caracteres',
  },
  email: {
    required: 'Ingresá tu mail',
    invalid: 'Revisá el mail: parece incompleto',
  },
  dni: {
    required: 'Ingresá tu DNI',
    invalid: 'El DNI debe tener 7 u 8 números',
  },
  whatsapp: {
    required: 'Ingresá tu celular',
    invalid: 'Ingresá tu celular con código de área, por ejemplo 11 5555-0142',
  },
  cuil: {
    required: 'Ingresá tu CUIL',
    invalid: 'Revisá el CUIL: son 11 números, como figuran en tu constancia de CUIL',
    dniMismatch: 'El CUIL no coincide con el DNI.',
  },
  zoneId: {
    unknownZone: 'Elegí una zona de la lista',
  },
  position: {
    required: 'Indicá el puesto que buscás',
  },
};

export const messageFor = (field: string, code: string): string => FIELD_MESSAGES[field]?.[code] ?? 'Dato inválido';
