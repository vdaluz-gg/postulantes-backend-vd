import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { ApplicationsReportDto, ApplicationsReportQueryDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Backoffice · Reportería')
@AdminOnly()
@Controller('backoffice/reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('applications')
  @ApiOperation({ summary: 'Postulaciones por estado, canal y oferta, con la tasa de contratación (rango de fechas opcional)' })
  applications(@Query() query: ApplicationsReportQueryDto): Promise<ApplicationsReportDto> {
    return this.service.applicationsReport(query);
  }
}
