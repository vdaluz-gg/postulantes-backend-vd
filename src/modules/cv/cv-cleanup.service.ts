import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { errorForLog } from '../../common/utils/redact';
import { APP_ENV } from '../../config/app-config.module';
import { AppEnv } from '../../config/env.validation';
import { CvDocument } from './entities/cv-document.entity';
import { FILE_STORAGE, FileStorage } from './ports/file-storage';

/** Cada cuánto corre la limpieza. */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Borra los CV que se subieron pero nunca se asociaron a una postulación (la persona cerró la pestaña a mitad del
 * formulario). Sin esto se acumulan para siempre: ocupan disco, guardan datos personales que nadie va a usar y
 * cualquiera podría llenar el disco subiendo archivos. Solo corre si CV_CLEANUP_ENABLED=true (por defecto, solo en
 * producción), así que en local no se pierde ningún archivo mientras se prueba.
 */
@Injectable()
export class CvCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CvCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(CvDocument) private readonly documents: Repository<CvDocument>,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  onModuleInit(): void {
    if (!this.env.CV_CLEANUP_ENABLED) return;
    this.timer = setInterval(() => void this.run(), CLEANUP_INTERVAL_MS);
    this.timer.unref(); // no mantiene viva la app si todo lo demás terminó
  }

  /** Libera el temporizador al apagar la app. */
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async run(): Promise<void> {
    try {
      const removed = await this.purgeOrphans(new Date(Date.now() - this.env.CV_ORPHAN_TTL_HOURS * HOUR_MS));
      if (removed) this.logger.log(`CV sin postulante eliminados: ${removed}`);
    } catch (e) {
      this.logger.error(`Falló la limpieza de CV sin postulante: ${errorForLog(e)}`);
    }
  }

  /**
   * Elimina los CV sin postulante creados antes de `olderThan` y devuelve cuántos eran. Primero se borra el registro y
   * después el archivo: si el archivo no se puede borrar queda un archivo huérfano (se avisa en el log) pero nunca un
   * registro que apunte a un archivo inexistente.
   */
  async purgeOrphans(olderThan: Date): Promise<number> {
    const orphans = await this.documents.find({
      where: { candidateId: IsNull(), createdAt: LessThan(olderThan) },
      select: { id: true, storageKey: true },
    });
    if (!orphans.length) return 0;
    await this.documents.delete({ id: In(orphans.map((d) => d.id)) });
    for (const doc of orphans) {
      await this.storage
        .remove(doc.storageKey)
        .catch((e: unknown) => this.logger.warn(`No se pudo borrar el archivo ${doc.storageKey}: ${errorForLog(e)}`));
    }
    return orphans.length;
  }
}
