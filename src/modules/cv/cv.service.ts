import { BadGatewayException, BadRequestException, Inject, Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { formatCuil } from '../../common/validators/ar-validators';
import { CandidateValidationService } from '../candidates/candidate-validation.service';
import { ValidateCandidateResponse } from '../candidates/dto/validate-candidate.dto';
import { Zone } from '../zones/entities/zone.entity';
import { detectCvType, sanitizeFileName } from './cv-file-type';
import { CvDocument } from './entities/cv-document.entity';
import { CV_READER, CvReader } from './ports/cv-reader';
import { FILE_STORAGE, FileStorage } from './ports/file-storage';

export interface CvUploadResult {
  cvId: string;
  fileName: string;
  /** Datos que la IA pudo leer, para precargar el formulario. */
  prefill: Record<string, string>;
  /** Resultado de validar esos datos con las mismas reglas del formulario. */
  validation: ValidateCandidateResponse;
}

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(
    @InjectRepository(CvDocument) private readonly documents: Repository<CvDocument>,
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CV_READER) private readonly reader: CvReader,
    private readonly validation: CandidateValidationService,
  ) {}

  async upload(file: Express.Multer.File | undefined): Promise<CvUploadResult> {
    if (!file?.buffer?.length) throw new BadRequestException('Adjuntá tu CV');
    const type = detectCvType(file.buffer);
    if (!type) throw new UnsupportedMediaTypeException('El archivo no es un PDF, DOC o DOCX válido');

    const fileName = sanitizeFileName(file.originalname ?? '');
    const storageKey = `${randomUUID()}.${type.extension}`;
    await this.storage.save(storageKey, file.buffer);

    try {
      const extracted = await this.reader.read({ buffer: file.buffer, mimeType: type.mimeType, fileName }).catch((e: unknown) => {
        // El detalle del proveedor queda en el log del servidor; al cliente no le llega.
        this.logger.error(`El lector de CV falló: ${e instanceof Error ? e.message : String(e)}`);
        throw new BadGatewayException('No pudimos leer tu CV. Completá los datos a mano');
      });

      const zone = extracted.zone ? await this.findZoneByName(extracted.zone) : null;
      const prefill: Record<string, string> = {};
      for (const key of ['fullName', 'firstName', 'lastName', 'email', 'dni', 'whatsapp', 'position'] as const) {
        if (extracted[key]) prefill[key] = extracted[key] as string;
      }
      // En el formulario el CUIL se muestra con guiones; en `extracted` queda solo con dígitos.
      if (extracted.cuil) prefill.cuil = formatCuil(extracted.cuil) || extracted.cuil;
      if (extracted.zone) prefill.zone = extracted.zone;
      if (zone) prefill.zoneId = zone.id;

      const toValidate = Object.fromEntries(Object.entries(prefill).filter(([k]) => k !== 'zone'));
      const validation = Object.keys(toValidate).length
        ? await this.validation.validate(toValidate)
        : { valid: false, fields: {} };

      const doc = await this.documents.save(
        this.documents.create({
          candidateId: null,
          originalName: fileName,
          mimeType: type.mimeType,
          sizeBytes: file.size ?? file.buffer.length,
          storageKey,
          extracted,
        }),
      );
      return { cvId: doc.id, fileName, prefill, validation };
    } catch (e) {
      // Si algo falló después de guardar el archivo, no se deja huérfano.
      await this.storage.remove(storageKey).catch(() => undefined);
      throw e;
    }
  }

  private findZoneByName(name: string): Promise<Zone | null> {
    return this.zones
      .createQueryBuilder('z')
      .where('LOWER(z.name) = :name', { name: name.trim().toLowerCase() })
      .andWhere('z.active = :active', { active: true })
      .getOne();
  }
}
