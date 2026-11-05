import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from '../../common/pagination';
import { escapeLike } from '../../common/utils/like';
import { Zone } from '../zones/entities/zone.entity';
import {
  AdminJobOfferDto,
  CreateJobOfferDto,
  ListAdminOffersQueryDto,
  UpdateJobOfferDto,
  toAdminOfferDto,
} from './dto/job-offer-admin.dto';
import { JobOffer } from './entities/job-offer.entity';

@Injectable()
export class BackofficeJobOffersService {
  constructor(
    @InjectRepository(JobOffer) private readonly offers: Repository<JobOffer>,
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
  ) {}

  private async load(id: string): Promise<JobOffer> {
    const offer = await this.offers.findOneBy({ id });
    if (!offer) throw new NotFoundException('Oferta no encontrada');
    return offer;
  }

  private async assertZone(zoneId: string): Promise<void> {
    if (!(await this.zones.existsBy({ id: zoneId }))) throw new BadRequestException('La zona no existe');
  }

  private async assertCodeFree(code: string): Promise<void> {
    if (await this.offers.existsBy({ code })) throw new ConflictException('Ya existe una oferta con ese código');
  }

  async list(query: ListAdminOffersQueryDto): Promise<Page<AdminJobOfferDto>> {
    const qb = this.offers.createQueryBuilder('o').leftJoinAndSelect('o.zone', 'z');
    const q = query.q?.trim();
    if (q) qb.andWhere('(o.title ILIKE :like OR o.code ILIKE :like)', { like: `%${escapeLike(q)}%` });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.zoneId) qb.andWhere('o.zoneId = :zoneId', { zoneId: query.zoneId });
    const [rows, total] = await qb
      .orderBy('o.publishedAt', 'DESC')
      .addOrderBy('o.code', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { items: rows.map(toAdminOfferDto), total, page: query.page, limit: query.limit };
  }

  async findOne(id: string): Promise<AdminJobOfferDto> {
    return toAdminOfferDto(await this.load(id));
  }

  async create(dto: CreateJobOfferDto): Promise<AdminJobOfferDto> {
    await this.assertZone(dto.zoneId);
    await this.assertCodeFree(dto.code);
    const saved = await this.offers.save(
      this.offers.create({
        code: dto.code,
        title: dto.title,
        description: dto.description,
        zoneId: dto.zoneId,
        area: dto.area,
        schedule: dto.schedule,
        publishedAt: dto.publishedAt ?? new Date().toISOString().slice(0, 10),
        requirements: dto.requirements,
        benefits: dto.benefits,
        vacancies: dto.vacancies ?? 1,
        salary: dto.salary ?? null,
        address: dto.address ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        radiusKm: dto.radiusKm ?? 20,
        status: dto.status ?? 'draft',
        internal: { ...(dto.internal ?? {}) },
      }),
    );
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateJobOfferDto): Promise<AdminJobOfferDto> {
    const offer = await this.load(id);
    if (dto.code != null && dto.code !== offer.code) await this.assertCodeFree(dto.code);
    if (dto.zoneId != null && dto.zoneId !== offer.zoneId) {
      await this.assertZone(dto.zoneId);
      offer.zoneId = dto.zoneId;
      offer.zone = undefined as never; // se recarga con la zona nueva
    }
    // Obligatorios: null no los borra. Opcionales (salary, address, latitude, longitude): null los limpia.
    if (dto.code != null) offer.code = dto.code;
    if (dto.title != null) offer.title = dto.title;
    if (dto.description != null) offer.description = dto.description;
    if (dto.area != null) offer.area = dto.area;
    if (dto.schedule != null) offer.schedule = dto.schedule;
    if (dto.publishedAt != null) offer.publishedAt = dto.publishedAt;
    if (dto.requirements != null) offer.requirements = dto.requirements;
    if (dto.benefits != null) offer.benefits = dto.benefits;
    if (dto.vacancies != null) offer.vacancies = dto.vacancies;
    if (dto.radiusKm != null) offer.radiusKm = dto.radiusKm;
    if (dto.status != null) offer.status = dto.status;
    if (dto.internal != null) offer.internal = { ...dto.internal };
    if (dto.salary !== undefined) offer.salary = dto.salary;
    if (dto.address !== undefined) offer.address = dto.address || null;
    if (dto.latitude !== undefined) offer.latitude = dto.latitude;
    if (dto.longitude !== undefined) offer.longitude = dto.longitude;
    await this.offers.save(offer);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.load(id);
    await this.offers.delete({ id });
  }
}
