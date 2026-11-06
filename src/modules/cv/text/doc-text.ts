import { cp1252Char } from './cp1252';

/**
 * Extractor de texto de DOC (Word 97-2003, binario OLE) sin dependencias. Primero intenta leer la estructura:
 * contenedor OLE (CFB) → flujos `WordDocument` y `0Table`/`1Table` → tabla de piezas (CLX) → texto, con los
 * encabezados adelante (ahí suelen ir los datos de contacto). Si el archivo no tiene esa forma (Word 6/95,
 * dañado o cifrado), cae a una lectura **heurística**: junta las tiras de caracteres imprimibles en UTF-16LE y
 * en Windows-1252, se queda con la que tiene más letras y descarta las que no parecen texto. Esa segunda lectura
 * puede dejar pasar algo de ruido; para precargar un formulario alcanza. Nunca lanza.
 */

const MAX_OUTPUT_CHARS = 200_000;
const MAX_SECTORS = 1 << 20;
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

// ---------------------------------------------------------------------------------------------------------------
// Contenedor OLE (Compound File Binary)
// ---------------------------------------------------------------------------------------------------------------

interface CfbEntry {
  name: string;
  type: number;
  start: number;
  size: number;
}

class CompoundFile {
  private readonly sectorSize: number;
  private readonly fat: number[] = [];
  private readonly miniFat: number[];
  private readonly miniStream: Buffer;
  private readonly miniCutoff: number;
  readonly entries: CfbEntry[] = [];

  constructor(private readonly buf: Buffer) {
    if (buf.length < 512 || buf.readUInt32LE(0) !== 0xe011cfd0 || buf.readUInt32LE(4) !== 0xe11ab1a1) throw new Error('no es OLE');
    this.sectorSize = 1 << buf.readUInt16LE(0x1e);
    if (this.sectorSize !== 512 && this.sectorSize !== 4096) throw new Error('sector inválido');
    this.miniCutoff = buf.readUInt32LE(0x38);

    // Sectores de la FAT: los 109 del encabezado y, si hay más, la cadena DIFAT.
    const fatSectors: number[] = [];
    for (let i = 0; i < 109; i++) fatSectors.push(buf.readUInt32LE(0x4c + i * 4));
    const perDifat = this.sectorSize / 4 - 1;
    for (let s = buf.readUInt32LE(0x44), n = 0; s < ENDOFCHAIN && n < 1000; n++) {
      const at = this.offset(s);
      for (let i = 0; i < perDifat; i++) fatSectors.push(buf.readUInt32LE(at + i * 4));
      s = buf.readUInt32LE(at + perDifat * 4);
    }
    for (const s of fatSectors.slice(0, buf.readUInt32LE(0x2c))) {
      if (s >= ENDOFCHAIN) continue;
      const at = this.offset(s);
      for (let i = 0; i < this.sectorSize / 4 && this.fat.length < MAX_SECTORS; i++) this.fat.push(buf.readUInt32LE(at + i * 4));
    }

    const dir = this.chain(buf.readUInt32LE(0x30));
    for (let at = 0; at + 128 <= dir.length; at += 128) {
      const nameLength = Math.min(dir.readUInt16LE(at + 0x40), 64);
      this.entries.push({
        name: dir.toString('utf16le', at, at + Math.max(0, nameLength - 2)),
        type: dir[at + 0x42],
        start: dir.readUInt32LE(at + 0x74),
        size: dir.readUInt32LE(at + 0x78),
      });
    }
    const root = this.entries.find((e) => e.type === 5);
    this.miniStream = root ? this.chain(root.start, root.size) : Buffer.alloc(0);
    const miniFatData = this.chain(buf.readUInt32LE(0x3c));
    this.miniFat = Array.from({ length: Math.floor(miniFatData.length / 4) }, (_, i) => miniFatData.readUInt32LE(i * 4));
  }

  stream(name: string): Buffer | null {
    const entry = this.entries.find((e) => e.type === 2 && e.name === name);
    if (!entry) return null;
    return entry.size < this.miniCutoff ? this.miniChain(entry.start, entry.size) : this.chain(entry.start, entry.size);
  }

  private offset(sector: number): number {
    const at = (sector + 1) * this.sectorSize;
    if (at + this.sectorSize > this.buf.length) throw new Error('sector fuera del archivo');
    return at;
  }

  private chain(start: number, size = Infinity): Buffer {
    const parts: Buffer[] = [];
    const seen = new Set<number>();
    let total = 0;
    for (let s = start; s !== ENDOFCHAIN && s !== FREESECT && total < size; s = this.fat[s] ?? ENDOFCHAIN) {
      if (seen.has(s) || seen.size > MAX_SECTORS) throw new Error('cadena circular');
      seen.add(s);
      const at = this.offset(s);
      parts.push(this.buf.subarray(at, at + this.sectorSize));
      total += this.sectorSize;
    }
    const data = Buffer.concat(parts);
    return Number.isFinite(size) ? data.subarray(0, size) : data;
  }

  private miniChain(start: number, size: number): Buffer {
    const parts: Buffer[] = [];
    const seen = new Set<number>();
    let total = 0;
    for (let s = start; s !== ENDOFCHAIN && s !== FREESECT && total < size; s = this.miniFat[s] ?? ENDOFCHAIN) {
      if (seen.has(s)) throw new Error('cadena circular');
      seen.add(s);
      parts.push(this.miniStream.subarray(s * 64, s * 64 + 64));
      total += 64;
    }
    return Buffer.concat(parts).subarray(0, size);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Word: FIB y tabla de piezas
// ---------------------------------------------------------------------------------------------------------------

/** Texto de Word → texto plano: saca los códigos de campo y convierte los separadores de Word en saltos. */
function cleanWordText(raw: string): string {
  let s = raw;
  // Campos: \x13 código \x14 resultado \x15. Se queda con el resultado (los campos pueden anidarse).
  for (let i = 0; i < 10; i++) {
    const next = s.replace(/\x13[^\x13\x14\x15]*\x14/g, '').replace(/\x13[^\x13\x14\x15]*\x15/g, '');
    if (next === s) break;
    s = next;
  }
  return (
    s
      .replace(/[\r\u000b\u000c]/g, '\n')
      .replace(/\u0007/g, '\t')
      .replace(/\u001e/g, '-')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000e-\u001f�]/g, '')
      .replace(/[ \t ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

function structuredText(buf: Buffer): string {
  const cfb = new CompoundFile(buf);
  const word = cfb.stream('WordDocument');
  if (!word || word.length < 0x1aa || word.readUInt16LE(0) !== 0xa5ec) throw new Error('sin FIB');
  const flags = word.readUInt16LE(0x0a);
  if (flags & 0x0100) return ''; // cifrado: no hay texto legible
  const table = cfb.stream(flags & 0x0200 ? '1Table' : '0Table');
  if (!table) throw new Error('sin tabla');

  const ccpText = word.readInt32LE(0x4c);
  const ccpFtn = word.readInt32LE(0x50);
  const ccpHdd = word.readInt32LE(0x54);
  const fcClx = word.readUInt32LE(0x1a2);
  const lcbClx = word.readUInt32LE(0x1a6);
  const clx = table.subarray(fcClx, fcClx + lcbClx);

  let pos = 0;
  while (pos < clx.length && clx[pos] === 0x01) pos += 3 + clx.readInt16LE(pos + 1); // Prc: propiedades, se saltean
  if (clx[pos] !== 0x02) throw new Error('sin tabla de piezas');
  const plc = clx.subarray(pos + 5, pos + 5 + clx.readUInt32LE(pos + 1));
  const pieces = Math.floor((plc.length - 4) / 12);

  // Texto por posición de carácter (CP), pieza por pieza.
  const chars: string[] = [];
  for (let i = 0; i < pieces && chars.length < MAX_OUTPUT_CHARS; i++) {
    const cpStart = plc.readUInt32LE(i * 4);
    const cpEnd = plc.readUInt32LE((i + 1) * 4);
    const fc = plc.readUInt32LE(4 * (pieces + 1) + i * 8 + 2);
    const count = Math.min(Math.max(0, cpEnd - cpStart), MAX_OUTPUT_CHARS);
    if (fc & 0x40000000) {
      const at = (fc & 0x3fffffff) / 2;
      for (let k = 0; k < count && at + k < word.length; k++) chars.push(cp1252Char(word[at + k]));
    } else {
      for (let k = 0; k < count && fc + 2 * k + 1 < word.length; k++) chars.push(String.fromCharCode(word.readUInt16LE(fc + 2 * k)));
    }
  }
  const all = chars.join('');
  const main = all.slice(0, Math.max(0, ccpText));
  const headerStart = Math.max(0, ccpText) + Math.max(0, ccpFtn);
  const headers = ccpHdd > 0 ? all.slice(headerStart, headerStart + ccpHdd) : '';
  return [cleanWordText(headers), cleanWordText(main)].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// Lectura heurística (respaldo)
// ---------------------------------------------------------------------------------------------------------------

const MIN_RUN = 4;
const MAX_RUN = 10_000;

/** Tiras que no son contenido: nombres del contenedor OLE, de fuentes, de estilos y de partes XML embebidas. */
const BOILERPLATE =
  /^(root entry|worddocument|summaryinformation|documentsummaryinformation|compobj|objectpool|[01]table|data|msowordnote|microsoft (office )?word.*|word\.document\.\d+|normal(\.dotm?)?|times new roman|calibri( light)?|cambria( math)?|arial( unicode ms)?|symbol|courier new|wingdings|aptos.*|default paragraph font|fuente de p[áa]rrafo predeter\.?|table normal|tabla normal|no list|sin lista|heading \d|t[íi]tulo \d|bjbj.*|.*\.(xml|rels)\b.*)$/i;
/** Caracteres de un texto en castellano (o inglés): lo que tenga otros no se considera texto. */
const TEXT_LIKE = /^[A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑàèìòùâêôçãõÀÈÒÙÂÊÔÇ .,:;()@/+\-–—'"“”‘’°ºª|·•!?¡¿&%#*_€$\t]+$/;

const countLetters = (s: string): number => (s.match(/\p{L}/gu) ?? []).length;

/** Caracteres que se aceptan dentro de una tira: letras latinas, dígitos, puntuación y espacios. */
function printable(ch: string): boolean {
  const c = ch.charCodeAt(0);
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0x24f) return true;
  return '€‚„…–—‘’“”•'.includes(ch);
}

const looksLikeText = (line: string): boolean =>
  line.length >= MIN_RUN && TEXT_LIKE.test(line) && countLetters(line) >= 2 && (line.includes(' ') || line.length >= 6) && !BOILERPLATE.test(line);

function collectRuns(chars: Iterable<string>): string {
  const lines: string[] = [];
  let run = '';
  let total = 0;
  const flush = (): void => {
    for (const piece of run.split('\n')) {
      const line = piece.replace(/\s+/g, ' ').trim();
      if (looksLikeText(line)) {
        lines.push(line);
        total += line.length;
      }
    }
    run = '';
  };
  for (const ch of chars) {
    if (total > MAX_OUTPUT_CHARS) break;
    if (printable(ch)) run += ch;
    else if (/^[\r\n\u000b\u0007]$/.test(ch) && run) run += '\n';
    else if (ch === '\t' && run) run += ' ';
    else flush();
    if (run.length > MAX_RUN) flush(); // una tira gigante no es texto de un CV
  }
  flush();
  return lines.join('\n').slice(0, MAX_OUTPUT_CHARS);
}

function* utf16Chars(buf: Buffer): Generator<string> {
  for (let i = 0; i + 1 < buf.length; i += 2) yield String.fromCharCode(buf[i] | (buf[i + 1] << 8));
}

function* cp1252Chars(buf: Buffer): Generator<string> {
  for (const b of buf) yield cp1252Char(b) || '\u0000';
}

function heuristicText(buf: Buffer): string {
  const wide = collectRuns(utf16Chars(buf));
  const narrow = collectRuns(cp1252Chars(buf));
  return countLetters(wide) >= countLetters(narrow) ? wide : narrow;
}

/** Texto de un DOC binario (estructura de Word o, si no se puede, lectura aproximada). Nunca lanza: sin texto devuelve ''. */
export function extractDocText(buf: Buffer): string {
  try {
    return structuredText(buf);
  } catch {
    try {
      return heuristicText(buf);
    } catch {
      return '';
    }
  }
}
