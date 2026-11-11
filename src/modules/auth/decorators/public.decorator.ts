import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un controlador o una ruta como abierta (sin sesión). Por defecto TODA ruta exige un admin autenticado:
 * un endpoint nuevo al que se le olvide la marca queda cerrado, no abierto.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
