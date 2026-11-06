import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { SaveSiteConfigDto, SiteConfigDto } from './dto/site-config.dto';
import { SiteConfigStatus, SiteConfigVersion } from './entities/site-config-version.entity';
import { Audience, AUDIENCES, applicationFields, ApplicationAnswer, checkAnswers, findConfigProblem } from './site-config.rules';

const CONFLICT = 'Otra persona guardó cambios mientras editabas. Recargá para ver la última versión.';

const toDto = (v: SiteConfigVersion): SiteConfigDto => ({
  version: v.version,
  status: v.status,
  updatedAt: v.createdAt.toISOString(),
  updatedBy: v.updatedBy,
  audiences: v.audiences,
});

@Injectable()
export class SiteConfigService {
  constructor(
    @InjectRepository(SiteConfigVersion) private readonly versions: Repository<SiteConfigVersion>,
    private readonly dataSource: DataSource,
  ) {}

  /** Última versión (borrador o publicada): la que se edita en el backoffice. */
  async current(): Promise<SiteConfigDto> {
    const last = await this.versions.findOne({ where: {}, order: { version: 'DESC' } });
    if (!last) throw new NotFoundException('Todavía no hay configuración guardada');
    return toDto(last);
  }

  save(dto: SaveSiteConfigDto, author: string): Promise<SiteConfigDto> {
    return this.store(dto, 'draft', author);
  }

  publish(dto: SaveSiteConfigDto, author: string): Promise<SiteConfigDto> {
    return this.store(dto, 'published', author);
  }

  /** Configuración publicada de un público, para su portal. */
  async published(audience: string): Promise<Record<string, unknown>> {
    const config = AUDIENCES.includes(audience as Audience) ? (await this.lastPublished())?.audiences[audience] : undefined;
    if (!config) throw new NotFoundException('No hay configuración publicada para ese portal');
    return config as Record<string, unknown>;
  }

  /**
   * Revisa las respuestas a los campos que el backoffice agregó al formulario de postulación (según lo
   * publicado). Sin configuración publicada no hay campos extra y no se guarda nada.
   */
  async checkApplicationAnswers(answers: Record<string, unknown>): Promise<ApplicationAnswer[]> {
    const published = await this.lastPublished();
    if (!published) return [];
    const result = checkAnswers(applicationFields(published.audiences), answers);
    if ('error' in result) throw new BadRequestException(result.error);
    return result.answers;
  }

  private lastPublished(): Promise<SiteConfigVersion | null> {
    return this.versions.findOne({ where: { status: 'published' }, order: { version: 'DESC' } });
  }

  private async store(dto: SaveSiteConfigDto, status: SiteConfigStatus, author: string): Promise<SiteConfigDto> {
    const problem = findConfigProblem(dto.audiences);
    if (problem) throw new BadRequestException(problem);
    try {
      return await this.dataSource.transaction(async (tx) => {
        const repo = tx.getRepository(SiteConfigVersion);
        const last = await repo.findOne({ where: {}, order: { version: 'DESC' } });
        if (last && dto.version !== last.version) throw new ConflictException(CONFLICT);
        const saved = await repo.save(
          repo.create({ version: Math.max(last?.version ?? 0, dto.version) + 1, status, audiences: dto.audiences, updatedBy: author }),
        );
        return toDto(saved);
      });
    } catch (e) {
      // Dos guardados a la vez sobre la misma versión: el segundo choca con el índice único.
      if (isUniqueViolation(e)) throw new ConflictException(CONFLICT);
      throw e;
    }
  }
}
