import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Zone } from '../../zones/entities/zone.entity';

export const OFFER_STATUSES = ['draft', 'published', 'closed'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Ficha interna de la búsqueda: nunca sale por la API pública. */
export interface OfferInternalData {
  client?: string;
  managingCompany?: string;
  businessArea?: string;
  positionId?: number;
  type?: string;
  scope?: string;
  priority?: string;
  searchTypeId?: number;
  modalityId?: number;
  hierarchyId?: number;
  collectiveAgreement?: string;
  branch?: string;
  category?: string;
  experienceRequired?: boolean;
  reinstatableDismissal?: boolean;
  requiresUniform?: boolean;
  preEmploymentExam?: boolean;
  clientNotes?: string;
}

@Entity('job_offers')
export class JobOffer extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid' })
  zoneId: string;

  @ManyToOne(() => Zone, { nullable: false, eager: true })
  @JoinColumn({ name: 'zoneId' })
  zone: Zone;

  /** Rubro publicado: "Logística", "RR. HH.". */
  @Column({ type: 'varchar', length: 80 })
  area: string;

  @Column({ type: 'varchar', length: 160 })
  schedule: string;

  /** Fecha de publicación (AAAA-MM-DD). */
  @Column({ type: 'varchar', length: 10 })
  publishedAt: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  requirements: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  benefits: string[];

  @Column({ type: 'int', default: 1 })
  vacancies: number;

  @Column({ type: 'double precision', nullable: true })
  salary: number | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  address: string | null;

  /** Ubicación del puesto (para "ofertas cerca"). Si falta, se usa la de la zona. */
  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'int', default: 20 })
  radiusKm: number;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'published' })
  status: OfferStatus;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  internal: OfferInternalData;
}
