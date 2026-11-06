import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { AuthModule } from '../auth/auth.module';
import { Candidate } from '../candidates/entities/candidate.entity';
import { CvDocument } from '../cv/entities/cv-document.entity';
import { JobOffer } from '../job-offers/entities/job-offer.entity';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { MATCHING_ENGINE } from './ports/matching-engine';
import { RulesMatchingEngine } from './rules-matching-engine';

@Module({
  imports: [TypeOrmModule.forFeature([JobOffer, Candidate, CvDocument, Application]), AuthModule],
  controllers: [MatchingController],
  // Para el matching con IA: reemplazar RulesMatchingEngine por la clase que llame al modelo.
  providers: [MatchingService, { provide: MATCHING_ENGINE, useClass: RulesMatchingEngine }],
})
export class MatchingModule {}
