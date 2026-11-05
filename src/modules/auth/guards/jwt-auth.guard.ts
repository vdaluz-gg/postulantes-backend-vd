import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AdminProfileDto } from '../dto/auth.dto';
import { AuthService, toAdminProfile } from '../auth.service';

export type AuthenticatedRequest = Request & { admin: AdminProfileDto };

/** Exige un JWT válido de un admin que siga activo (un token de un admin dado de baja deja de servir). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token de acceso');
    let sub: string;
    try {
      ({ sub } = await this.jwt.verifyAsync<{ sub: string }>(token));
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
    const admin = await this.auth.findActive(sub);
    if (!admin) throw new UnauthorizedException('Token inválido o vencido');
    req.admin = toAdminProfile(admin);
    return true;
  }
}
