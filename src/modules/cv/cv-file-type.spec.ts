import { detectCvType, sanitizeFileName } from './cv-file-type';

const zipWithWord = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml')]);

describe('detectCvType', () => {
  it('reconoce un PDF por su firma', () => {
    expect(detectCvType(Buffer.from('%PDF-1.7\n...'))).toEqual({ extension: 'pdf', mimeType: 'application/pdf' });
  });

  it('reconoce un DOCX (zip con word/)', () => {
    expect(detectCvType(zipWithWord)).toEqual({
      extension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  });

  it('reconoce un DOC clásico (OLE2)', () => {
    const doc = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(16)]);
    expect(detectCvType(doc)).toEqual({ extension: 'doc', mimeType: 'application/msword' });
  });

  it('rechaza un zip cualquiera, texto y vacío', () => {
    expect(detectCvType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).toBeNull();
    expect(detectCvType(Buffer.from('hola, soy un txt'))).toBeNull();
    expect(detectCvType(Buffer.alloc(0))).toBeNull();
  });

  it('rechaza un ejecutable aunque se llame .pdf', () => {
    expect(detectCvType(Buffer.from('MZ\x90\x00 programa.exe'))).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('se queda con el nombre sin carpetas', () => {
    expect(sanitizeFileName('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanitizeFileName('C:\\Users\\yo\\cv final.docx')).toBe('cv final.docx');
  });
  it('saca caracteres de control y limita el largo', () => {
    expect(sanitizeFileName('cv\u0000\u0007.pdf')).toBe('cv.pdf');
    expect(sanitizeFileName('a'.repeat(400) + '.pdf').length).toBeLessThanOrEqual(255);
  });
  it('usa un nombre por defecto si queda vacío', () => {
    expect(sanitizeFileName('')).toBe('cv');
    expect(sanitizeFileName('///')).toBe('cv');
  });
});
