export interface Coordinate {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Distancia en km entre dos puntos sobre la esfera (fórmula de haversine). */
export function distanceKm(a: Coordinate, b: Coordinate): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const isValidCoordinate = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
