import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { Page } from '../../common/pagination';
import { CandidatesService } from '../candidates/candidates.service';
import { Candidate } from '../candidates/entities/candidate.entity';
import { ConsentsService } from '../consents/consents.service';
import { Consent } from '../consents/entities/consent.entity';
import { CvDocument } from '../cv/entities/cv-document.entity';
import { Interview } from '../interviews/entities/interview.entity';
import { JobOffer } from '../job-offers/entities/job-offer.entity';
import { SiteConfigService } from '../site-config/site-config.service';
import { appendHistory, buildSteps, canTransition, generateTrackingCode, isFinalStatus, TRACKING_CODE_PATTERN } from './application-flow';
import {
  ApplicationDetailDto,
  ApplicationSummaryDto,
  ApplyDto,
  ApplyResponseDto,
  ListApplicationsQueryDto,
  TrackingDto,
  UpdateApplicationStatusDto,
  offerRef,
  onboardingOf,
  toSummary,
} from './dto/application.dto';
import { Application, STATUS_STAGE } from './entities/application.entity';
import { EMPLOYEE_ONBOARDING, EmployeeOnboarding } from './ports/employee-onboarding';

export const SPONTANEOUS_POSITION = 'Postulación espontánea';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(JobOffer) private readonly offers: Repository<JobOffer>,
    @InjectRepository(CvDocument) private readonly cvs: Repository<CvDocument>,
    @InjectRepository(Interview) private readonly interviews: Repository<Interview>,
    @Inject(EMPLOYEE_ONBOARDING) private readonly onboarding: EmployeeOnboarding,
    private readonly candidatesService: CandidatesService,
    private readonly consentsService: ConsentsService,
    private readonly siteConfig: SiteConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Público ----------

  async apply(dto: ApplyDto): Promise<ApplyResponseDto> {
    const offer = dto.offerCode ? await this.offers.findOneBy({ code: dto.offerCode, status: 'published' }) : null;
    if (dto.offerCode && !offer) throw new NotFoundException('Oferta no encontrada');
    const position = offer?.title ?? (dto.position?.trim() || SPONTANEOUS_POSITION);
    const answers = await this.siteConfig.checkApplicationAnswers(dto.answers ?? {});

    // Con un DNI ya registrado solo se reutiliza al postulante si el mail coincide: así nadie pisa los datos de otra persona.
    const existing = await this.candidates.findOneBy({ dni: dto.dni });
    if (existing && existing.email !== dto.email) {
      throw new ConflictException('No pudimos registrar tu postulación con esos datos. Escribinos a RR. HH.');
    }
    if (existing && offer && (await this.applications.existsBy({ candidateId: existing.id, jobOfferId: offer.id }))) {
      throw new ConflictException('Ya te postulaste a esta oferta');
    }

    const cv = dto.cvId ? await this.cvs.findOneBy({ id: dto.cvId }) : null;
    if (dto.cvId && (!cv || (cv.candidateId && cv.candidateId !== existing?.id))) throw new BadRequestException('El CV no es válido');

    // Un CUIL vacío no borra el que ya estaba guardado: en la postulación es opcional.
    const contact = { ...dto, position, cuil: dto.cuil || undefined };
    const candidateId = existing
      ? (await this.candidatesService.update(existing.id, contact)).id
      : (await this.candidatesService.create(contact, cv ? 'cv_ai' : 'manual', dto.channel ?? 'new_web')).id;

    const trackingCode = await this.newTrackingCode();
    const now = new Date().toISOString();
    await this.dataSource.transaction(async (tx) => {
      await tx.save(
        tx.create(Application, {
          trackingCode,
          candidateId,
          jobOfferId: offer?.id ?? null,
          position,
          status: 'received',
          history: [{ at: now, status: 'received' }],
          cvDocumentId: cv?.id ?? null,
          answers,
        }),
      );
      if (cv) await tx.update(CvDocument, { id: cv.id }, { candidateId });
      if (dto.sessionId) await this.consentsService.linkSession(dto.sessionId, candidateId, tx.getRepository(Consent));
    });

    return { trackingCode, status: 'received', stage: 1, position, offer: offer ? { ref: offer.code, title: offer.title } : null };
  }

  private async newTrackingCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateTrackingCode();
      if (!(await this.applications.existsBy({ trackingCode: code }))) return code;
    }
    throw new Error('No se pudo generar un código de seguimiento único');
  }

  async track(code: string): Promise<TrackingDto> {
    const app = TRACKING_CODE_PATTERN.test(code) ? await this.applications.findOneBy({ trackingCode: code }) : null;
    if (!app) throw new NotFoundException('No encontramos esa postulación');
    const next = await this.interviews.findOne({
      where: { applicationId: app.id, status: 'scheduled', endsAt: MoreThan(new Date()) },
      order: { startsAt: 'ASC' },
    });
    return {
      trackingCode: app.trackingCode,
      status: app.status,
      stage: STATUS_STAGE[app.status],
      position: app.position,
      offer: offerRef(app),
      steps: buildSteps(app.status),
      history: app.history.map(({ at, status }) => ({ at, status })),
      interview: next
        ? { startsAt: next.startsAt.toISOString(), endsAt: next.endsAt.toISOString(), place: { name: next.room.name, address: next.room.address } }
        : null,
      updatedAt: app.updatedAt,
    };
  }

  // ---------- Backoffice ----------

  async list(query: ListApplicationsQueryDto): Promise<Page<ApplicationSummaryDto>> {
    const qb = this.applications
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.candidate', 'c')
      .leftJoinAndSelect('a.jobOffer', 'o');
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.candidateId) qb.andWhere('a.candidateId = :candidateId', { candidateId: query.candidateId });
    if (query.jobOfferCode) qb.andWhere('o.code = :code', { code: query.jobOfferCode });
    const [rows, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .addOrderBy('a.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items: rows.map(toSummary), total, page: query.page, limit: query.limit };
  }

  private async load(id: string): Promise<Application> {
    const app = await this.applications.findOne({ where: { id }, relations: { candidate: true } });
    if (!app) throw new NotFoundException('Postulación no encontrada');
    return app;
  }

  private toDetail(a: Application): ApplicationDetailDto {
    return {
      ...toSummary(a),
      history: a.history,
      candidateContact: { email: a.candidate.email, whatsapp: a.candidate.whatsapp },
      cvDocumentId: a.cvDocumentId,
      onboarding: onboardingOf(a),
      answers: a.answers,
    };
  }

  async findOne(id: string): Promise<ApplicationDetailDto> {
    return this.toDetail(await this.load(id));
  }

  async updateStatus(id: string, dto: UpdateApplicationStatusDto): Promise<ApplicationDetailDto> {
    const app = await this.load(id);
    if (!canTransition(app.status, dto.status)) {
      throw new ConflictException(`No se puede pasar de "${app.status}" a "${dto.status}"`);
    }
    app.status = dto.status;
    app.history = appendHistory(app.history, dto.status, dto.note);
    await this.dataSource.transaction(async (tx) => {
      await tx.save(app);
      // Si la postulación se cierra, las entrevistas que quedaban pendientes ya no tienen sentido.
      if (isFinalStatus(dto.status)) await tx.update(Interview, { applicationId: app.id, status: 'scheduled' }, { status: 'cancelled' });
    });
    if (dto.status === 'hired') await this.completeOnboarding(app);
    return this.toDetail(app);
  }

  /** Reintenta el alta en el ERP de una contratación que quedó pendiente. */
  async retryOnboarding(id: string): Promise<ApplicationDetailDto> {
    const app = await this.load(id);
    if (app.status !== 'hired') throw new ConflictException('La postulación no está contratada');
    if (app.candidate.employeeNumber) throw new ConflictException('El alta ya está completa');
    await this.completeOnboarding(app);
    if (!app.candidate.employeeNumber) throw new BadGatewayException('No pudimos completar el alta en el ERP. Reintentá más tarde');
    return this.toDetail(app);
  }

  /**
   * Da de alta al colaborador y pasa su ficha de postulante a colaborador. Si el ERP falla no se revierte la
   * contratación: queda registrada y el alta pendiente (se reintenta aparte). Quien ya tiene legajo no se da de
   * alta de nuevo. El error del proveedor no se registra completo: puede traer datos internos.
   */
  private async completeOnboarding(app: Application): Promise<void> {
    const c = app.candidate;
    let employeeNumber = c.employeeNumber;
    if (!employeeNumber) {
      try {
        ({ employeeNumber } = await this.onboarding.register({ candidateId: c.id, fullName: c.fullName, dni: c.dni, position: app.position }));
      } catch (e) {
        this.logger.error(`Falló el alta en el ERP de la postulación ${app.id} (${e instanceof Error ? e.name : 'error'})`);
        return;
      }
    }
    await this.candidates.update({ id: c.id }, { profileStage: 'collaborator', employeeNumber });
    c.profileStage = 'collaborator';
    c.employeeNumber = employeeNumber;
  }
}
