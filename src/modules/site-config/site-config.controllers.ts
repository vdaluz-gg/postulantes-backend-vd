import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { AdminProfileDto } from '../auth/dto/auth.dto';
import { SaveSiteConfigDto, SiteConfigDto } from './dto/site-config.dto';
import { SiteConfigService } from './site-config.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Backoffice · Configuración de los portales')
@AdminOnly()
@Controller('backoffice/site-config')
export class BackofficeSiteConfigController {
  constructor(private readonly service: SiteConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Última versión (borrador o publicada) para editar' })
  current(): Promise<SiteConfigDto> {
    return this.service.current();
  }

  @Put()
  @ApiOperation({ summary: 'Guardar el borrador (crea una versión nueva)' })
  save(@Body() dto: SaveSiteConfigDto, @CurrentAdmin() admin: AdminProfileDto): Promise<SiteConfigDto> {
    return this.service.save(dto, admin.fullName);
  }

  @Post('publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicar: desde ese momento lo ven los portales' })
  publish(@Body() dto: SaveSiteConfigDto, @CurrentAdmin() admin: AdminProfileDto): Promise<SiteConfigDto> {
    return this.service.publish(dto, admin.fullName);
  }
}

@ApiTags('Configuración de los portales')
@Public()
@Controller('site-config')
export class SiteConfigController {
  constructor(private readonly service: SiteConfigService) {}

  @Get(':audience')
  @ApiOperation({ summary: 'Configuración publicada de un portal (postulantes, clientes o colaboradores)' })
  published(@Param('audience') audience: string): Promise<Record<string, unknown>> {
    return this.service.published(audience);
  }
}
