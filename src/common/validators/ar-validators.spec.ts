import {
  cuilMatchesDni,
  formatCuil,
  formatDni,
  normalizeCuil,
  normalizeDni,
  normalizeWhatsapp,
  validateDni,
  validateEmail,
  validateCuil,
  validateFullName,
  validateName,
  validateWhatsapp,
} from './ar-validators';

describe('ar-validators', () => {
  describe('validateFullName', () => {
    it.each(['Martina Rodríguez', "Ana María O'Connor", 'Juan-Carlos Pérez Gómez'])('acepta %s', (v) => {
      expect(validateFullName(v)).toEqual({ valid: true });
    });
    it('pide apellido cuando hay una sola palabra', () => {
      expect(validateFullName('Martina')).toEqual({ valid: false, code: 'missingLastName' });
    });
    it.each(['Martina 3', 'Mar@tina Pérez', '12345 678'])('rechaza caracteres inválidos en %s', (v) => {
      expect(validateFullName(v)).toEqual({ valid: false, code: 'invalidChars' });
    });
    it('rechaza vacío y solo espacios', () => {
      expect(validateFullName('')).toEqual({ valid: false, code: 'required' });
      expect(validateFullName('   ')).toEqual({ valid: false, code: 'required' });
    });
  });

  describe('validateEmail', () => {
    it('acepta un mail común', () => expect(validateEmail('mar@ejemplo.com.ar')).toEqual({ valid: true }));
    it.each(['mar@', 'mar.com', '@ejemplo.com', 'mar @ejemplo.com'])('rechaza %s', (v) => {
      expect(validateEmail(v)).toEqual({ valid: false, code: 'invalid' });
    });
    it('rechaza vacío', () => expect(validateEmail('')).toEqual({ valid: false, code: 'required' }));
  });

  describe('validateDni / normalizeDni / formatDni', () => {
    it.each(['38412907', '38.412.907', '5.123.456', ' 38412907 '])('acepta %s', (v) => {
      expect(validateDni(v)).toEqual({ valid: true });
    });
    it.each(['1234567890', '123456', 'abc12345', '38-412-907'])('rechaza %s', (v) => {
      expect(validateDni(v)).toEqual({ valid: false, code: 'invalid' });
    });
    it('rechaza vacío', () => expect(validateDni('')).toEqual({ valid: false, code: 'required' }));
    it('normaliza a solo dígitos', () => expect(normalizeDni('38.412.907')).toBe('38412907'));
    it('formatea con puntos de miles', () => {
      expect(formatDni('38412907')).toBe('38.412.907');
      expect(formatDni('')).toBe('');
    });
  });

  describe('validateWhatsapp / normalizeWhatsapp', () => {
    it.each(['11 5555-0142', '1155550142', '+54 9 11 5555-0142', '(011) 5555-0142', '5491155550142'])(
      'acepta %s',
      (v) => expect(validateWhatsapp(v)).toEqual({ valid: true }),
    );
    it.each(['5555-0142', '12345', '11 5555-014x', '+54 9 11 5555-01421'])('rechaza %s', (v) => {
      expect(validateWhatsapp(v)).toEqual({ valid: false, code: 'invalid' });
    });
    it('rechaza vacío', () => expect(validateWhatsapp('')).toEqual({ valid: false, code: 'required' }));
    it('normaliza al formato internacional de WhatsApp', () => {
      expect(normalizeWhatsapp('11 5555-0142')).toBe('+5491155550142');
      expect(normalizeWhatsapp('+54 9 11 5555-0142')).toBe('+5491155550142');
      expect(normalizeWhatsapp('(011) 5555-0142')).toBe('+5491155550142');
    });
  });

  describe('validateName', () => {
    it.each(['Lucía', 'María José', "O'Connor", 'Pérez-Gómez', 'de los Ángeles'])('acepta %s', (v) => {
      expect(validateName(v)).toEqual({ valid: true });
    });
    it.each(['Lucía3', 'Lu@cía', '-Lucía', '123'])('rechaza caracteres inválidos en %s', (v) => {
      expect(validateName(v)).toEqual({ valid: false, code: 'invalidChars' });
    });
    it('rechaza vacío y solo espacios', () => {
      expect(validateName('')).toEqual({ valid: false, code: 'required' });
      expect(validateName('   ')).toEqual({ valid: false, code: 'required' });
      expect(validateName(undefined)).toEqual({ valid: false, code: 'required' });
    });
    it('rechaza más de 80 caracteres', () => {
      expect(validateName('a'.repeat(80))).toEqual({ valid: true });
      expect(validateName('a'.repeat(81))).toEqual({ valid: false, code: 'invalid' });
    });
  });

  describe('validateCuil / normalizeCuil / formatCuil / cuilMatchesDni', () => {
    it.each(['20-40123456-0', '27-40123456-5', '23-40123451-9', '24-40123456-6', '27401234565', '27 40123456 5', ' 27-38412907-8 '])(
      'acepta %s',
      (v) => expect(validateCuil(v)).toEqual({ valid: true }),
    );
    it.each([
      ['27-40123456-3', 'dígito verificador incorrecto'],
      ['20-40123451-0', 'el verificador daría 10'],
      ['30-40123456-6', 'prefijo de empresa'],
      ['33-40123456-6', 'prefijo de empresa'],
      ['21-40123456-0', 'prefijo inexistente'],
      ['27-4012345-5', 'faltan dígitos'],
      ['27-401234567-5', 'sobran dígitos'],
      ['27.40123456.5', 'puntos'],
      ['27-4012345A-5', 'letras'],
    ])('rechaza %s (%s)', (v) => {
      expect(validateCuil(v)).toEqual({ valid: false, code: 'invalid' });
    });
    it('rechaza vacío', () => expect(validateCuil('')).toEqual({ valid: false, code: 'required' }));
    it('normaliza a 11 dígitos y formatea con guiones', () => {
      expect(normalizeCuil('27-40123456-5')).toBe('27401234565');
      expect(normalizeCuil('27 40123456 5')).toBe('27401234565');
      expect(formatCuil('27401234565')).toBe('27-40123456-5');
      expect(formatCuil('27-40123456-5')).toBe('27-40123456-5');
      expect(formatCuil('')).toBe('');
    });
    it('compara el CUIL con el DNI (los 8 dígitos del medio, con ceros a la izquierda)', () => {
      expect(cuilMatchesDni('27-40123456-5', '40.123.456')).toBe(true);
      expect(cuilMatchesDni('27401234565', '40123457')).toBe(false);
      expect(cuilMatchesDni('20051234562', '5.123.456')).toBe(true);
    });
  });
});
