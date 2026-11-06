import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Page } from '../../common/pagination';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CandidatesService } from './candidates.service';
import {
  CandidateDetailDto,
  CandidateDto,
  CreateCandidateDto,
  ListCandidatesQueryDto,
  UpdateCandidateDto,
} from './dto/candidate.dto';

@ApiTags('Backoffice · Postulantes')
@AdminOnly()
@Controller('backoffice/candidates')
export class BackofficeCandidatesController {
  constructor(private readonly service: CandidatesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar postulantes (búsqueda, filtros y paginación)' })
  list(@Query() query: ListCandidatesQueryDto): Promise<Page<CandidateDto>> {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un postulante con sus postulaciones y CV' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CandidateDetailDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Sumar un postulante' })
  create(@Body() dto: CreateCandidateDto): Promise<CandidateDto> {
    return this.service.create(dto, 'backoffice', dto.channel);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un postulante (parcial)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCandidateDto): Promise<CandidateDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar un postulante y sus datos asociados' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
