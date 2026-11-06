import { coreApplicationFields, field, siteConfig } from '../../../test/utils/site-config';
import { checkAnswers, FieldType, findConfigProblem } from './site-config.rules';

describe('findConfigProblem', () => {
  it('acepta una configuración válida', () => {
    expect(findConfigProblem(siteConfig().audiences)).toBeNull();
  });

  it('exige los tres públicos', () => {
    const { audiences } = siteConfig();
    expect(findConfigProblem({ postulantes: audiences.postulantes })).toBe('La configuración está incompleta: falta «clientes».');
  });

  it.each([
    ['un tipo de campo desconocido', [...coreApplicationFields(), field('x', 'X', 'imagen' as FieldType)], 'El campo «X» tiene un tipo que no existe.'],
    ['una clave con espacios', [...coreApplicationFields(), field('mi campo', 'Mi campo')], 'La clave «mi campo» no es válida.'],
    ['una etiqueta vacía', [...coreApplicationFields(), field('x', '  ')], 'Hay un campo sin etiqueta en «Postulación».'],
    ['una etiqueta demasiado larga', [...coreApplicationFields(), field('x', 'a'.repeat(121))], 'El texto «aaaaaaaaaaaaaaaaaaaaaaaa…» es demasiado largo.'],
  ])('rechaza %s', (_name, fields, message) => {
    expect(findConfigProblem(siteConfig(fields).audiences)).toBe(message);
  });

  it('no deja ocultar ni volver opcionales los datos que necesita la postulación', () => {
    const hidden = coreApplicationFields().map((f) => (f.id === 'dni' ? { ...f, visible: false } : f));
    expect(findConfigProblem(siteConfig(hidden).audiences)).toBe(
      '«DNI» lo necesita el sistema para registrar la postulación: dejalo visible y obligatorio.',
    );
    const missing = coreApplicationFields().filter((f) => f.id !== 'email');
    expect(findConfigProblem(siteConfig(missing).audiences)).toBe('Falta el campo «email» en la postulación: el sistema lo necesita.');
  });

  it('el nombre y el apellido van por separado y los dos son obligatorios', () => {
    const noLastName = coreApplicationFields().filter((f) => f.id !== 'lastName');
    expect(findConfigProblem(siteConfig(noLastName).audiences)).toBe('Falta el campo «lastName» en la postulación: el sistema lo necesita.');
    const optionalFirstName = coreApplicationFields().map((f) => (f.id === 'firstName' ? { ...f, required: false } : f));
    expect(findConfigProblem(siteConfig(optionalFirstName).audiences)).toBe(
      '«Nombre» lo necesita el sistema para registrar la postulación: dejalo visible y obligatorio.',
    );
  });

  it('el CUIL es opcional y una configuración guardada con el nombre completo sigue siendo válida', () => {
    const withoutCuil = coreApplicationFields().filter((f) => f.id !== 'cuil');
    expect(findConfigProblem(siteConfig(withoutCuil).audiences)).toBeNull();
    const legacy = [...coreApplicationFields(), field('fullName', 'Nombre y apellido', 'text', { required: true })];
    expect(findConfigProblem(siteConfig(legacy).audiences)).toBeNull();
  });

  it('rechaza lo que no es un objeto', () => {
    expect(findConfigProblem(null)).toBe('La configuración está incompleta: falta «postulantes».');
    expect(findConfigProblem({ ...siteConfig().audiences, clientes: { sections: 'x' } })).toBe('La configuración de «clientes» no es válida.');
  });
});

describe('checkAnswers', () => {
  const fields = [
    ...coreApplicationFields(),
    field('middleName', 'Segundo nombre', 'text', { required: true, validation: { maxLength: 30 } }),
    field('shift', 'Turno', 'select', { options: [{ value: 'manana', label: 'Mañana' }, { value: 'tarde', label: 'Tarde' }] }),
    field('days', 'Días', 'chips', { options: [{ value: 'lun', label: 'Lunes' }, { value: 'mar', label: 'Martes' }] }),
    field('age', 'Edad', 'number', { validation: { min: 18, max: 70, message: 'Tenés que tener entre 18 y 70 años.' } }),
    field('car', 'Tengo auto', 'switch'),
    field('birth', 'Nacimiento', 'date'),
    field('hidden', 'Oculto', 'text', { visible: false }),
    field('system', 'Del sistema', 'text', { readonly: true }),
  ];

  it('devuelve las respuestas con su etiqueta, en el orden del formulario, y descarta lo que no corresponde', () => {
    const result = checkAnswers(fields, {
      days: ['mar', 'lun'],
      middleName: '  Sofía ',
      shift: 'tarde',
      age: '30',
      car: true,
      birth: '1995-04-02',
      hidden: 'x',
      system: 'x',
      dni: '1',
      inventado: 'x',
    });
    expect(result).toEqual({
      answers: [
        { id: 'middleName', label: 'Segundo nombre', value: 'Sofía' },
        { id: 'shift', label: 'Turno', value: 'tarde' },
        { id: 'days', label: 'Días', value: ['mar', 'lun'] },
        { id: 'age', label: 'Edad', value: 30 },
        { id: 'car', label: 'Tengo auto', value: true },
        { id: 'birth', label: 'Nacimiento', value: '1995-04-02' },
      ],
    });
  });

  it.each([
    ['falta un obligatorio', {}, 'Completá «Segundo nombre».'],
    ['texto demasiado largo', { middleName: 'a'.repeat(31) }, 'Revisá «Segundo nombre».'],
    ['opción que no existe', { middleName: 'Sofía', shift: 'noche' }, 'Revisá «Turno».'],
    ['píldora que no existe', { middleName: 'Sofía', days: ['dom'] }, 'Revisá «Días».'],
    ['número fuera de rango (con el mensaje configurado)', { middleName: 'Sofía', age: 15 }, 'Tenés que tener entre 18 y 70 años.'],
    ['número inválido', { middleName: 'Sofía', age: 'veinte' }, 'Tenés que tener entre 18 y 70 años.'],
    ['sí/no que no es booleano', { middleName: 'Sofía', car: 'si' }, 'Revisá «Tengo auto».'],
    ['fecha mal escrita', { middleName: 'Sofía', birth: '02/04/1995' }, 'Revisá «Nacimiento».'],
    ['un objeto en lugar de texto', { middleName: { a: 1 } }, 'Revisá «Segundo nombre».'],
  ])('rechaza: %s', (_name, answers, error) => {
    expect(checkAnswers(fields, answers)).toEqual({ error });
  });

  it('los datos propios del formulario (CUIL y el nombre completo de configuraciones anteriores) no son respuestas', () => {
    const legacy = [...coreApplicationFields(), field('fullName', 'Nombre y apellido', 'text', { required: true })];
    expect(checkAnswers(legacy, { cuil: '27-40123456-5', firstName: 'Lucía', lastName: 'Fernández' })).toEqual({ answers: [] });
  });

  it('un sí/no obligatorio tiene que estar marcado', () => {
    const terms = [field('terms', 'Acepto las condiciones', 'switch', { required: true })];
    expect(checkAnswers(terms, { terms: false })).toEqual({ error: 'Completá «Acepto las condiciones».' });
    expect(checkAnswers(terms, { terms: true })).toEqual({ answers: [{ id: 'terms', label: 'Acepto las condiciones', value: true }] });
  });

  it('valida el correo y deja vacíos los opcionales sin respuesta', () => {
    const mail = [field('altEmail', 'Otro correo', 'email')];
    expect(checkAnswers(mail, { altEmail: 'no-es-mail' })).toEqual({ error: 'Revisá «Otro correo».' });
    expect(checkAnswers(mail, { altEmail: '' })).toEqual({ answers: [] });
  });
});
