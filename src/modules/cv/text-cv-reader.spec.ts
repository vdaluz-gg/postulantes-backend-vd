import { Repository } from 'typeorm';
import { textPdf } from '../../../test/utils/pdf-builder';
import { buildDocx, wordParagraphs } from '../../../test/utils/zip-builder';
import { Zone } from '../zones/entities/zone.entity';
import { TextCvReader } from './text-cv-reader';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('TextCvReader', () => {
  const find = jest.fn();
  const reader = new TextCvReader({ find } as unknown as Repository<Zone>);

  beforeEach(() => {
    find.mockReset().mockResolvedValue([{ name: 'Monte Grande' }]);
  });

  it('lee un PDF y busca la zona entre las activas', async () => {
    const pdf = textPdf(['Lucía Fernández', 'Localidad: Monte Grande']);
    await expect(reader.read({ buffer: pdf, mimeType: 'application/pdf', fileName: 'cv.pdf' })).resolves.toEqual({
      fullName: 'Lucía Fernández',
      firstName: 'Lucía',
      lastName: 'Fernández',
      zone: 'Monte Grande',
    });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }));
  });

  it('lee un DOCX', async () => {
    const docx = buildDocx(wordParagraphs(['Martín Gómez', 'DNI 40.123.456']));
    await expect(reader.read({ buffer: docx, mimeType: DOCX, fileName: 'cv.docx' })).resolves.toEqual({
      fullName: 'Martín Gómez',
      firstName: 'Martín',
      lastName: 'Gómez',
      dni: '40.123.456',
    });
  });

  it('lee un DOC (heurístico)', async () => {
    const doc = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(8), Buffer.from('Celular: 11 4444-0101\r', 'utf16le')]);
    await expect(reader.read({ buffer: doc, mimeType: 'application/msword', fileName: 'cv.doc' })).resolves.toEqual({ whatsapp: '11 4444-0101' });
  });

  it('sin texto (o con un tipo desconocido) devuelve {} sin consultar zonas', async () => {
    await expect(reader.read({ buffer: Buffer.from('%PDF-1.4\n%%EOF'), mimeType: 'application/pdf', fileName: 'cv.pdf' })).resolves.toEqual({});
    await expect(reader.read({ buffer: Buffer.from('hola'), mimeType: 'text/plain', fileName: 'cv.txt' })).resolves.toEqual({});
    expect(find).not.toHaveBeenCalled();
  });
});
