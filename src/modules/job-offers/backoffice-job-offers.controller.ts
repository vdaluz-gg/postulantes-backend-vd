import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Page } from '../../common/pagination';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { BackofficeJobOffersService } from './backoffice-job-offers.service';
import { AdminJobOfferDto, CreateJobOfferDto, ListAdminOffersQueryDto, UpdateJobOfferDto } from './dto/job-offer-admin.dto';

@ApiTags('Backoffice · Ofertas')
@AdminOnly()
@Controller('backoffice/job-offers')
export class BackofficeJobOffersController {
  constructor(private readonly service: BackofficeJobOffersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las ofertas (borrador, publicadas y cerradas) con su ficha interna' })
  list(@Query() query: ListAdminOffersQueryDto): Promise<Page<AdminJobOfferDto>> {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle completo de una oferta' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminJobOfferDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una oferta (queda en borrador si no se indica otro estado)' })
  create(@Body() dto: CreateJobOfferDto): Promise<AdminJobOfferDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una oferta; publicarla o cerrarla es cambiar su estado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobOfferDto): Promise<AdminJobOfferDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una oferta' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
