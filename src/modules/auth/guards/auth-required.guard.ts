import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Guard global: toda ruta exige un admin activo (y sus roles, si la ruta los declara con @Roles) salvo las que
 * llevan @Public(). Va después del límite de pedidos, así los intentos con tokens falsos también se cuentan.
 */
@Injectable()
export class AuthRequiredGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuth: JwtAuthGuard,
    private readonly roles: RolesGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    await this.jwtAuth.canActivate(context);
    return this.roles.canActivate(context);
  }
}
