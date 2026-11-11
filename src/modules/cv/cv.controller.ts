import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CV_MAX_BYTES } from './cv-file-type';
import { CvService, CvUploadResult } from './cv.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Postulante')
@Public()
@Controller('cv')
export class CvController {
  constructor(private readonly service: CvService) {}

  @Post()
  // Cada lectura con IA cuesta: límite más bajo que el general.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CV_MAX_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Subir el CV (PDF, DOC o DOCX, hasta 5 MB): la IA lo lee y devuelve los datos para precargar el formulario' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } })
  upload(@UploadedFile() file: Express.Multer.File | undefined): Promise<CvUploadResult> {
    return this.service.upload(file);
  }
}
