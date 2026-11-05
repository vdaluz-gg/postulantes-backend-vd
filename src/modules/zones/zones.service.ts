import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../candidates/entities/candidate.entity';
import { JobOffer } from '../job-offers/entities/job-offer.entity';
import { ZoneDto, toZoneDto } from './dto/zone.dto';
import { CreateZoneDto, UpdateZoneDto, ZoneAdminDto } from './dto/zone-admin.dto';
import { Zone } from './entities/zone.entity';

const toAdminDto = (z: Zone): ZoneAdminDto => ({
  ...toZoneDto(z),
  active: z.active,
  createdAt: z.createdAt,
  updatedAt: z.updatedAt,
});

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    @InjectRepository(JobOffer) private readonly offers: Repository<JobOffer>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
  ) {}

  // ---------- Público ----------

  async listActive(): Promise<ZoneDto[]> {
    const rows = await this.zones.find({ where: { active: true }, order: { name: 'ASC' } });
    return rows.map(toZoneDto);
  }

  // ---------- Backoffice ----------

  async listAll(): Promise<ZoneAdminDto[]> {
    return (await this.zones.find({ order: { name: 'ASC' } })).map(toAdminDto);
  }

  private async load(id: string): Promise<Zone> {
    const zone = await this.zones.findOneBy({ id });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    return zone;
  }

  /** Nombre único sin distinguir mayúsculas. */
  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const qb = this.zones.createQueryBuilder('z').where('LOWER(z.name) = :name', { name: name.toLowerCase() });
    if (exceptId) qb.andWhere('z.id <> :exceptId', { exceptId });
    if (await qb.getExists()) throw new ConflictException('Ya existe una zona con ese nombre');
  }

  async create(dto: CreateZoneDto): Promise<ZoneAdminDto> {
    await this.assertNameFree(dto.name);
    return toAdminDto(await this.zones.save(this.zones.create({ ...dto, active: dto.active ?? true })));
  }

  async update(id: string, dto: UpdateZoneDto): Promise<ZoneAdminDto> {
    const zone = await this.load(id);
    if (dto.name !== undefined && dto.name.toLowerCase() !== zone.name.toLowerCase()) await this.assertNameFree(dto.name, id);
    if (dto.name != null) zone.name = dto.name;
    if (dto.province != null) zone.province = dto.province;
    if (dto.latitude != null) zone.latitude = dto.latitude;
    if (dto.longitude != null) zone.longitude = dto.longitude;
    if (dto.active != null) zone.active = dto.active;
    return toAdminDto(await this.zones.save(zone));
  }

  async remove(id: string): Promise<void> {
    await this.load(id);
    const inUse = (await this.offers.existsBy({ zoneId: id })) || (await this.candidates.existsBy({ zoneId: id }));
    if (inUse) throw new ConflictException('La zona está en uso por ofertas o postulantes');
    await this.zones.delete({ id });
  }
}
