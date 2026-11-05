import { escapeLike } from './like';

describe('escapeLike', () => {
  it('deja intacto el texto común', () => expect(escapeLike('Martina')).toBe('Martina'));
  it('escapa los comodines de LIKE', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
  });
  it('escapa la barra invertida primero', () => expect(escapeLike('a\\b%')).toBe('a\\\\b\\%'));
});
