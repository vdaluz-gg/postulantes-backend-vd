import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

/**
 * Documenta en Swagger que la ruta es privada del backoffice (candado y respuestas 401/403).
 * La protección real es el guard global (AuthRequiredGuard): todo lo que no sea @Public() ya exige sesión
 * de admin, lleve o no esta marca.
 */
export const AdminOnly = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Falta el token o es inválido' }),
    ApiForbiddenResponse({ description: 'Sin permisos' }),
  );
