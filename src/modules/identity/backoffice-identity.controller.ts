import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { VERIFICATION_KINDS, VerificationKind } from './entities/identity-verification.entity';
import { IdentityService, IdentityVerificationDto } from './identity.service';

class RequestVerificationDto {
  @IsIn(VERIFICATION_KINDS)
  kind: VerificationKind;
}

@ApiTags('Backoffice · Identidad (RENAPER)')
@AdminOnly()
@Controller('backoffice/candidates/:id/identity-verifications')
export class BackofficeIdentityController {
  constructor(private readonly service: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de validaciones de identidad del postulante' })
  history(@Param('id', ParseUUIDPipe) id: string): Promise<IdentityVerificationDto[]> {
    return this.service.history(id);
  }

  @Post()
  @ApiOperation({ summary: 'Validar la identidad del postulante (hoy: datos del DNI con proveedor mock)' })
  verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestVerificationDto): Promise<IdentityVerificationDto> {
    return this.service.verify(id, dto.kind);
  }
}
