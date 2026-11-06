import { deflateSync } from 'zlib';

/** Literal de PDF en WinAnsi (latin1) con los escapes necesarios: "Lucía (CV)" → (Luc\355a \(CV\)). */
export function pdfString(text: string): string {
  return `(${text.replace(/[\()]/g, '\$&')})`;
}

/** Stream con su diccionario. Por defecto comprimido con FlateDecode. */
export function pdfStream(dict: string, data: Buffer | string, compress = true): Buffer {
  const raw = typeof data === 'string' ? Buffer.from(data, 'latin1') : data;
  const body = compress ? deflateSync(raw) : raw;
  const head = `<< ${dict} ${compress ? '/Filter /FlateDecode ' : ''}/Length ${body.length} >>\nstream\n`;
  return Buffer.concat([Buffer.from(head, 'latin1'), body, Buffer.from('\nendstream', 'latin1')]);
}

/** PDF con los objetos dados, numerados desde 1 (el 1 tiene que ser el catálogo), con xref y trailer. */
export function buildPdf(objects: Array<string | Buffer>): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = parts[0].length;
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), typeof o === 'string' ? Buffer.from(o, 'latin1') : o, Buffer.from('\nendobj\n', 'latin1')]);
    offsets.push(offset);
    offset += chunk.length;
    parts.push(chunk);
  });
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `)].join('\n');
  parts.push(Buffer.from(`${xref}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}

/** Objeto de fuente Helvetica con WinAnsi (sin /Widths, como las 14 fuentes estándar). */
export const HELVETICA = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

/** Content stream que escribe un renglón por elemento, de arriba hacia abajo. */
export function linesContent(lines: string[]): string {
  return ['BT', '/F1 12 Tf', '72 750 Td', ...lines.map((l, i) => `${i ? '0 -16 Td ' : ''}${pdfString(l)} Tj`), 'ET'].join('\n');
}

/** PDF de una página con un content stream propio (comprimido por defecto), Helvetica (u otra fuente) como /F1 y objetos extra desde el 6. */
export function singlePagePdf(content: string | Buffer, options: { compress?: boolean; font?: string; extra?: Array<string | Buffer> } = {}): Buffer {
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    options.font ?? HELVETICA,
    pdfStream('', content, options.compress ?? true),
    ...(options.extra ?? []),
  ]);
}

/** PDF de una página con un renglón por elemento (Helvetica, WinAnsi, FlateDecode). */
export function textPdf(lines: string[]): Buffer {
  return singlePagePdf(linesContent(lines));
}

/**
 * PDF de una página con una fuente CID (Type0, Identity-H, códigos de 2 bytes que no son Unicode) y su /ToUnicode,
 * como los que generan Word o los navegadores. Cada renglón va en un TJ partido al medio con un ajuste de kerning.
 */
export function cidFontPdf(lines: string[]): Buffer {
  const chars = [...new Set(lines.join(''))];
  const code = (ch: string): number => 0x0100 + chars.indexOf(ch) * 3;
  const hex4 = (n: number): string => n.toString(16).padStart(4, '0');
  const encode = (s: string): string => `<${[...s].map((ch) => hex4(code(ch))).join('')}>`;
  const unicode = (ch: string): string => Buffer.from(ch, 'utf16le').swap16().toString('hex');
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    `${chars.length} beginbfchar`,
    ...chars.map((ch) => `<${hex4(code(ch))}> <${unicode(ch)}>`),
    'endbfchar endcmap CMapName currentdict /CMap defineresource pop end end',
  ].join('\n');
  const content = [
    'BT /F1 11 Tf 72 750 Td',
    ...lines.map((l, i) => {
      const mid = Math.ceil(l.length / 2);
      return `${i ? '0 -16 Td ' : ''}[${encode(l.slice(0, mid))} 15 ${encode(l.slice(mid))}] TJ`;
    }),
    'ET',
  ].join('\n');
  return singlePagePdf(content, {
    font: [
      '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Calibri /Encoding /Identity-H /DescendantFonts',
      '[<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+Calibri /DW 500 >>] /ToUnicode 6 0 R >>',
    ].join(' '),
    extra: [pdfStream('', cmap)],
  });
}
