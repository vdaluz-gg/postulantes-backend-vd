import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { AdminRole } from '../entities/admin.entity';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Mínimo 10 caracteres con mayúscula, minúscula y número. Máximo 72: límite de bcrypt. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,72}$/;

export class RegisterAdminDto {
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: 'La contraseña debe tener entre 10 y 72 caracteres, con mayúscula, minúscula y número' })
  password: string;

  /** Clave interna que habilita dar de alta administradores. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  registrationKey: string;
}

export class LoginDto {
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}

export interface AdminProfileDto {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
}

export interface LoginResponseDto {
  accessToken: string;
  admin: AdminProfileDto;
}
