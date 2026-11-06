import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { TrimString } from '../../../common/validators/ar-validators.decorators';
import { CLOSING_INTERVIEW_STATUSES, Interview, INTERVIEW_STATUSES, InterviewStatus } from '../entities/interview.entity';
import { InterviewRoom } from '../entities/interview-room.entity';

export const DEFAULT_INTERVIEW_MINUTES = 30;
export const MIN_INTERVIEW_MINUTES = 15;
export const MAX_INTERVIEW_MINUTES = 180;

// ---------- Salas ----------

export class CreateRoomDto {
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsUUID()
  zoneId: string;

  @IsOptional()
  @TrimString()
  @IsString()
  @MaxLength(240)
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export interface RoomDto {
  id: string;
  name: string;
  zone: { id: string; name: string };
  address: string | null;
  capacity: number;
  active: boolean;
}

export const toRoomDto = (r: InterviewRoom): RoomDto => ({
  id: r.id,
  name: r.name,
  zone: { id: r.zone.id, name: r.zone.name },
  address: r.address,
  capacity: r.capacity,
  active: r.active,
});

// ---------- Entrevistas ----------

export class ScheduleInterviewDto {
  @IsUUID()
  roomId: string;

  /** Inicio en formato ISO 8601 con zona horaria (2026-12-03T13:00:00.000Z). */
  @IsISO8601({ strict: true })
  startsAt: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_INTERVIEW_MINUTES)
  @Max(MAX_INTERVIEW_MINUTES)
  durationMinutes?: number;
}

export class UpdateInterviewStatusDto {
  @IsIn(CLOSING_INTERVIEW_STATUSES)
  status: (typeof CLOSING_INTERVIEW_STATUSES)[number];
}

export class ListInterviewsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsIn(INTERVIEW_STATUSES)
  status?: InterviewStatus;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export interface InterviewDto {
  id: string;
  applicationId: string;
  room: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  status: InterviewStatus;
}

export interface InterviewAgendaItemDto extends InterviewDto {
  candidate: { id: string; fullName: string; firstName: string | null; lastName: string | null };
  position: string;
}

export const toInterviewDto = (i: Interview): InterviewDto => ({
  id: i.id,
  applicationId: i.applicationId,
  room: { id: i.room.id, name: i.room.name },
  startsAt: i.startsAt.toISOString(),
  endsAt: i.endsAt.toISOString(),
  status: i.status,
});
