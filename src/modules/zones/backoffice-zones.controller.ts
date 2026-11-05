import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CreateZoneDto, UpdateZoneDto, ZoneAdminDto } from './dto/zone-admin.dto';
import { ZonesService } from './zones.service';

@ApiTags('Backoffice · Zonas')
@AdminOnly()
@Controller('backoffice/zones')
export class BackofficeZonesController {
  constructor(private readonly service: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'Todas las zonas, también las inactivas' })
  list(): Promise<ZoneAdminDto[]> {
    return this.service.listAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una zona' })
  create(@Body() dto: CreateZoneDto): Promise<ZoneAdminDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar o activar/desactivar una zona' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateZoneDto): Promise<ZoneAdminDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una zona que no esté en uso' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
