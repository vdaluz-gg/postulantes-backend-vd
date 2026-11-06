import { deflateSync } from 'zlib';
import { buildPdf, HELVETICA, linesContent, pdfStream, singlePagePdf, textPdf } from '../../../../test/utils/pdf-builder';
import { extractPdfText } from './pdf-text';

const latin1 = (s: string): Buffer => Buffer.from(s, 'latin1');

/** PDF de una página cuyo /F1 es el objeto 4 y que agrega objetos extra a partir del 6. */
function pdfWithFont(content: string, font: string, extra: Array<string | Buffer> = []): Buffer {
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    font,
    pdfStream('', content),
    ...extra,
  ]);
}

describe('extractPdfText', () => {
  it('lee los renglones de un content stream comprimido con FlateDecode', () => {
    const pdf = textPdf(['Lucía Fernández', 'DNI 40.123.456', 'lucia@ejemplo.com']);
    expect(extractPdfText(pdf)).toBe('Lucía Fernández\nDNI 40.123.456\nlucia@ejemplo.com');
  });

  it('lee un content stream sin comprimir', () => {
    expect(extractPdfText(singlePagePdf(linesContent(['Ana Gómez', 'Quilmes']), { compress: false }))).toBe('Ana Gómez\nQuilmes');
  });

  it('decodifica los escapes de los literales y los strings hexadecimales', () => {
    const content = [
      'BT /F1 12 Tf 72 700 Td',
      String.raw`(Mar\355a \(Pili\) G\363mez \\ ok) Tj`,
      String.raw`0 -14 Td (dos\nrengl\363n) Tj`,
      String.raw`0 -14 Td (con (par\351ntesis) anidados) Tj`,
      '0 -14 Td <4875676F20> Tj',
      'ET',
    ].join('\n');
    expect(extractPdfText(singlePagePdf(content))).toBe('María (Pili) Gómez \\ ok\ndos\nrenglón\ncon (paréntesis) anidados\nHugo');
  });

  it('TJ con kerning: los ajustes chicos no separan y los grandes (< -200) son un espacio', () => {
    const content = String.raw`BT /F1 12 Tf 72 700 Td [(Luc) 20 (\355a) -250 (Fern) 10 (\341ndez)] TJ ET`;
    expect(extractPdfText(singlePagePdf(content))).toBe('Lucía Fernández');
  });

  it("corta renglones con T*, ' , \" , Td y Tm", () => {
    const content = [
      'BT /F1 12 Tf 14 TL 72 700 Td (uno) Tj T* (dos) Tj (tres) \' 0 0 (cuatro) "',
      '0 -20 Td (cinco) Tj 1 0 0 1 72 500 Tm (seis) Tj ET',
    ].join('\n');
    expect(extractPdfText(singlePagePdf(content))).toBe('uno\ndos\ntres\ncuatro\ncinco\nseis');
  });

  it('une los textos a la misma altura (aunque estén en otro BT) y pone espacio solo si hay hueco', () => {
    const content = [
      'BT /F1 12 Tf 1 0 0 1 72 700 Tm (Nombre:) Tj ET',
      String.raw`BT /F1 12 Tf 1 0 0 1 150 700 Tm (Luc\355a) Tj ET`,
      'BT /F1 12 Tf 1 0 0 1 72 680 Tm (Fern) Tj ET',
      String.raw`BT /F1 12 Tf 1 0 0 1 96 680 Tm (\341ndez) Tj ET`,
    ].join('\n');
    expect(extractPdfText(singlePagePdf(content))).toBe('Nombre: Lucía\nFernández');
  });

  it('ubica el texto con la matriz de transformación (cm dentro de q/Q)', () => {
    const content = 'q 1 0 0 1 72 700 cm BT /F1 12 Tf 0 0 Td (arriba) Tj ET Q q 1 0 0 1 72 680 cm BT /F1 12 Tf 0 0 Td (abajo) Tj ET Q';
    expect(extractPdfText(singlePagePdf(content))).toBe('arriba\nabajo');
  });

  it('fuente CID (Identity-H, códigos de 2 bytes) con /ToUnicode: bfchar, bfrange y bfrange con arreglo', () => {
    const cmap = [
      '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
      '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
      '1 begincodespacerange <0000> <FFFF> endcodespacerange',
      '3 beginbfchar <0003> <0020> <0010> <00ED> <0012> <00660069> endbfchar',
      '3 beginbfrange <0020> <0039> <0041> <0040> <0059> <0061> <0060> <0061> [<00E1> <00F1>] endbfrange',
      'endcmap CMapName currentdict /CMap defineresource pop end end',
    ].join('\n');
    const special: Record<string, number> = { ' ': 0x03, í: 0x10, á: 0x60, ñ: 0x61 };
    const hex = (text: string): string =>
      `<${[...text.replace('fi', '\u0001')]
        .map((ch) => {
          const code = ch === '\u0001' ? 0x12 : (special[ch] ?? (ch >= 'a' ? 0x40 + ch.charCodeAt(0) - 97 : 0x20 + ch.charCodeAt(0) - 65));
          return code.toString(16).padStart(4, '0');
        })
        .join('')}>`;
    const content = `BT /F1 11 Tf 72 700 Td ${hex('Lucía Fernández')} Tj 0 -14 Td ${hex('Perfil Peña')} Tj ET`;
    const type0 = '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Calibri /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>';
    const cidFont = '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+Calibri /DW 500 /W [3 [226] 16 18 480] >>';
    expect(extractPdfText(pdfWithFont(content, type0, [cidFont, pdfStream('', cmap)]))).toBe('Lucía Fernández\nPerfil Peña');
  });

  it('fuente simple sin /ToUnicode con /Differences', () => {
    const font = '<< /Type /Font /Subtype /Type1 /BaseFont /Propia /Encoding << /Type /Encoding /Differences [1 /L /u /c /iacute /a /space /F /eacute /uni00F1] >> >>';
    const content = String.raw`BT /F1 12 Tf 72 700 Td (\001\002\003\004\005\006\007\010\011) Tj ET`;
    expect(extractPdfText(pdfWithFont(content, font))).toBe('Lucía Féñ');
  });

  it('expande object streams (PDF 1.5+) con las páginas y fuentes adentro', () => {
    const inner = ['<< /Type /Pages /Kids [5 0 R] /Count 1 >>', '<< /Type /Page /Parent 4 0 R /Resources << /Font << /F1 6 0 R >> >> /Contents 3 0 R >>', HELVETICA];
    let offset = 0;
    const header = inner.map((obj, i) => {
      const entry = `${i + 4} ${offset}`;
      offset += obj.length + 1;
      return entry;
    });
    const head = `${header.join(' ')}\n`;
    const objStm = pdfStream(`/Type /ObjStm /N ${inner.length} /First ${head.length}`, head + inner.join('\n'));
    const pdf = buildPdf(['<< /Type /Catalog /Pages 4 0 R >>', objStm, pdfStream('', linesContent(['Desde un object stream']))]);
    expect(extractPdfText(pdf)).toBe('Desde un object stream');
  });

  it('sigue el orden del árbol de páginas (no el de los objetos) y hereda los recursos', () => {
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [4 0 R 3 0 R] /Count 2 /Resources << /Font << /F1 5 0 R >> >> >>',
      '<< /Type /Page /Parent 2 0 R /Contents 6 0 R >>',
      '<< /Type /Page /Parent 2 0 R /Contents [7 0 R] >>',
      HELVETICA,
      pdfStream('', linesContent(['segunda'])),
      pdfStream('', linesContent(['primera'])),
    ]);
    expect(extractPdfText(pdf)).toBe('primera\n\nsegunda');
  });

  it('sin catálogo usable recorre las páginas en el orden de los objetos', () => {
    const pdf = buildPdf([
      '<< /Type /Nada >>',
      '<< /Type /Pages /Kids [] /Resources << /Font << /F1 5 0 R >> >> >>',
      '<< /Type /Page /Parent 2 0 R /Contents 6 0 R >>',
      '<< /Type /Page /Parent 2 0 R /Contents 7 0 R >>',
      HELVETICA,
      pdfStream('', linesContent(['uno'])),
      pdfStream('', linesContent(['dos'])),
    ]);
    expect(extractPdfText(pdf)).toBe('uno\n\ndos');
  });

  it('lee el texto de un Form XObject', () => {
    const form = pdfStream('/Type /XObject /Subtype /Form /BBox [0 0 612 792] /Resources << /Font << /F2 4 0 R >> >>', 'BT /F2 12 Tf 72 700 Td (Desde el form) Tj ET');
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Fm1 6 0 R >> >> /Contents 5 0 R >>',
      HELVETICA,
      pdfStream('', 'q 1 0 0 1 0 0 cm /Fm1 Do Q'),
      form,
    ]);
    expect(extractPdfText(pdf)).toBe('Desde el form');
  });

  it('saltea imágenes en línea y streams con otros filtros (DCTDecode)', () => {
    const content = Buffer.concat([
      latin1('BT /F1 12 Tf 72 700 Td (antes) Tj ET\nBI /W 2 /H 2 /CS /G /BPC 8 ID '),
      Buffer.from([0x00, 0xff, 0x28, 0x29, 0x5b, 0x45, 0x0a]),
      latin1('\nEI\nBT /F1 12 Tf 72 680 Td (despu\\351s) Tj ET'),
    ]);
    const jpeg = pdfStream('/Type /XObject /Subtype /Image /Width 1 /Height 1 /Filter /DCTDecode', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), false);
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 5 0 R >>',
      HELVETICA,
      pdfStream('', content),
      jpeg,
    ]);
    expect(extractPdfText(pdf)).toBe('antes\ndespués');
  });

  it('tolera un stream comprimido truncado y lee lo que se pudo descomprimir', () => {
    const lines = ['Lucía Fernández', ...Array.from({ length: 300 }, (_, i) => `Renglón ${i * 7919} con datos varios ${i * 104729}`)];
    const compressed = deflateSync(latin1(linesContent(lines)));
    const truncated = Buffer.concat([latin1('<< /Filter /FlateDecode /Length 999999 >>\nstream\n'), compressed.subarray(0, Math.floor(compressed.length * 0.6)), latin1('\nendstream')]);
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      HELVETICA,
      truncated,
    ]);
    expect(extractPdfText(pdf).split('\n')[0]).toBe('Lucía Fernández');
  });

  it('no descomprime más de la cuenta (bomba de descompresión) y sigue con lo demás', () => {
    const bomb = Buffer.concat([latin1('<< /Filter /FlateDecode >>\nstream\n'), deflateSync(Buffer.alloc(8 * 1024 * 1024, 0x20)), latin1('\nendstream')]);
    const pdf = buildPdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
      '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      HELVETICA,
      pdfStream('', linesContent(['Texto legible'])),
      '<< /Type /Page /Parent 2 0 R /Contents 7 0 R >>',
      bomb,
    ]);
    expect(extractPdfText(pdf)).toBe('Texto legible');
  });

  it('un PDF sin texto (solo imagen) devuelve vacío', () => {
    expect(extractPdfText(singlePagePdf('q 100 0 0 100 0 0 cm /Im1 Do Q'))).toBe('');
  });

  it('no se vuelve lento con entradas patológicas (5 MB de dígitos o de paréntesis sin cerrar)', () => {
    const start = Date.now();
    expect(extractPdfText(Buffer.concat([latin1('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024, '1')]))).toBe('');
    expect(extractPdfText(singlePagePdf(`BT (${'a'.repeat(2_000_000)}`))).toBe('');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it.each([
    ['vacío', Buffer.alloc(0)],
    ['solo la firma', latin1('%PDF-1.4\n%%EOF')],
    ['basura', latin1('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 9 0 R ((( [[[ <<')],
    ['anidamiento extremo', latin1(`%PDF-1.4\n1 0 obj ${'['.repeat(20000)} endobj`)],
    ['bytes al azar', Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919 + 13) % 256))],
  ])('nunca lanza: %s → vacío', (_, buf) => {
    expect(extractPdfText(buf)).toBe('');
  });
});
