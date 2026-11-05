import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsentsService } from './consents.service';
import { RecordConsentsDto } from './dto/consent.dto';

@ApiTags('Postulante')
@Controller('consents')
export class ConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar los permisos de voz, imagen y ubicación que la persona aceptó o rechazó' })
  record(@Body() dto: RecordConsentsDto, @Headers('user-agent') userAgent?: string): Promise<{ recorded: number }> {
    return this.service.record(dto, userAgent);
  }
}
