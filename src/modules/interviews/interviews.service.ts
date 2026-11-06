import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Page } from '../../common/pagination';
import { appendHistory } from '../applications/application-flow';
import { Application } from '../applications/entities/application.entity';
import { candidateNameParts } from '../candidates/dto/candidate.dto';
import {
  DEFAULT_INTERVIEW_MINUTES,
  InterviewAgendaItemDto,
  InterviewDto,
  ListInterviewsQueryDto,
  ScheduleInterviewDto,
  toInterviewDto,
  UpdateInterviewStatusDto,
} from './dto/interview.dto';
import { InterviewRoom } from './entities/interview-room.entity';
import { Interview } from './entities/interview.entity';

/** Estados de la postulación desde los que se puede agendar (la selectora ya la tiene en sus manos). */
const SCHEDULABLE: readonly Application['status'][] = ['recruiter_review', 'interview'];

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview) private readonly interviews: Repository<Interview>,
    @InjectRepository(InterviewRoom) private readonly rooms: Repository<InterviewRoom>,
    @InjectRepository(Application) private readonly applications: Repository<Application>,
    private readonly dataSource: DataSource,
  ) {}

  private async loadApplication(id: string): Promise<Application> {
    const app = await this.applications.findOneBy({ id });
    if (!app) throw new NotFoundException('Postulación no encontrada');
    return app;
  }

  /** Hay una entrevista agendada que se pisa con [start, end) en esa sala o para ese postulante. */
  private overlapping(start: Date, end: Date) {
    return this.interviews
      .createQueryBuilder('i')
      .where("i.status = 'scheduled'")
      .andWhere('i.startsAt < :end', { end })
      .andWhere('i.endsAt > :start', { start });
  }

  async schedule(applicationId: string, dto: ScheduleInterviewDto): Promise<InterviewDto> {
    const app = await this.loadApplication(applicationId);
    if (!SCHEDULABLE.includes(app.status)) {
      throw new ConflictException('Solo se puede agendar una entrevista cuando la postulación está en revisión de la selectora');
    }
    const room = await this.rooms.findOneBy({ id: dto.roomId });
    if (!room) throw new NotFoundException('Sala no encontrada');
    if (!room.active) throw new ConflictException('La sala no está disponible');

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) throw new BadRequestException('La entrevista debe ser a futuro');
    const endsAt = new Date(startsAt.getTime() + (dto.durationMinutes ?? DEFAULT_INTERVIEW_MINUTES) * 60_000);

    if ((await this.overlapping(startsAt, endsAt).andWhere('i.roomId = :roomId', { roomId: room.id }).getCount()) > 0) {
      throw new ConflictException('La sala ya está ocupada en ese horario');
    }
    const sameCandidate = await this.overlapping(startsAt, endsAt)
      .innerJoin('i.application', 'a')
      .andWhere('a.candidateId = :candidateId', { candidateId: app.candidateId })
      .getCount();
    if (sameCandidate > 0) throw new ConflictException('El postulante ya tiene una entrevista en ese horario');

    // La entrevista y el pase a "entrevista" van juntos: o se hacen los dos o ninguno.
    const saved = await this.dataSource.transaction(async (tx) => {
      const interview = await tx.save(tx.create(Interview, { applicationId: app.id, roomId: room.id, startsAt, endsAt, status: 'scheduled' }));
      if (app.status === 'recruiter_review') {
        app.status = 'interview';
        app.history = appendHistory(app.history, 'interview', 'Entrevista agendada');
        await tx.save(app);
      }
      return interview;
    });
    return toInterviewDto({ ...saved, room });
  }

  async listForApplication(applicationId: string): Promise<InterviewDto[]> {
    await this.loadApplication(applicationId);
    const rows = await this.interviews.find({ where: { applicationId }, order: { startsAt: 'ASC' } });
    return rows.map(toInterviewDto);
  }

  async agenda(query: ListInterviewsQueryDto): Promise<Page<InterviewAgendaItemDto>> {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) throw new BadRequestException('"from" no puede ser posterior a "to"');
    const qb = this.interviews
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.room', 'r')
      .innerJoinAndSelect('i.application', 'a')
      .innerJoinAndSelect('a.candidate', 'c');
    if (query.roomId) qb.andWhere('i.roomId = :roomId', { roomId: query.roomId });
    if (query.status) qb.andWhere('i.status = :status', { status: query.status });
    if (query.from) qb.andWhere('i.startsAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('i.startsAt <= :to', { to: new Date(query.to) });
    const [rows, total] = await qb
      .orderBy('i.startsAt', 'ASC')
      .addOrderBy('i.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      items: rows.map((i) => ({
        ...toInterviewDto(i),
        candidate: { id: i.application.candidate.id, fullName: i.application.candidate.fullName, ...candidateNameParts(i.application.candidate) },
        position: i.application.position,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async updateStatus(id: string, dto: UpdateInterviewStatusDto): Promise<InterviewDto> {
    const interview = await this.interviews.findOneBy({ id });
    if (!interview) throw new NotFoundException('Entrevista no encontrada');
    if (interview.status !== 'scheduled') throw new ConflictException('La entrevista ya está cerrada');
    interview.status = dto.status;
    return toInterviewDto(await this.interviews.save(interview));
  }
}
