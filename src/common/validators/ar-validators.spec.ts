import {
  formatDni,
  normalizeDni,
  normalizeWhatsapp,
  validateDni,
  validateEmail,
  validateFullName,
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
});
