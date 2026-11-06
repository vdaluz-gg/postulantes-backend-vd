import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Page } from '../../common/pagination';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { ApplicationsService } from './applications.service';
import { ApplicationDetailDto, ApplicationSummaryDto, ListApplicationsQueryDto, UpdateApplicationStatusDto } from './dto/application.dto';

@ApiTags('Backoffice · Postulaciones')
@AdminOnly()
@Controller('backoffice/applications')
export class BackofficeApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar postulaciones (filtros por estado, postulante y oferta)' })
  list(@Query() query: ListApplicationsQueryDto): Promise<Page<ApplicationSummaryDto>> {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una postulación con su historial' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApplicationDetailDto> {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar el estado de la postulación (queda en el historial)' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationStatusDto): Promise<ApplicationDetailDto> {
    return this.service.updateStatus(id, dto);
  }

  @Post(':id/onboarding')
  @ApiOperation({ summary: 'Reintentar el alta del colaborador en el ERP cuando quedó pendiente tras la contratación' })
  retryOnboarding(@Param('id', ParseUUIDPipe) id: string): Promise<ApplicationDetailDto> {
    return this.service.retryOnboarding(id);
  }
}
