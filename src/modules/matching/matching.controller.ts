import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { MatchesDto, MatchesQueryDto } from './dto/matches.dto';
import { MatchingService } from './matching.service';

@ApiTags('Backoffice · Matching')
@AdminOnly()
@Controller('backoffice/job-offers')
export class MatchingController {
  constructor(private readonly service: MatchingService) {}

  @Get(':id/matches')
  @ApiOperation({ summary: 'Postulantes sugeridos para una oferta, con el puntaje y por qué' })
  matches(@Param('id', ParseUUIDPipe) id: string, @Query() query: MatchesQueryDto): Promise<MatchesDto> {
    return this.service.suggestCandidates(id, query);
  }
}
