import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export const VERIFICATION_KINDS = ['dni_data', 'fingerprint', 'face'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
export const VERIFICATION_RESULTS = ['pending', 'verified', 'rejected', 'error'] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

/**
 * Intento de validación de identidad (RENAPER SID). Se guarda el resultado, no los datos biométricos:
 * la huella y la foto nunca se persisten.
 */
@Entity('identity_verifications')
export class IdentityVerification extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  candidateId: string;

  @Column({ type: 'varchar', length: 20 })
  kind: VerificationKind;

  @Column({ type: 'varchar', length: 40 })
  provider: string;

  @Column({ type: 'varchar', length: 20 })
  result: VerificationResult;

  /** Puntaje de coincidencia (0–100) cuando el proveedor lo informa. */
  @Column({ type: 'double precision', nullable: true })
  score: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;
}
