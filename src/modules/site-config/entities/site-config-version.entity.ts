import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export const SITE_CONFIG_STATUSES = ['draft', 'published'] as const;
export type SiteConfigStatus = (typeof SITE_CONFIG_STATUSES)[number];

/**
 * Cada vez que el backoffice guarda o publica queda una versión nueva (historial completo). Lo vigente para
 * editar es la última versión; lo que ven los portales es la última publicada.
 */
@Entity('site_config_versions')
export class SiteConfigVersion extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'int' })
  version: number;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  status: SiteConfigStatus;

  /** Configuración de cada público (postulantes, clientes, colaboradores). */
  @Column({ type: 'jsonb' })
  audiences: Record<string, unknown>;

  /** Nombre de quien guardó o publicó. */
  @Column({ type: 'varchar', length: 160 })
  updatedBy: string;
}
