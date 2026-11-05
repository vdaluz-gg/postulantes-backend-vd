import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Candidate } from '../candidates/entities/candidate.entity';
import { JobOffer } from '../job-offers/entities/job-offer.entity';
import { BackofficeZonesController } from './backoffice-zones.controller';
import { Zone } from './entities/zone.entity';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Zone, JobOffer, Candidate]), AuthModule],
  controllers: [ZonesController, BackofficeZonesController],
  providers: [ZonesService],
  exports: [ZonesService, TypeOrmModule],
})
export class ZonesModule {}
