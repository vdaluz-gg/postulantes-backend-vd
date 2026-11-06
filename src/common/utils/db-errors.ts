import { QueryFailedError } from 'typeorm';

/** true si el error es una violación de restricción única de PostgreSQL (23505). */
export const isUniqueViolation = (e: unknown): boolean =>
  e instanceof QueryFailedError && (e.driverError as { code?: string } | undefined)?.code === '23505';
