import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule, APP_ENV } from './config/app-config.module';
import { AppEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CvModule } from './modules/cv/cv.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { JobOffersModule } from './modules/job-offers/job-offers.module';
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
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
