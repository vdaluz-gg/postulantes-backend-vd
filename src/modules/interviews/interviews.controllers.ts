import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Page } from '../../common/pagination';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import {
  CreateRoomDto,
  InterviewAgendaItemDto,
  InterviewDto,
  ListInterviewsQueryDto,
  RoomDto,
  ScheduleInterviewDto,
  UpdateInterviewStatusDto,
  UpdateRoomDto,
} from './dto/interview.dto';
import { InterviewRoomsService } from './interview-rooms.service';
import { InterviewsService } from './interviews.service';

@ApiTags('Backoffice · Salas de entrevista')
@AdminOnly()
@Controller('backoffice/interview-rooms')
export class InterviewRoomsController {
  constructor(private readonly service: InterviewRoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las salas de entrevista' })
  list(): Promise<RoomDto[]> {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una sala' })
  create(@Body() dto: CreateRoomDto): Promise<RoomDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una sala (también sirve para darla de baja con active=false)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto): Promise<RoomDto> {
    return this.service.update(id, dto);
  }
}

@ApiTags('Backoffice · Entrevistas')
@AdminOnly()
@Controller('backoffice/applications/:applicationId/interviews')
export class ApplicationInterviewsController {
  constructor(private readonly service: InterviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Agendar una entrevista (la postulación pasa a "entrevista")' })
  schedule(@Param('applicationId', ParseUUIDPipe) applicationId: string, @Body() dto: ScheduleInterviewDto): Promise<InterviewDto> {
    return this.service.schedule(applicationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Entrevistas de una postulación' })
  list(@Param('applicationId', ParseUUIDPipe) applicationId: string): Promise<InterviewDto[]> {
    return this.service.listForApplication(applicationId);
  }
}

@ApiTags('Backoffice · Entrevistas')
@AdminOnly()
@Controller('backoffice/interviews')
export class InterviewsController {
  constructor(private readonly service: InterviewsService) {}

  @Get()
  @ApiOperation({ summary: 'Agenda general (filtros por sala, estado y rango de fechas)' })
  agenda(@Query() query: ListInterviewsQueryDto): Promise<Page<InterviewAgendaItemDto>> {
    return this.service.agenda(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cerrar una entrevista agendada: realizada, cancelada o ausente' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInterviewStatusDto): Promise<InterviewDto> {
    return this.service.updateStatus(id, dto);
  }
}
