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
import { Interview } from '../interviews/entities/interview.entity';
import { MockEmployeeOnboarding } from './mock-employee-onboarding';
import { EMPLOYEE_ONBOARDING } from './ports/employee-onboarding';

@Module({
  imports: [TypeOrmModule.forFeature([Application, Candidate, JobOffer, CvDocument, Interview]), CandidatesModule, ConsentsModule, AuthModule],
  controllers: [ApplicationsController, BackofficeApplicationsController],
  // Para el alta real: reemplazar MockEmployeeOnboarding por la clase que llame al ADP BOT / ERP.
  providers: [ApplicationsService, { provide: EMPLOYEE_ONBOARDING, useClass: MockEmployeeOnboarding }],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
