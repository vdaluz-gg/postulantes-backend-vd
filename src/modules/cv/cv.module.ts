import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesModule } from '../candidates/candidates.module';
import { Zone } from '../zones/entities/zone.entity';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { CvDocument } from './entities/cv-document.entity';
import { CV_READER } from './ports/cv-reader';
import { TextCvReader } from './text-cv-reader';

@Module({
  imports: [TypeOrmModule.forFeature([CvDocument, Zone]), CandidatesModule],
  controllers: [CvController],
  // TextCvReader lee el texto del archivo y busca los datos con reglas. Para usar una IA, alcanza con otra clase
  // que cumpla CvReader en este `useClass`; el servicio y el controlador no cambian.
  providers: [CvService, { provide: CV_READER, useClass: TextCvReader }],
  exports: [TypeOrmModule],
})
export class CvModule {}
