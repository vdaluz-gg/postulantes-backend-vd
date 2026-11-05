/** Mensajes para mostrar a la persona, por campo y tipo de error. Español rioplatense. */
export const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  fullName: {
    required: 'Ingresá tu nombre y apellido',
    missingLastName: 'Ingresá tu nombre y apellido',
    invalidChars: 'El nombre solo puede tener letras, espacios, apóstrofos y guiones',
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
  zoneId: {
    unknownZone: 'Elegí una zona de la lista',
  },
  position: {
    required: 'Indicá el puesto que buscás',
  },
};

export const messageFor = (field: string, code: string): string => FIELD_MESSAGES[field]?.[code] ?? 'Dato inválido';
