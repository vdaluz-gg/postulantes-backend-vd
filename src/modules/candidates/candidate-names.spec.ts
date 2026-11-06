import { resolveCandidateNames, splitFullName } from './candidate-names';

describe('splitFullName', () => {
  it.each([
    ['Lucía Fernández', 'Lucía', 'Fernández'],
    ['María José Pérez', 'María José', 'Pérez'],
    ['Juan Carlos Pérez Gómez', 'Juan Carlos', 'Pérez Gómez'],
    ['Ana María de la Torre', 'Ana María', 'de la Torre'],
    ['  Lucía    Fernández ', 'Lucía', 'Fernández'],
  ])('%s → %s / %s', (full, firstName, lastName) => {
    expect(splitFullName(full)).toEqual({ firstName, lastName });
  });

  it('con una sola palabra no inventa el apellido', () => {
    expect(splitFullName('Lucía')).toEqual({ firstName: 'Lucía', lastName: null });
  });

  it('vacío no devuelve nada', () => {
    expect(splitFullName('  ')).toEqual({ firstName: null, lastName: null });
  });
});

describe('resolveCandidateNames', () => {
  it('nombre y apellido separados arman el nombre completo (y ganan sobre uno enviado)', () => {
    expect(resolveCandidateNames({ firstName: 'Lucía', lastName: 'Fernández' })).toEqual({
      firstName: 'Lucía',
      lastName: 'Fernández',
      fullName: 'Lucía Fernández',
    });
    expect(
      resolveCandidateNames({ firstName: 'Lucía', lastName: 'Fernández', fullName: 'Otra Persona' }),
    ).toEqual({
      firstName: 'Lucía',
      lastName: 'Fernández',
      fullName: 'Lucía Fernández',
    });
  });

  it('solo el nombre completo (clientes anteriores): lo separa', () => {
    expect(resolveCandidateNames({ fullName: 'María José Pérez' })).toEqual({
      firstName: 'María José',
      lastName: 'Pérez',
      fullName: 'María José Pérez',
    });
  });

  it('con el nombre completo y solo una de las partes, manda el nombre completo', () => {
    expect(resolveCandidateNames({ fullName: 'María José Pérez', firstName: 'María' })).toEqual({
      firstName: 'María José',
      lastName: 'Pérez',
      fullName: 'María José Pérez',
    });
  });

  it('al editar una sola parte conserva la otra', () => {
    const current = { firstName: 'Lucía', lastName: 'Fernández', fullName: 'Lucía Fernández' };
    expect(resolveCandidateNames({ lastName: 'Gómez' }, current)).toEqual({
      firstName: 'Lucía',
      lastName: 'Gómez',
      fullName: 'Lucía Gómez',
    });
    expect(resolveCandidateNames({ firstName: 'Ana' }, current)).toEqual({
      firstName: 'Ana',
      lastName: 'Fernández',
      fullName: 'Ana Fernández',
    });
  });

  it('al editar una parte de una ficha anterior (sin nombre separado) separa primero el nombre guardado', () => {
    const legacy = { firstName: null, lastName: null, fullName: 'Lucía Fernández' };
    expect(resolveCandidateNames({ lastName: 'Gómez' }, legacy)).toEqual({
      firstName: 'Lucía',
      lastName: 'Gómez',
      fullName: 'Lucía Gómez',
    });
  });

  it('sin datos de nombre no cambia nada', () => {
    expect(resolveCandidateNames({})).toBeNull();
    expect(
      resolveCandidateNames({}, { firstName: 'Lucía', lastName: 'Fernández', fullName: 'Lucía Fernández' }),
    ).toBeNull();
  });
});
