import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AdminOnly } from './decorators/admin-only.decorator';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminProfileDto, LoginDto, LoginResponseDto, RegisterAdminDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';

/** Intentos por minuto y por IP en las rutas sensibles. */
const SENSITIVE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Backoffice · Acceso')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('register')
  @Throttle(SENSITIVE)
  @ApiOperation({ summary: 'Alta de administrador (requiere la clave de alta)' })
  register(@Body() dto: RegisterAdminDto): Promise<AdminProfileDto> {
    return this.service.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(SENSITIVE)
  @ApiOperation({ summary: 'Iniciar sesión (devuelve un JWT)' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.service.login(dto);
  }

  @Get('me')
  @AdminOnly()
  @ApiOperation({ summary: 'Perfil del administrador autenticado' })
  me(@CurrentAdmin() admin: AdminProfileDto): AdminProfileDto {
    return admin;
  }
}
