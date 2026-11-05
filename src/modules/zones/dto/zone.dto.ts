import { Zone } from '../entities/zone.entity';

export interface ZoneDto {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
}

export const toZoneDto = (z: Zone): ZoneDto => ({
  id: z.id,
  name: z.name,
  province: z.province,
  latitude: z.latitude,
  longitude: z.longitude,
});
