import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApplicationsService } from './applications.service';
import { ApplyDto, ApplyResponseDto, TrackingDto } from './dto/application.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Postulante')
@Public()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Postularse (a una oferta o de forma espontánea). Devuelve el código de seguimiento' })
  apply(@Body() dto: ApplyDto): Promise<ApplyResponseDto> {
    return this.service.apply(dto);
  }

  @Get('track/:code')
  // Los códigos son cortos: el límite evita que se los pruebe a lo bruto.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Seguimiento de una postulación con su código (GG-XXXXXX)' })
  track(@Param('code') code: string): Promise<TrackingDto> {
    return this.service.track(code);
  }
}
