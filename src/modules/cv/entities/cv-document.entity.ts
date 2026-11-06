import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Datos que la IA pudo extraer del CV. */
export interface CvExtractedData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Con puntos: 40.123.456. */
  dni?: string;
  /** Solo dígitos: 27401234565. */
  cuil?: string;
  whatsapp?: string;
  zone?: string;
  position?: string;
  skills?: string[];
}

@Entity('cv_documents')
export class CvDocument extends BaseEntity {
  /** Postulante dueño del CV; se completa al postularse. */
  @Column({ type: 'uuid', nullable: true })
  candidateId: string | null;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  /** Clave en el almacenamiento (nombre generado por el servidor, nunca el del usuario). */
  @Column({ type: 'varchar', length: 120 })
  storageKey: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  extracted: CvExtractedData;
}
