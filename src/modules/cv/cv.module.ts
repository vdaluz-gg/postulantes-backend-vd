import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesModule } from '../candidates/candidates.module';
import { Zone } from '../zones/entities/zone.entity';
import { CvCleanupService } from './cv-cleanup.service';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { CvDocument } from './entities/cv-document.entity';
import { NoopFileScanner } from './noop-file-scanner';
import { CV_READER } from './ports/cv-reader';
import { FILE_SCANNER } from './ports/file-scanner';
import { TextCvReader } from './text-cv-reader';

@Module({
  imports: [TypeOrmModule.forFeature([CvDocument, Zone]), CandidatesModule],
  controllers: [CvController],
  // TextCvReader lee el texto del archivo y busca los datos con reglas. Para usar una IA, alcanza con otra clase
  // que cumpla CvReader en este `useClass`; el servicio y el controlador no cambian.
  // El análisis de archivos (antivirus) hoy no hace nada: para activarlo, otra clase que cumpla FileScanner en FILE_SCANNER.
  providers: [
    CvService,
    CvCleanupService,
    { provide: CV_READER, useClass: TextCvReader },
    { provide: FILE_SCANNER, useClass: NoopFileScanner },
  ],
  exports: [TypeOrmModule],
})
export class CvModule {}
