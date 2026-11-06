import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Candidate } from '../../candidates/entities/candidate.entity';
import { JobOffer } from '../../job-offers/entities/job-offer.entity';
import type { ApplicationAnswer } from '../../site-config/site-config.rules';

/** Estados de la postulación. Etapas del portal: 1 Postulación, 2 Agente IA, 3 Selectora, 4 Resultado. */
export const APPLICATION_STATUSES = [
  'received',
  'ai_review',
  'recruiter_review',
  'interview',
  'hired',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_STAGE: Record<ApplicationStatus, 1 | 2 | 3 | 4> = {
  received: 1,
  ai_review: 2,
  recruiter_review: 3,
  interview: 3,
  hired: 4,
  rejected: 4,
  withdrawn: 4,
};

export interface ApplicationHistoryEntry {
  at: string;
  status: ApplicationStatus;
  note?: string;
}

@Entity('applications')
export class Application extends BaseEntity {
  /** Código corto para que el postulante consulte su estado: GG-7K2M9Q. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  trackingCode: string;

  @Index()
  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => Candidate, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate: Candidate;

  /** Oferta a la que se postula; vacío en la postulación espontánea. */
  @Column({ type: 'uuid', nullable: true })
  jobOfferId: string | null;

  @ManyToOne(() => JobOffer, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'jobOfferId' })
  jobOffer: JobOffer | null;

  @Column({ type: 'varchar', length: 160 })
  position: string;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'received' })
  status: ApplicationStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: ApplicationHistoryEntry[];

  @Column({ type: 'uuid', nullable: true })
  cvDocumentId: string | null;

  /** Respuestas a los campos que el backoffice agregó al formulario, con la etiqueta que tenían al postularse. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  answers: ApplicationAnswer[];
}
