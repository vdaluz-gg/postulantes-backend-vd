import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListJobOffersQueryDto, NearbyJobOffersQueryDto } from './dto/job-offer-query.dto';
import { OfferFiltersDto, PublicJobPostingDto, PublicOffersPageDto } from './dto/public-job-posting.dto';
import { JobOffersService } from './job-offers.service';

@ApiTags('Ofertas (público)')
@Controller('job-offers')
export class JobOffersController {
  constructor(private readonly service: JobOffersService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar ofertas con texto libre, chips (rubro, zona) y cercanía' })
  search(@Query() query: ListJobOffersQueryDto): Promise<PublicOffersPageDto> {
    return this.service.search(query);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Ofertas cerca de la ubicación de la persona' })
  nearby(@Query() query: NearbyJobOffersQueryDto): Promise<PublicOffersPageDto> {
    return this.service.nearby(query);
  }

  @Get('filters')
  @ApiOperation({ summary: 'Rubros y zonas disponibles para los chips' })
  filters(): Promise<OfferFiltersDto> {
    return this.service.filters();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Ficha pública de una oferta' })
  findOne(@Param('code') code: string): Promise<PublicJobPostingDto> {
    return this.service.findPublicByCode(code);
  }
}
