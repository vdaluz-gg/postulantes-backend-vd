import { MatchCandidate, MatchOffer, scoreMatch } from './match-scoring';

const offer: MatchOffer = {
  zoneId: 'z-monte-grande',
  latitude: -34.81,
  longitude: -58.47,
  radiusKm: 20,
  title: 'Operario/a de producción · Feteados',
  area: 'Industria',
  requirements: ['Experiencia en planta'],
};

const candidate: MatchCandidate = {
  zoneId: 'z-monte-grande',
  latitude: null,
  longitude: null,
  position: 'Operario de producción',
  identityVerified: true,
  hasCv: true,
};

describe('scoreMatch', () => {
  it('suma zona, puesto, identidad y CV: 100 es el máximo', () => {
    expect(scoreMatch(candidate, offer)).toEqual({ score: 100, reasons: ['zone', 'position', 'identity', 'cv'] });
  });

  it('sin identidad verificada ni CV pierde esos puntos', () => {
    const r = scoreMatch({ ...candidate, identityVerified: false, hasCv: false }, offer);
    expect(r).toEqual({ score: 80, reasons: ['zone', 'position'] });
  });

  it('otra zona pero dentro del radio de la oferta: puntúa "nearby" (menos que la misma zona)', () => {
    const r = scoreMatch({ ...candidate, zoneId: 'z-otra', latitude: -34.82, longitude: -58.48 }, offer);
    expect(r.reasons).toContain('nearby');
    expect(r.reasons).not.toContain('zone');
    expect(r.score).toBe(80);
  });

  it('otra zona y fuera del radio: no suma ubicación', () => {
    const r = scoreMatch({ ...candidate, zoneId: 'z-otra', latitude: -27.46, longitude: -58.83 }, offer);
    expect(r.reasons).not.toContain('zone');
    expect(r.reasons).not.toContain('nearby');
    expect(r.score).toBe(60);
  });

  it('otra zona y sin coordenadas: no suma ubicación', () => {
    expect(scoreMatch({ ...candidate, zoneId: 'z-otra' }, offer).score).toBe(60);
    expect(scoreMatch({ ...candidate, zoneId: null }, offer).score).toBe(60);
  });

  it('el puesto puntúa en proporción a las palabras que coinciden', () => {
    const half = scoreMatch({ ...candidate, position: 'Operario administrativo', identityVerified: false, hasCv: false }, offer);
    expect(half.score).toBe(40 + 20);
    expect(half.reasons).toContain('position');
  });

  it('ignora tildes, mayúsculas y palabras vacías al comparar el puesto', () => {
    const r = scoreMatch({ ...candidate, position: 'PRODUCCIÓN para la planta', identityVerified: false, hasCv: false }, offer);
    expect(r.reasons).toContain('position');
  });

  it('también compara con el rubro y los requisitos de la oferta', () => {
    const r = scoreMatch({ ...candidate, position: 'Industria', identityVerified: false, hasCv: false }, offer);
    expect(r.score).toBe(80);
  });

  it('sin puesto declarado o sin coincidencias no suma puesto', () => {
    expect(scoreMatch({ ...candidate, position: null }, offer).reasons).not.toContain('position');
    expect(scoreMatch({ ...candidate, position: 'Chofer' }, offer).reasons).not.toContain('position');
  });

  it('una oferta sin coordenadas solo puntúa por zona', () => {
    const noCoords = { ...offer, latitude: null, longitude: null };
    expect(scoreMatch({ ...candidate, zoneId: 'z-otra', latitude: -34.82, longitude: -58.48 }, noCoords).reasons).not.toContain('nearby');
  });
});
