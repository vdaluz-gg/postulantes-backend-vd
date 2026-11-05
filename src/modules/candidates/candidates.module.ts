import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { AuthModule } from '../auth/auth.module';
import { Consent } from '../consents/entities/consent.entity';
import { CvDocument } from '../cv/entities/cv-document.entity';
import { Zone } from '../zones/entities/zone.entity';
import { BackofficeCandidatesController } from './backoffice-candidates.controller';
import { CandidateValidationService } from './candidate-validation.service';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { Candidate } from './entities/candidate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candidate, Zone, Application, CvDocument, Consent]), AuthModule],
  controllers: [CandidatesController, BackofficeCandidatesController],
  providers: [CandidatesService, CandidateValidationService],
  exports: [CandidatesService, TypeOrmModule],
})
export class CandidatesModule {}
