import { Column, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Zone } from '../../zones/entities/zone.entity';

export const CANDIDATE_SOURCES = ['manual', 'cv_ai', 'backoffice'] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/**
 * Por dónde llegó la persona: nueva web, check-in (webapp), portales de empleo (Pandapé, Bumerán), redes
 * sociales, CDC (base de convocatorias del CDO) o carga manual del backoffice. A diferencia de `source`
 * (cómo se cargaron los datos), sirve para medir de qué canal vienen los postulantes.
 */
export const CANDIDATE_CHANNELS = ['new_web', 'checkin', 'job_board', 'social', 'cdc', 'backoffice'] as const;
export type CandidateChannel = (typeof CANDIDATE_CHANNELS)[number];

/** Canales que la propia persona puede declarar desde la API pública; el resto los asigna el equipo. */
export const PUBLIC_CANDIDATE_CHANNELS = ['new_web', 'checkin'] as const;

/** La ficha nace como postulante y pasa a colaborador cuando se la contrata y se la da de alta en el ERP. */
export const PROFILE_STAGES = ['applicant', 'collaborator'] as const;
export type ProfileStage = (typeof PROFILE_STAGES)[number];

/** Estado de la validación de identidad contra RENAPER (hoy siempre "unverified"). */
export const IDENTITY_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

@Entity('candidates')
export class Candidate extends BaseEntity {
  @Column({ type: 'varchar', length: 160 })
  fullName: string;

  @Index()
  @Column({ type: 'varchar', length: 254 })
  email: string;

  /** Solo dígitos. Único entre postulantes. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8 })
  dni: string;

  /** Formato internacional: +5491155550142. */
  @Column({ type: 'varchar', length: 16 })
  whatsapp: string;

  @Column({ type: 'uuid', nullable: true })
  zoneId: string | null;

  @ManyToOne(() => Zone, { nullable: true, eager: true })
  @JoinColumn({ name: 'zoneId' })
  zone: Zone | null;

  /** Puesto al que aspira. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  position: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source: CandidateSource;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'new_web' })
  channel: CandidateChannel;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'applicant' })
  profileStage: ProfileStage;

  /** Legajo en el ERP (KTNA); se completa al dar de alta al colaborador. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  employeeNumber: string | null;

  /** Acepta recibir avisos de ofertas por WhatsApp oficial. */
  @Column({ type: 'boolean', default: false })
  whatsappOptIn: boolean;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'unverified' })
  identityStatus: IdentityStatus;
}
