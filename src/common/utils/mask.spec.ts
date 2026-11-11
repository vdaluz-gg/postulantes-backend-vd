import { maskCuil, maskDni, maskWhatsapp } from './mask';

describe('maskDni', () => {
  it('deja visibles los últimos 4 dígitos', () => {
    expect(maskDni('38412907')).toBe('****2907');
    expect(maskDni('9876543')).toBe('***6543');
  });
  it('un valor demasiado corto se tapa entero', () => {
    expect(maskDni('123')).toBe('***');
    expect(maskDni('')).toBe('');
  });
});

describe('maskWhatsapp', () => {
  it('conserva el prefijo +54 y los últimos 4 dígitos', () => {
    expect(maskWhatsapp('+5491155550142')).toBe('+54*******0142');
  });
  it('un formato inesperado se tapa salvo los últimos 4 caracteres', () => {
    expect(maskWhatsapp('1155550142')).toBe('******0142');
    expect(maskWhatsapp('')).toBe('');
  });
});

describe('maskCuil', () => {
  it('tapa el prefijo, el dígito verificador y el DNI salvo sus últimos 4 dígitos', () => {
    expect(maskCuil('27-40123456-5')).toBe('**-****3456-*');
    expect(maskCuil('27401234565')).toBe('**-****3456-*');
  });
  it('sin CUIL o con un formato inválido no devuelve nada que se pueda reconstruir', () => {
    expect(maskCuil(null)).toBeNull();
    expect(maskCuil('abc')).toBe('***');
  });
});
