import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { Candidate } from '../candidates/entities/candidate.entity';
import { ConsentsModule } from '../consents/consents.module';
import { CvDocument } from '../cv/entities/cv-document.entity';
import { JobOffer } from '../job-offers/entities/job-offer.entity';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { BackofficeApplicationsController } from './backoffice-applications.controller';
import { Application } from './entities/application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Application, Candidate, JobOffer, CvDocument]), CandidatesModule, ConsentsModule, AuthModule],
  controllers: [ApplicationsController, BackofficeApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
