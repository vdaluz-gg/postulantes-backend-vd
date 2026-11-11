import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule, APP_ENV } from './config/app-config.module';
import { AppEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthRequiredGuard } from './modules/auth/guards/auth-required.guard';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CvModule } from './modules/cv/cv.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { JobOffersModule } from './modules/job-offers/job-offers.module';
import { MatchingModule } from './modules/matching/matching.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SiteConfigModule } from './modules/site-config/site-config.module';
import { ZonesModule } from './modules/zones/zones.module';
import { CvStorageModule } from './modules/cv/cv-storage.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => [{ ttl: 60_000, limit: env.THROTTLE_LIMIT }],
    }),
    DatabaseModule,
    CvStorageModule,
    ZonesModule,
    JobOffersModule,
    AuthModule,
    CandidatesModule,
    CvModule,
    ConsentsModule,
    ApplicationsModule,
    IdentityModule,
    InterviewsModule,
    MatchingModule,
    ReportsModule,
    SiteConfigModule,
  ],
  controllers: [HealthController],
  providers: [
    // El orden importa: primero el límite de pedidos, después la autenticación (denegar por defecto).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthRequiredGuard },
  ],
})
export class AppModule {}
