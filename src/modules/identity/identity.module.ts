import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_ENV } from '../../config/app-config.module';
import { AppEnv } from '../../config/env.validation';
import { AuthModule } from '../auth/auth.module';
import { Candidate } from '../candidates/entities/candidate.entity';
import { BackofficeIdentityController } from './backoffice-identity.controller';
import { IdentityVerification } from './entities/identity-verification.entity';
import { IdentityService } from './identity.service';
import { MockIdentityProvider } from './mock-identity-provider';
import { IDENTITY_PROVIDER, IdentityValidationProvider } from './ports/identity-validation-provider';
import { RenaperSidProvider } from './renaper-sid.provider';

@Module({
  imports: [TypeOrmModule.forFeature([IdentityVerification, Candidate]), AuthModule],
  controllers: [BackofficeIdentityController],
  providers: [
    IdentityService,
    {
      provide: IDENTITY_PROVIDER,
      inject: [APP_ENV],
      // RENAPER_ENABLED=false (por defecto): proveedor mock. Con true, el real (hoy es un esqueleto).
      useFactory: (env: AppEnv): IdentityValidationProvider => (env.RENAPER_ENABLED ? new RenaperSidProvider(env) : new MockIdentityProvider()),
    },
  ],
})
export class IdentityModule {}
