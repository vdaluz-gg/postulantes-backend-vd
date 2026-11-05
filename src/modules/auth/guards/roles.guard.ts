import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '../entities/admin.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from './jwt-auth.guard';

/** Si la ruta declara roles con @Roles(), el admin autenticado debe tener uno de ellos. Sin @Roles, pasa cualquier admin. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const { admin } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!admin || !required.includes(admin.role)) throw new ForbiddenException('No tenés permisos para esto');
    return true;
  }
}
