import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export const CONSENT_TYPES = ['voice', 'camera', 'location'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Registro de que la persona aceptó (o rechazó) un permiso del navegador. */
@Entity('consents')
export class Consent extends BaseEntity {
  /** Identificador anónimo de la sesión del navegador (antes de que exista el postulante). */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  sessionId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  candidateId: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: ConsentType;

  @Column({ type: 'boolean' })
  granted: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;
}
