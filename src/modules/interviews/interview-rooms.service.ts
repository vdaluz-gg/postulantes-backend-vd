import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { Zone } from '../zones/entities/zone.entity';
import { CreateRoomDto, RoomDto, toRoomDto, UpdateRoomDto } from './dto/interview.dto';
import { InterviewRoom } from './entities/interview-room.entity';

const DUPLICATED = 'Ya existe una sala con ese nombre';

@Injectable()
export class InterviewRoomsService {
  constructor(
    @InjectRepository(InterviewRoom) private readonly rooms: Repository<InterviewRoom>,
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
  ) {}

  async list(): Promise<RoomDto[]> {
    return (await this.rooms.find({ order: { name: 'ASC' } })).map(toRoomDto);
  }

  private async assertZone(zoneId: string): Promise<void> {
    if (!(await this.zones.existsBy({ id: zoneId, active: true }))) throw new BadRequestException('La zona no existe');
  }

  private async save(room: InterviewRoom): Promise<RoomDto> {
    try {
      const saved = await this.rooms.save(room);
      return toRoomDto(await this.rooms.findOneByOrFail({ id: saved.id }));
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(DUPLICATED);
      throw e;
    }
  }

  async create(dto: CreateRoomDto): Promise<RoomDto> {
    await this.assertZone(dto.zoneId);
    if (await this.rooms.existsBy({ name: dto.name })) throw new ConflictException(DUPLICATED);
    return this.save(
      this.rooms.create({
        name: dto.name,
        zoneId: dto.zoneId,
        address: dto.address || null,
        capacity: dto.capacity ?? 1,
        active: dto.active ?? true,
      }),
    );
  }

  async update(id: string, dto: UpdateRoomDto): Promise<RoomDto> {
    const room = await this.rooms.findOneBy({ id });
    if (!room) throw new NotFoundException('Sala no encontrada');
    if (dto.zoneId !== undefined && dto.zoneId !== room.zoneId) {
      await this.assertZone(dto.zoneId);
      room.zoneId = dto.zoneId;
      room.zone = undefined as unknown as Zone; // que TypeORM tome la nueva zona por el id
    }
    if (dto.name !== undefined && dto.name !== room.name) {
      if (await this.rooms.existsBy({ name: dto.name })) throw new ConflictException(DUPLICATED);
      room.name = dto.name;
    }
    if (dto.address !== undefined) room.address = dto.address || null;
    if (dto.capacity !== undefined) room.capacity = dto.capacity;
    if (dto.active !== undefined) room.active = dto.active;
    return this.save(room);
  }
}
