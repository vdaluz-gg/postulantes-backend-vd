import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Zone } from '../../zones/entities/zone.entity';

/** Sala de entrevistas de una sede. */
@Entity('interview_rooms')
export class InterviewRoom extends BaseEntity {
  @Column({ type: 'varchar', length: 120, unique: true })
  name: string;

  @Column({ type: 'uuid' })
  zoneId: string;

  @ManyToOne(() => Zone, { nullable: false, eager: true })
  @JoinColumn({ name: 'zoneId' })
  zone: Zone;

  /** Dónde queda: es lo que ve el postulante en su turno. */
  @Column({ type: 'varchar', length: 240, nullable: true })
  address: string | null;

  /** Cuántas personas entran; es informativo, la sala atiende una entrevista por vez. */
  @Column({ type: 'int', default: 1 })
  capacity: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
