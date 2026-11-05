import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CandidateValidationService } from './candidate-validation.service';
import { ValidateCandidateDto, ValidateCandidateResponse } from './dto/validate-candidate.dto';

@ApiTags('Postulante')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly validation: CandidateValidationService) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valida los campos del formulario (nombre, mail, DNI, WhatsApp, zona, puesto) sin guardar nada' })
  validate(@Body() dto: ValidateCandidateDto): Promise<ValidateCandidateResponse> {
    return this.validation.validate(dto);
  }
}
