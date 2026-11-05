import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoneDto, toZoneDto } from './dto/zone.dto';
import { Zone } from './entities/zone.entity';

@Injectable()
export class ZonesService {
  constructor(@InjectRepository(Zone) private readonly zones: Repository<Zone>) {}

  async listActive(): Promise<ZoneDto[]> {
    const rows = await this.zones.find({ where: { active: true }, order: { name: 'ASC' } });
    return rows.map(toZoneDto);
  }
}
