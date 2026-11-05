import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Zone } from '../zones/entities/zone.entity';
import { ZonesModule } from '../zones/zones.module';
import { BackofficeJobOffersController } from './backoffice-job-offers.controller';
import { BackofficeJobOffersService } from './backoffice-job-offers.service';
import { JobOffer } from './entities/job-offer.entity';
import { JobOffersController } from './job-offers.controller';
import { JobOffersService } from './job-offers.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobOffer, Zone]), ZonesModule, AuthModule],
  controllers: [JobOffersController, BackofficeJobOffersController],
  providers: [JobOffersService, BackofficeJobOffersService],
  exports: [JobOffersService, TypeOrmModule],
})
export class JobOffersModule {}
