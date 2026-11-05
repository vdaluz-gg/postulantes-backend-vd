import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZoneDto } from './dto/zone.dto';
import { ZonesService } from './zones.service';

@ApiTags('Zonas')
@Controller('zones')
export class ZonesController {
  constructor(private readonly service: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'Zonas activas (para el selector de zona del formulario)' })
  list(): Promise<ZoneDto[]> {
    return this.service.listActive();
  }
}
