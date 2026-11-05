import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { APP_ENV } from '../../config/app-config.module';
import { AppEnv } from '../../config/env.validation';
import { AdminProfileDto, LoginDto, LoginResponseDto, RegisterAdminDto } from './dto/auth.dto';
import { Admin } from './entities/admin.entity';

const BCRYPT_ROUNDS = 12;
/** Hash de relleno: se compara igual cuando el mail no existe, para que el tiempo de respuesta no delate cuentas. */
const DUMMY_HASH = bcrypt.hashSync('relleno-para-igualar-tiempos', BCRYPT_ROUNDS);

export const toAdminProfile = (a: Admin): AdminProfileDto => ({ id: a.id, email: a.email, fullName: a.fullName, role: a.role });

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin) private readonly admins: Repository<Admin>,
    private readonly jwt: JwtService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /** Compara las claves con hash + timingSafeEqual para no filtrar información por tiempos. */
  private registrationKeyMatches(given: string): boolean {
    const a = createHash('sha256').update(given).digest();
    const b = createHash('sha256').update(this.env.ADMIN_REGISTRATION_KEY).digest();
    return timingSafeEqual(a, b);
  }

  async register(dto: RegisterAdminDto): Promise<AdminProfileDto> {
    if (!this.registrationKeyMatches(dto.registrationKey)) throw new ForbiddenException('Clave de alta inválida');
    if (await this.admins.existsBy({ email: dto.email })) throw new ConflictException('Ese mail ya está registrado');
    const admin = await this.admins.save(
      this.admins.create({
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: 'admin',
        active: true,
      }),
    );
    return toAdminProfile(admin);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const admin = await this.admins.findOneBy({ email: dto.email });
    const ok = await bcrypt.compare(dto.password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok || !admin.active) throw new UnauthorizedException('Credenciales inválidas');
    const accessToken = await this.jwt.signAsync({ sub: admin.id, role: admin.role });
    return { accessToken, admin: toAdminProfile(admin) };
  }

  /** Admin activo para el id del token; null si no existe o está dado de baja. */
  findActive(id: string): Promise<Admin | null> {
    return this.admins.findOneBy({ id, active: true });
  }
}
