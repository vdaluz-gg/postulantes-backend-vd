import { Injectable } from '@nestjs/common';
import { CvExtractedData } from './entities/cv-document.entity';
import { CvReader } from './ports/cv-reader';

/** Mock: responde siempre con el CV de ejemplo de la maqueta (igual que el mock del front). */
@Injectable()
export class MockCvReader implements CvReader {
  async read(): Promise<CvExtractedData> {
    return { fullName: 'Martina Rodríguez', dni: '38.412.907', whatsapp: '11 5555-0142', zone: 'Monte Grande' };
  }
}
