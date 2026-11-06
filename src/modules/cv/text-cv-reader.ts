import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from '../zones/entities/zone.entity';
import { parseCvText } from './cv-text-parser';
import { CvExtractedData } from './entities/cv-document.entity';
import { CvReadInput, CvReader } from './ports/cv-reader';
import { extractDocText } from './text/doc-text';
import { extractDocxText } from './text/docx-text';
import { extractPdfText } from './text/pdf-text';

const EXTRACTORS: Record<string, (buf: Buffer) => string> = {
  'application/pdf': extractPdfText,
  'application/msword': extractDocText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': extractDocxText,
};

/**
 * Lector de CV sin IA ni dependencias externas: saca el texto del archivo (PDF, DOC o DOCX) y busca los datos con
 * reglas. Si el archivo no tiene texto legible (un PDF escaneado, por ejemplo) devuelve {} y la persona completa
 * el formulario a mano. El texto del CV nunca se loguea.
 */
@Injectable()
export class TextCvReader implements CvReader {
  constructor(@InjectRepository(Zone) private readonly zones: Repository<Zone>) {}

  async read(input: CvReadInput): Promise<CvExtractedData> {
    const extract = EXTRACTORS[input.mimeType];
    const text = extract ? extract(input.buffer) : '';
    if (!text.trim()) return {};
    const zones = await this.zones.find({ select: { name: true }, where: { active: true } });
    return parseCvText(text, zones.map((z) => z.name));
  }
}
