import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminProfileDto } from '../dto/auth.dto';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/** El administrador autenticado de la request (solo en rutas con @AdminOnly). */
export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminProfileDto => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().admin;
});
