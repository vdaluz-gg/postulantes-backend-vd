import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesModule } from '../candidates/candidates.module';
import { Zone } from '../zones/entities/zone.entity';
import { CvController } from './cv.controller';
import { CvService } from './cv.service';
import { CvDocument } from './entities/cv-document.entity';
import { MockCvReader } from './mock-cv-reader';
import { CV_READER } from './ports/cv-reader';

@Module({
  imports: [TypeOrmModule.forFeature([CvDocument, Zone]), CandidatesModule],
  controllers: [CvController],
  // Para usar la IA real: reemplazar MockCvReader por la clase que llame al proveedor.
  providers: [CvService, { provide: CV_READER, useClass: MockCvReader }],
  exports: [TypeOrmModule],
})
export class CvModule {}
