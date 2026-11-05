import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZonesModule } from '../zones/zones.module';
import { JobOffer } from './entities/job-offer.entity';
import { JobOffersController } from './job-offers.controller';
import { JobOffersService } from './job-offers.service';

@Module({
  imports: [TypeOrmModule.forFeature([JobOffer]), ZonesModule],
  controllers: [JobOffersController],
  providers: [JobOffersService],
  exports: [JobOffersService, TypeOrmModule],
})
export class JobOffersModule {}
