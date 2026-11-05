import { distanceKm, isValidCoordinate } from './geo';

describe('geo', () => {
  it('la distancia de un punto a sí mismo es 0', () => {
    expect(distanceKm({ lat: -34.6, lng: -58.4 }, { lat: -34.6, lng: -58.4 })).toBe(0);
  });

  it('calcula la distancia aproximada Obelisco → Quilmes (~16 km)', () => {
    const km = distanceKm({ lat: -34.6037, lng: -58.3816 }, { lat: -34.7206, lng: -58.2546 });
    expect(km).toBeGreaterThan(15);
    expect(km).toBeLessThan(19);
  });

  it('es simétrica', () => {
    const a = { lat: -24.78, lng: -65.42 };
    const b = { lat: -32.94, lng: -60.65 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });

  it('valida rangos de latitud y longitud', () => {
    expect(isValidCoordinate(-34.6, -58.4)).toBe(true);
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
  });
});
