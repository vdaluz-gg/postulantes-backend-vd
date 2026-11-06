import * as zlib from 'zlib';

/**
 * Extractor de texto de DOCX sin dependencias: un lector de zip mínimo (directorio central + stored/deflate) y una
 * conversión de WordprocessingML a texto. Lee primero los encabezados (`word/header*.xml`, donde muchos CV ponen
 * los datos de contacto), después el cuerpo y al final los pies. Nunca lanza: ante un zip roto devuelve ''.
 */

const MAX_ENTRY_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_ENTRIES = 2000;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

function readEntries(buf: Buffer): ZipEntry[] {
  // El registro de fin está en los últimos 22 bytes + un comentario de hasta 64 KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = Math.min(buf.readUInt16LE(eocd + 10), MAX_ENTRIES);
  let pos = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count && pos + 46 <= buf.length && buf.readUInt32LE(pos) === CENTRAL; i++) {
    const nameLength = buf.readUInt16LE(pos + 28);
    const extraLength = buf.readUInt16LE(pos + 30);
    const commentLength = buf.readUInt16LE(pos + 32);
    entries.push({
      method: buf.readUInt16LE(pos + 10),
      compressedSize: buf.readUInt32LE(pos + 20),
      size: buf.readUInt32LE(pos + 24),
      localOffset: buf.readUInt32LE(pos + 42),
      name: buf.toString('utf8', pos + 46, Math.min(pos + 46 + nameLength, buf.length)),
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(buf: Buffer, entry: ZipEntry): Buffer | null {
  // Tamaños 0xFFFFFFFF = ZIP64 (o archivos enormes): no hacen falta para un CV.
  if (entry.size > MAX_ENTRY_BYTES || entry.compressedSize > buf.length) return null;
  const at = entry.localOffset;
  if (at + 30 > buf.length || buf.readUInt32LE(at) !== LOCAL) return null;
  const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
  const data = buf.subarray(start, Math.min(start + entry.compressedSize, buf.length));
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: MAX_ENTRY_BYTES });
  return null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] !== '#') return ENTITIES[body] ?? whole;
    const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  });
}

/** Saca los bloques `open ... close` con indexOf (lineal; una regex perezosa sin cierre sería cuadrática). */
function removeBlocks(xml: string, open: string, close: string): string {
  let out = '';
  let pos = 0;
  for (;;) {
    const start = xml.indexOf(open, pos);
    const end = start < 0 ? -1 : xml.indexOf(close, start);
    if (end < 0) break;
    out += xml.slice(pos, start);
    pos = end + close.length;
  }
  return out + xml.slice(pos);
}

/**
 * WordprocessingML → texto. Solo toma el contenido de `<w:t>` (así quedan afuera los códigos de campo y el texto
 * borrado con control de cambios), `</w:p>` y `<w:br/>` son saltos de línea y `<w:tab/>` un tabulador. Las
 * definiciones de tabulaciones (`<w:tabs>`) y las versiones alternativas (`<mc:Fallback>`, que repiten los
 * cuadros de texto) se descartan.
 */
export function wordXmlToText(xml: string): string {
  const token = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\b[^>]*\/>|<w:(?:br|cr)\b[^>]*\/>|<w:noBreakHyphen\b[^>]*\/>|<\/w:p>/g;
  const body = removeBlocks(removeBlocks(xml, '<mc:Fallback', '</mc:Fallback>'), '<w:tabs>', '</w:tabs>');
  let out = '';
  for (let m = token.exec(body); m; m = token.exec(body)) {
    const tag = m[0];
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (tag.startsWith('<w:tab') && !tag.startsWith('<w:tabs')) out += '\t';
    else if (tag.startsWith('<w:br') || tag.startsWith('<w:cr') || tag === '</w:p>') out += '\n';
    else if (tag.startsWith('<w:noBreakHyphen')) out += '-';
  }
  return out;
}

const partOrder = (name: string): number => {
  if (/^word\/header\d*\.xml$/.test(name)) return 0;
  if (name === 'word/document.xml') return 1;
  if (/^word\/footer\d*\.xml$/.test(name)) return 2;
  return -1;
};

/** Texto de un DOCX: encabezados, cuerpo y pies, una línea por párrafo. Nunca lanza: si el archivo está roto devuelve ''. */
export function extractDocxText(buf: Buffer): string {
  try {
    const parts = readEntries(buf)
      .filter((e) => partOrder(e.name) >= 0)
      .sort((a, b) => partOrder(a.name) - partOrder(b.name) || a.name.localeCompare(b.name, 'en', { numeric: true }));
    if (!parts.some((p) => p.name === 'word/document.xml')) return '';
    const texts: string[] = [];
    let total = 0;
    for (const part of parts) {
      let data: Buffer | null = null;
      try {
        data = readEntry(buf, part);
      } catch {
        data = null; // parte dañada: se sigue con las demás
      }
      if (!data) continue;
      total += data.length;
      if (total > MAX_TOTAL_BYTES) break;
      texts.push(wordXmlToText(data.toString('utf8')).replace(/\n+$/, ''));
    }
    return texts
      .join('\n')
      .replace(/[  ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}
