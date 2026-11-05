import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export const ADMIN_ROLES = ['admin', 'superadmin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

@Entity('admins')
export class Admin extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 160 })
  fullName: string;

  /** Hash bcrypt; nunca se devuelve por la API. */
  @Column({ type: 'varchar', length: 100 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: 'admin' })
  role: AdminRole;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
