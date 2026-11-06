import { parseCvText } from './cv-text-parser';

// Zonas como las del seed. Todos los datos de personas de estos tests son ficticios.
const ZONES = [
  'Gral. Pacheco',
  'Moreno / Parque Avellaneda',
  'Monte Grande',
  'Corrientes Capital',
  'Tortuguitas',
  'Salta',
  'Villa Maipú',
  'CABA',
  'Pilar',
  'Palermo, CABA',
  'Esteban Echeverría',
  'San Isidro',
  'Quilmes',
  'Rosario',
];
const parse = (...lines: string[]) => parseCvText(lines.join('\n'), ZONES);

describe('parseCvText', () => {
  it('un CV típico: nombre en mayúsculas, DNI, domicilio, celular y mail', () => {
    const text = [
      'CURRICULUM VITAE',
      'LUCÍA FERNÁNDEZ',
      'Datos personales',
      'DNI: 40.123.456',
      'Fecha de nacimiento: 12/03/1997',
      'Domicilio: Av. Siempreviva 742, Monte Grande, Esteban Echeverría',
      'Celular: +54 9 11 4444-0101',
      'Mail: lucia.fernandez@ejemplo.com',
      'Experiencia laboral',
      '2019 - 2023 Cajera en Supermercado La Esquina',
    ].join('\n');
    expect(parseCvText(text, ZONES)).toEqual({
      fullName: 'Lucía Fernández',
      firstName: 'Lucía',
      lastName: 'Fernández',
      dni: '40.123.456',
      whatsapp: '11 4444-0101',
      email: 'lucia.fernandez@ejemplo.com',
      zone: 'Monte Grande',
    });
  });

  it('no se vuelve lento con textos patológicos (palabras o números larguísimos)', () => {
    const start = Date.now();
    expect(parseCvText(`${'a.'.repeat(150_000)}@b`, ZONES)).toEqual({});
    expect(parseCvText('1'.repeat(300_000), ZONES)).toEqual({});
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('sin datos reconocibles devuelve un objeto vacío (no inventa nada)', () => {
    expect(parseCvText('', ZONES)).toEqual({});
    expect(parse('Experiencia', 'Trabajé muchos años en atención al público.')).toEqual({});
    expect(parse('Contacto: lucia@ejemplo.com')).toEqual({ email: 'lucia@ejemplo.com' });
  });

  describe('nombre y apellido', () => {
    it.each([
      [['Nombre y apellido: Martín Gómez'], 'Martín Gómez', 'Martín', 'Gómez'],
      [['Nombre completo: Sofía Benítez Ríos'], 'Sofía Benítez Ríos', 'Sofía Benítez', 'Ríos'],
      [['Apellido y nombre: PÉREZ, Juan Carlos'], 'Juan Carlos Pérez', 'Juan Carlos', 'Pérez'],
      [['Apellido y nombre: PÉREZ GÓMEZ, María José'], 'María José Pérez Gómez', 'María José', 'Pérez Gómez'],
      [['Nombre: Martín', 'Apellido: Gómez'], 'Martín Gómez', 'Martín', 'Gómez'],
      [['Nombres: María José', 'Apellidos: PÉREZ GÓMEZ'], 'María José Pérez Gómez', 'María José', 'Pérez Gómez'],
      [['Nombre: Martín    Apellido: Gómez'], 'Martín Gómez', 'Martín', 'Gómez'],
      [['Nombre y apellido:', 'Carla Domínguez'], 'Carla Domínguez', 'Carla', 'Domínguez'],
    ])('con rótulo: %j', (lines, fullName, firstName, lastName) => {
      expect(parse(...lines)).toEqual(expect.objectContaining({ fullName, firstName, lastName }));
    });

    it('sin rótulos de nombre y apellido, separa el nombre completo (dos palabras de nombre si hay tres o más)', () => {
      expect(parse('LUCÍA FERNÁNDEZ')).toEqual({ fullName: 'Lucía Fernández', firstName: 'Lucía', lastName: 'Fernández' });
      expect(parse('Juan Carlos Pérez')).toEqual({ fullName: 'Juan Carlos Pérez', firstName: 'Juan Carlos', lastName: 'Pérez' });
      expect(parse('Juan Carlos Pérez Gómez')).toEqual(expect.objectContaining({ firstName: 'Juan Carlos', lastName: 'Pérez Gómez' }));
    });

    it('sin rótulo: el primer renglón que parece un nombre, salteando títulos, puestos y zonas', () => {
      expect(parse('Curriculum Vitae', 'Analista Contable', 'Monte Grande', 'Sofía Benítez', 'Perfil profesional').fullName).toBe('Sofía Benítez');
    });

    it('pasa a mayúscula inicial los nombres en mayúsculas y deja las partículas en minúscula', () => {
      expect(parse('MARÍA DE LOS ÁNGELES RUIZ').fullName).toBe('María de los Ángeles Ruiz');
      expect(parse("ANA O'CONNOR-PAZ").fullName).toBe("Ana O'Connor-Paz");
    });

    it('acepta el nombre separado del puesto por una barra o un guion', () => {
      expect(parse('Tomás Acosta | Desarrollador web').fullName).toBe('Tomás Acosta');
      expect(parse('Tomás Acosta - Chofer profesional').fullName).toBe('Tomás Acosta');
    });

    it.each([
      [['Lucía'], 'una sola palabra'],
      [['Lucía Fernández 2'], 'con números'],
      [['lucía fernández'], 'en minúsculas sin rótulo'],
      [['Experiencia Laboral'], 'un título'],
      [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'Lucía Fernández'], 'más allá de los primeros renglones'],
      [['Nombre y apellido: L4ura P3rez'], 'un rótulo con un valor inválido'],
    ])('lo omite: %j (%s)', (lines) => {
      const found = parse(...lines);
      expect([found.fullName, found.firstName, found.lastName]).toEqual([undefined, undefined, undefined]);
    });
  });

  describe('CUIL', () => {
    it.each([
      ['CUIL: 27-40123456-5', '27401234565'],
      ['C.U.I.L.: 27-40123456-5', '27401234565'],
      ['C.U.I.L. Nº 27 40123456 5', '27401234565'],
      ['CUIL 27-40.123.456-5', '27401234565'],
      ['CUIT: 20-40123456-0', '20401234560'],
      ['Nacionalidad argentina · 27-40123456-5 · soltera', '27401234565'],
    ])('%s → %s (solo dígitos)', (line, expected) => {
      expect(parse(line).cuil).toBe(expected);
    });

    it('acepta el número en el renglón de abajo del rótulo', () => {
      expect(parse('CUIL', '27-40123456-5').cuil).toBe('27401234565');
    });

    it('si no hay DNI, lo toma del CUIL', () => {
      expect(parse('CUIL: 20-05123456-2')).toEqual({ cuil: '20051234562', dni: '5.123.456' });
      expect(parse('27-40123456-5')).toEqual({ cuil: '27401234565', dni: '40.123.456' });
    });

    it('no reemplaza el DNI rotulado', () => {
      expect(parse('DNI: 40.123.456', 'CUIL: 27-40123456-5')).toEqual({ dni: '40.123.456', cuil: '27401234565' });
    });

    it.each([
      ['CUIL: 27-40123456-3', 'dígito verificador incorrecto'],
      ['27-40123456-3', 'sin rótulo y con verificador incorrecto'],
      ['CUIT: 30-40123456-6', 'CUIT de empresa'],
      ['30-40123456-6', 'CUIT de empresa sin rótulo'],
      ['Tel: 11-4444-0101', 'un teléfono'],
    ])('lo omite: %s (%s)', (line) => {
      expect(parse(line).cuil).toBeUndefined();
    });
  });

  describe('mail', () => {
    it('toma el primero válido y le saca la puntuación de alrededor', () => {
      expect(parse('Escribime a: lucia@ejemplo.com.', 'otro@ejemplo.com').email).toBe('lucia@ejemplo.com');
      expect(parse('mailto:<martin.gomez+cv@ejemplo.com.ar>').email).toBe('martin.gomez+cv@ejemplo.com.ar');
    });

    it('ignora lo que no es un mail', () => {
      expect(parse('@usuario en redes', 'lucia@localhost').email).toBeUndefined();
    });
  });

  describe('DNI', () => {
    it.each([
      ['DNI: 40.123.456', '40.123.456'],
      ['D.N.I. Nº 40123456', '40.123.456'],
      ['Documento Nacional de Identidad: 40 123 456', '40.123.456'],
      ['Tipo y número de documento: DNI 5.123.456', '5.123.456'],
      ['Doc. 40123456', '40.123.456'],
      ['Nacionalidad argentina, 40.123.456, soltera', '40.123.456'],
      ['CUIL: 27-40123456-3', '40.123.456'],
    ])('%s → %s', (line, expected) => {
      expect(parse(line).dni).toBe(expected);
    });

    it('acepta el número en el renglón de abajo del rótulo', () => {
      expect(parse('DNI', '40123456').dni).toBe('40.123.456');
    });

    it('prefiere el rotulado a otro número con puntos', () => {
      expect(parse('Facturé 12.345.678 en ventas', 'DNI 40.123.456').dni).toBe('40.123.456');
    });

    it.each([['Tel: 11 4012-3456'], ['Celular 1140123456'], ['Sueldo pretendido $ 1.500.000'], ['Legajo 40123456'], ['DNI: 123']])(
      'no lo toma de un teléfono, un monto o un número sin rótulo: %s',
      (line) => {
        expect(parse(line).dni).toBeUndefined();
      },
    );
  });

  describe('celular (WhatsApp)', () => {
    it.each([
      ['Celular: 11 4444-0101', '11 4444-0101'],
      ['Cel: (011) 15-4444-0101', '11 4444-0101'],
      ['WhatsApp +54 9 351 555-0142', '351 555-0142'],
      ['Tel.: 0351 15 555-0142', '351 555-0142'],
      ['Móvil: 0294 15 455-5014', '294 455-5014'],
      ['Contacto: +54 11 4444 0101', '11 4444-0101'],
      ['1144440101', '11 4444-0101'],
    ])('%s → %s', (line, expected) => {
      expect(parse(line).whatsapp).toBe(expected);
    });

    it('prefiere el renglón rotulado como celular', () => {
      expect(parse('Teléfono fijo: 011 4255-0000', 'Celular: 11 5555-0142').whatsapp).toBe('11 5555-0142');
    });

    it('separa dos números en la misma tira', () => {
      expect(parse('Tel: 4255-0000 - 11 5555-0142').whatsapp).toBe('11 5555-0142');
    });

    it('acepta el número en el renglón de abajo del rótulo', () => {
      expect(parse('Celular', '+54 9 11 4444-0101').whatsapp).toBe('11 4444-0101');
    });

    it.each([['DNI 40.123.456'], ['2015 - 2019 Empresa'], ['Fecha: 12/03/1997'], ['Cel: 15 4444-0101'], ['CUIL 27-40123456-3'], ['Tel: 4444-0101']])(
      'no confunde DNI, años, fechas ni números incompletos: %s',
      (line) => {
        expect(parse(line).whatsapp).toBeUndefined();
      },
    );
  });

  describe('zona', () => {
    it.each([
      [['Localidad: villa maipu'], 'Villa Maipú'],
      [['Vivo en Gral Pacheco'], 'Gral. Pacheco'],
      [['Domicilio: Ruta 197 1234, General Pacheco'], 'Gral. Pacheco'],
      [['Barrio: Palermo, CABA'], 'Palermo, CABA'],
      [['Dirección: Calle 1 123, Parque Avellaneda'], 'Moreno / Parque Avellaneda'],
      [['Residencia: Ciudad Autónoma de Buenos Aires'], 'CABA'],
      [['Ciudad:', 'San Isidro'], 'San Isidro'],
    ])('con rótulo: %j → %s', (lines, expected) => {
      expect(parse(...lines).zone).toBe(expected);
    });

    it('sin rótulo, en los primeros renglones', () => {
      expect(parse('Lucía Fernández', 'Quilmes, Buenos Aires', 'lucia@ejemplo.com').zone).toBe('Quilmes');
    });

    it('un apellido o nombre que coincide con una zona no es la zona', () => {
      expect(parse('Lucía Moreno', 'lucia.moreno@ejemplo.com')).toEqual({
        fullName: 'Lucía Moreno',
        firstName: 'Lucía',
        lastName: 'Moreno',
        email: 'lucia.moreno@ejemplo.com',
      });
      expect(parse('Pilar Gómez', 'Atención al cliente').zone).toBeUndefined();
      expect(parse('Nombre: Rosario', 'Apellido: Paz')).toEqual({ fullName: 'Rosario Paz', firstName: 'Rosario', lastName: 'Paz' });
    });

    it('sin rótulo exige mayúscula inicial ("salta" no es Salta)', () => {
      expect(parse('Lucía Fernández', 'Cuando algo me salta a la vista lo resuelvo').zone).toBeUndefined();
    });

    it('si la localidad no es una zona conocida devuelve lo que dice el rótulo', () => {
      expect(parse('Localidad: Lomas de Zamora   Provincia: Buenos Aires').zone).toBe('Lomas de Zamora');
      expect(parse(`Barrio: ${'Barrio Muy Largo '.repeat(6)}`).zone?.length).toBeLessThanOrEqual(60);
    });

    it('sin datos de ubicación la omite', () => {
      expect(parse('Lucía Fernández', 'Domicilio: Av. Siempreviva 742').zone).toBeUndefined();
    });
  });
});
