import { Application } from '../modules/applications/entities/application.entity';
import { Admin } from '../modules/auth/entities/admin.entity';
import { Candidate } from '../modules/candidates/entities/candidate.entity';
import { Consent } from '../modules/consents/entities/consent.entity';
import { CvDocument } from '../modules/cv/entities/cv-document.entity';
import { IdentityVerification } from '../modules/identity/entities/identity-verification.entity';
import { JobOffer } from '../modules/job-offers/entities/job-offer.entity';
import { Zone } from '../modules/zones/entities/zone.entity';

/** Lista única de entidades: la usan la app, el CLI de migraciones y los tests. */
export const ALL_ENTITIES = [Zone, JobOffer, Candidate, Application, CvDocument, Consent, Admin, IdentityVerification];
