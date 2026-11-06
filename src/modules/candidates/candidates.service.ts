import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Page } from '../../common/pagination';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { escapeLike } from '../../common/utils/like';
import { cuilMatchesDni } from '../../common/validators/ar-validators';
import { messageFor } from '../../common/validators/messages';
import { Interview } from '../interviews/entities/interview.entity';
import { Application } from '../applications/entities/application.entity';
import { Consent } from '../consents/entities/consent.entity';
import { CvDocument } from '../cv/entities/cv-document.entity';
import { IdentityVerification } from '../identity/entities/identity-verification.entity';
import { FILE_STORAGE, FileStorage } from '../cv/ports/file-storage';
import { Zone } from '../zones/entities/zone.entity';
import { CandidateNames, resolveCandidateNames } from './candidate-names';
import { CandidateContactDto } from './dto/candidate-contact.dto';
import {
  CandidateDetailDto,
  CandidateDto,
  CreateCandidateDto,
  ListCandidatesQueryDto,
  UpdateCandidateDto,
  toCandidateDto,
} from './dto/candidate.dto';
import { Candidate, CandidateChannel, CandidateSource } from './entities/candidate.entity';

const FULL_NAME_MAX_LENGTH = 160;

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(CvDocument) private readonly cvDocuments: Repository<CvDocument>,
    @InjectRepository(Consent) private readonly consents: Repository<Consent>,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly dataSource: DataSource,
  ) {}

  /** lat y lng van juntas o ninguna. */
  private assertCoordinates(dto: Pick<CandidateContactDto, 'latitude' | 'longitude'>): void {
    const hasLat = dto.latitude !== undefined && dto.latitude !== null;
    const hasLng = dto.longitude !== undefined && dto.longitude !== null;
    if (hasLat !== hasLng) throw new BadRequestException('latitude y longitude se envían juntas');
  }

  /** Los 8 dígitos del medio del CUIL tienen que ser el DNI. */
  private assertCuilMatchesDni(cuil: string | null | undefined, dni: string): void {
    if (cuil && !cuilMatchesDni(cuil, dni)) throw new BadRequestException(messageFor('cuil', 'dniMismatch'));
  }

  /** El nombre completo tiene lugar para 160 caracteres; nombre y apellido (80 cada uno) juntos podrían pasarse. */
  private assertFullNameLength(names: CandidateNames | null): void {
    if (names && names.fullName.length > FULL_NAME_MAX_LENGTH) {
      throw new BadRequestException(`El nombre y el apellido juntos pueden tener hasta ${FULL_NAME_MAX_LENGTH} caracteres.`);
    }
  }

  private async assertZone(zoneId: string | null | undefined): Promise<void> {
    if (zoneId && !(await this.zones.existsBy({ id: zoneId, active: true }))) throw new BadRequestException('La zona no existe');
  }

  private async load(id: string): Promise<Candidate> {
    const c = await this.candidates.findOneBy({ id });
    if (!c) throw new NotFoundException('Postulante no encontrado');
    return c;
  }

  async create(dto: CreateCandidateDto, source: CandidateSource = 'backoffice', channel: CandidateChannel = 'backoffice'): Promise<CandidateDto> {
    this.assertCoordinates(dto);
    this.assertCuilMatchesDni(dto.cuil, dto.dni);
    // El DTO garantiza nombre y apellido o un nombre completo válido.
    const names = resolveCandidateNames(dto);
    if (!names) throw new BadRequestException(messageFor('fullName', 'required'));
    this.assertFullNameLength(names);
    await this.assertZone(dto.zoneId);
    if (await this.candidates.existsBy({ dni: dto.dni })) throw new ConflictException('Ya existe un postulante con ese DNI');
    try {
      const saved = await this.candidates.save(
        this.candidates.create({
          ...names,
          email: dto.email,
          dni: dto.dni,
          cuil: dto.cuil || null,
          whatsapp: dto.whatsapp,
          zoneId: dto.zoneId ?? null,
          position: dto.position || null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          whatsappOptIn: dto.whatsappOptIn ?? false,
          source,
          channel,
        }),
      );
      return toCandidateDto(await this.load(saved.id));
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Ya existe un postulante con ese DNI');
      throw e;
    }
  }

  async list(query: ListCandidatesQueryDto): Promise<Page<CandidateDto>> {
    const qb = this.candidates.createQueryBuilder('c').leftJoinAndSelect('c.zone', 'z');

    const q = query.q?.trim();
    if (q) {
      const digits = q.replace(/\D/g, '');
      const clauses = ['c.fullName ILIKE :like', 'c.email ILIKE :like'];
      const params: Record<string, string> = { like: `%${escapeLike(q)}%` };
      if (digits) {
        clauses.push('c.dni LIKE :digits', 'c.whatsapp LIKE :digits');
        params.digits = `%${digits}%`;
      }
      qb.andWhere(`(${clauses.join(' OR ')})`, params);
    }
    if (query.zoneId) qb.andWhere('c.zoneId = :zoneId', { zoneId: query.zoneId });
    if (query.identityStatus) qb.andWhere('c.identityStatus = :identityStatus', { identityStatus: query.identityStatus });
    if (query.source) qb.andWhere('c.source = :source', { source: query.source });
    if (query.channel) qb.andWhere('c.channel = :channel', { channel: query.channel });

    const [rows, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items: rows.map(toCandidateDto), total, page: query.page, limit: query.limit };
  }

  async findOne(id: string): Promise<CandidateDetailDto> {
    const candidate = await this.load(id);
    const [applications, cvDocuments, consents] = await Promise.all([
      this.applications.find({ where: { candidateId: id }, order: { createdAt: 'DESC' } }),
      this.cvDocuments.find({ where: { candidateId: id }, order: { createdAt: 'DESC' } }),
      this.consents.find({ where: { candidateId: id }, order: { createdAt: 'DESC' } }),
    ]);
    const latest = new Map<string, Consent>();
    for (const c of consents) if (!latest.has(c.type)) latest.set(c.type, c);
    return {
      ...toCandidateDto(candidate),
      applications: applications.map((a) => ({
        id: a.id,
        trackingCode: a.trackingCode,
        position: a.position,
        status: a.status,
        jobOfferCode: a.jobOffer?.code ?? null,
        createdAt: a.createdAt,
      })),
      cvDocuments: cvDocuments.map((d) => ({ id: d.id, originalName: d.originalName, createdAt: d.createdAt })),
      consents: [...latest.values()].map((c) => ({ type: c.type, granted: c.granted, at: c.createdAt })),
    };
  }

  async update(id: string, dto: UpdateCandidateDto): Promise<CandidateDto> {
    const candidate = await this.load(id);
    this.assertCoordinates({
      latitude: dto.latitude === undefined ? candidate.latitude : dto.latitude,
      longitude: dto.longitude === undefined ? candidate.longitude : dto.longitude,
    });
    this.assertCuilMatchesDni(dto.cuil === undefined ? candidate.cuil : dto.cuil, dto.dni ?? candidate.dni);
    if (dto.zoneId !== undefined) await this.assertZone(dto.zoneId);
    if (dto.dni !== undefined && dto.dni !== candidate.dni && (await this.candidates.existsBy({ dni: dto.dni }))) {
      throw new ConflictException('Ya existe un postulante con ese DNI');
    }

    // Los campos obligatorios no aceptan null; los opcionales sí (null los borra).
    const names = resolveCandidateNames(dto, candidate);
    this.assertFullNameLength(names);
    if (names) Object.assign(candidate, names);
    if (dto.email != null) candidate.email = dto.email;
    if (dto.dni != null) candidate.dni = dto.dni;
    if (dto.cuil !== undefined) candidate.cuil = dto.cuil || null;
    if (dto.whatsapp != null) candidate.whatsapp = dto.whatsapp;
    if (dto.whatsappOptIn != null) candidate.whatsappOptIn = dto.whatsappOptIn;
    if (dto.zoneId !== undefined) {
      candidate.zoneId = dto.zoneId;
      candidate.zone = null;
    }
    if (dto.position !== undefined) candidate.position = dto.position || null;
    if (dto.latitude !== undefined) candidate.latitude = dto.latitude;
    if (dto.longitude !== undefined) candidate.longitude = dto.longitude;

    try {
      await this.candidates.save(candidate);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('Ya existe un postulante con ese DNI');
      throw e;
    }
    return toCandidateDto(await this.load(id));
  }

  /** Elimina al postulante y todo lo que depende de él (postulaciones, permisos y CV con sus archivos). */
  async remove(id: string): Promise<void> {
    await this.load(id);
    const cvs = await this.cvDocuments.findBy({ candidateId: id });
    const applicationIds = (await this.applications.find({ where: { candidateId: id }, select: { id: true } })).map((a) => a.id);
    await this.dataSource.transaction(async (tx) => {
      if (applicationIds.length) await tx.delete(Interview, { applicationId: In(applicationIds) });
      await tx.delete(Application, { candidateId: id });
      await tx.delete(Consent, { candidateId: id });
      await tx.delete(IdentityVerification, { candidateId: id });
      await tx.delete(CvDocument, { candidateId: id });
      await tx.delete(Candidate, { id });
    });
    // Los archivos se borran después de confirmar la base: si algo falla acá queda un archivo huérfano
    // (se avisa en el log) pero nunca un registro apuntando a un archivo inexistente.
    for (const cv of cvs) {
      await this.storage.remove(cv.storageKey).catch((e: unknown) => this.logger.warn(`No se pudo borrar el archivo ${cv.storageKey}: ${String(e)}`));
    }
  }
}
