import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZoneDto } from './dto/zone.dto';
import { ZonesService } from './zones.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Zonas')
@Public()
@Controller('zones')
export class ZonesController {
  constructor(private readonly service: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'Zonas activas (para el selector de zona del formulario)' })
  list(): Promise<ZoneDto[]> {
    return this.service.listActive();
  }
}
