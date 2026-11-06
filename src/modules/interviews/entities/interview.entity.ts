import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Application } from '../../applications/entities/application.entity';
import { InterviewRoom } from './interview-room.entity';

export const INTERVIEW_STATUSES = ['scheduled', 'done', 'cancelled', 'no_show'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/** Estados a los que se puede pasar una entrevista agendada (no se vuelve a "scheduled"). */
export const CLOSING_INTERVIEW_STATUSES = ['done', 'cancelled', 'no_show'] as const;

@Entity('interviews')
@Index(['roomId', 'startsAt'])
export class Interview extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  applicationId: string;

  @ManyToOne(() => Application, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'applicationId' })
  application: Application;

  @Column({ type: 'uuid' })
  roomId: string;

  @ManyToOne(() => InterviewRoom, { nullable: false, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'roomId' })
  room: InterviewRoom;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: InterviewStatus;
}
