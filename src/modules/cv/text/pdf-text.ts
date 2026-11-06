import * as zlib from 'zlib';
import { cp1252Char } from './cp1252';

/**
 * Extractor de texto de PDF sin dependencias (solo zlib de Node). No pretende ser un lector completo: alcanza
 * para los CV que generan Word, LibreOffice, Google Docs, Canva o los navegadores (texto con fuentes simples o
 * CID con /ToUnicode). Un PDF escaneado (solo imágenes) o cifrado devuelve ''.
 *
 * Límites contra archivos maliciosos (zip bombs, anidamientos infinitos): cada stream se descomprime hasta
 * MAX_STREAM_BYTES, hay un tope total, de objetos, de páginas, de operadores y de profundidad.
 */

const MAX_OBJECTS = 5000;
const MAX_STREAM_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_DECODED = 30 * 1024 * 1024;
const MAX_NESTING = 64;
const MAX_PAGES = 50;
const MAX_FORM_DEPTH = 4;
const MAX_OPERATORS = 500_000;
const MAX_OUTPUT_CHARS = 200_000;
const MAX_CMAP_ENTRIES = 65_536;
/** Iteraciones máximas al armar una CMap o una tabla de anchos (rangos superpuestos no agrandan el mapa). */
const MAX_TABLE_WORK = 4 * MAX_CMAP_ENTRIES;
const MAX_CODE_RANGES = 32;

// ---------------------------------------------------------------------------------------------------------------
// Modelo de objetos
// ---------------------------------------------------------------------------------------------------------------

class PdfName {
  constructor(readonly value: string) {}
}
class PdfRef {
  constructor(readonly num: number) {}
}
class PdfString {
  constructor(readonly bytes: Buffer) {}
}
/** Palabra clave suelta: operadores de los content streams o tokens inesperados. */
class PdfKeyword {
  constructor(readonly value: string) {}
}
class PdfStream {
  decoded: Buffer | null | undefined;
  constructor(
    readonly dict: PdfDict,
    readonly raw: Buffer,
  ) {}
}
type PdfDict = Map<string, PdfValue>;
type PdfValue = number | boolean | null | PdfName | PdfRef | PdfString | PdfKeyword | PdfStream | PdfDict | PdfValue[];

const isDict = (v: unknown): v is PdfDict => v instanceof Map;
const nameOf = (v: unknown): string | undefined => (v instanceof PdfName ? v.value : undefined);
const numberOf = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

// ---------------------------------------------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------------------------------------------

type Token =
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'str'; v: Buffer }
  | { t: 'kw'; v: string }
  | { t: 'delim'; v: string };

const isWhite = (c: number): boolean => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
const isDelimiter = (c: number): boolean =>
  c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
const hexValue = (c: number): number => {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x41 && c <= 0x46) return c - 0x37;
  if (c >= 0x61 && c <= 0x66) return c - 0x57;
  return -1;
};
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

class Lexer {
  pos: number;
  private readonly pending: Token[] = [];

  constructor(
    readonly buf: Buffer,
    start = 0,
    readonly end = buf.length,
  ) {
    this.pos = start;
  }

  next(): Token | null {
    return this.pending.length ? (this.pending.pop() as Token) : this.read();
  }

  unread(tok: Token): void {
    this.pending.push(tok);
  }

  private read(): Token | null {
    const b = this.buf;
    const end = this.end;
    while (this.pos < end) {
      const c = b[this.pos];
      if (isWhite(c)) this.pos++;
      else if (c === 0x25) {
        while (this.pos < end && b[this.pos] !== 0x0a && b[this.pos] !== 0x0d) this.pos++;
      } else break;
    }
    if (this.pos >= end) return null;
    const c = b[this.pos];
    if (c === 0x28) return { t: 'str', v: this.readLiteral() };
    if (c === 0x3c) {
      if (b[this.pos + 1] === 0x3c) {
        this.pos += 2;
        return { t: 'delim', v: '<<' };
      }
      return { t: 'str', v: this.readHex() };
    }
    if (c === 0x3e && b[this.pos + 1] === 0x3e) {
      this.pos += 2;
      return { t: 'delim', v: '>>' };
    }
    if (c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) {
      this.pos++;
      return { t: 'delim', v: String.fromCharCode(c) };
    }
    if (c === 0x2f) return { t: 'name', v: this.readName() };
    const start = this.pos;
    while (this.pos < end && !isWhite(b[this.pos]) && !isDelimiter(b[this.pos])) this.pos++;
    if (this.pos === start) {
      // Delimitador suelto (un ')' o '>' de más): se devuelve como palabra clave y se sigue.
      this.pos++;
      return { t: 'kw', v: String.fromCharCode(c) };
    }
    const s = b.toString('latin1', start, this.pos);
    return NUMBER.test(s) ? { t: 'num', v: parseFloat(s) } : { t: 'kw', v: s };
  }

  private readName(): string {
    const b = this.buf;
    const start = ++this.pos;
    while (this.pos < this.end && !isWhite(b[this.pos]) && !isDelimiter(b[this.pos])) this.pos++;
    const raw = b.toString('latin1', start, this.pos);
    return raw.includes('#') ? raw.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))) : raw;
  }

  private readLiteral(): Buffer {
    const b = this.buf;
    const end = this.end;
    const out: number[] = [];
    let depth = 1;
    this.pos++;
    while (this.pos < end) {
      let c = b[this.pos++];
      if (c === 0x5c) {
        if (this.pos >= end) break;
        c = b[this.pos++];
        if (c === 0x6e) out.push(0x0a);
        else if (c === 0x72) out.push(0x0d);
        else if (c === 0x74) out.push(0x09);
        else if (c === 0x62) out.push(0x08);
        else if (c === 0x66) out.push(0x0c);
        else if (c === 0x0d) {
          if (b[this.pos] === 0x0a) this.pos++;
        } else if (c === 0x0a) {
          // continuación de línea: no agrega nada
        } else if (c >= 0x30 && c <= 0x37) {
          let v = c - 0x30;
          for (let k = 0; k < 2 && this.pos < end && b[this.pos] >= 0x30 && b[this.pos] <= 0x37; k++) v = v * 8 + (b[this.pos++] - 0x30);
          out.push(v & 0xff);
        } else out.push(c); // \( \) \\ y escapes desconocidos
      } else if (c === 0x28) {
        depth++;
        out.push(c);
      } else if (c === 0x29) {
        if (--depth === 0) break;
        out.push(c);
      } else out.push(c);
    }
    return Buffer.from(out);
  }

  private readHex(): Buffer {
    const b = this.buf;
    const digits: number[] = [];
    this.pos++;
    while (this.pos < this.end) {
      const c = b[this.pos++];
      if (c === 0x3e) break;
      const v = hexValue(c);
      if (v >= 0) digits.push(v);
    }
    if (digits.length % 2) digits.push(0);
    const out = Buffer.alloc(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = digits[2 * i] * 16 + digits[2 * i + 1];
    return out;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Parser de objetos
// ---------------------------------------------------------------------------------------------------------------

function parseValue(lx: Lexer, allowRefs: boolean, depth = 0): PdfValue | undefined {
  const tok = lx.next();
  return tok ? valueFromToken(lx, tok, allowRefs, depth) : undefined;
}

function valueFromToken(lx: Lexer, tok: Token, allowRefs: boolean, depth: number): PdfValue {
  if (depth > MAX_NESTING) throw new Error('nesting');
  switch (tok.t) {
    case 'num': {
      if (!allowRefs || !Number.isInteger(tok.v)) return tok.v;
      const t2 = lx.next();
      if (t2?.t === 'num' && Number.isInteger(t2.v)) {
        const t3 = lx.next();
        if (t3?.t === 'kw' && t3.v === 'R') return new PdfRef(tok.v);
        if (t3) lx.unread(t3);
      }
      if (t2) lx.unread(t2);
      return tok.v;
    }
    case 'name':
      return new PdfName(tok.v);
    case 'str':
      return new PdfString(tok.v);
    case 'kw':
      if (tok.v === 'true') return true;
      if (tok.v === 'false') return false;
      if (tok.v === 'null') return null;
      return new PdfKeyword(tok.v);
    case 'delim': {
      if (tok.v === '[') {
        const arr: PdfValue[] = [];
        for (let t = lx.next(); t && !(t.t === 'delim' && t.v === ']'); t = lx.next()) arr.push(valueFromToken(lx, t, allowRefs, depth + 1));
        return arr;
      }
      if (tok.v === '<<') {
        const dict: PdfDict = new Map();
        for (let t = lx.next(); t && !(t.t === 'delim' && t.v === '>>'); t = lx.next()) {
          if (t.t !== 'name') continue; // basura dentro del diccionario: se ignora
          const v = parseValue(lx, allowRefs, depth + 1);
          if (v === undefined || (v instanceof PdfKeyword && v.value === '>>')) break;
          dict.set(t.v, v);
        }
        return dict;
      }
      return new PdfKeyword(tok.v);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Documento: objetos indirectos, streams y object streams
// ---------------------------------------------------------------------------------------------------------------

function inflate(data: Buffer): Buffer | null {
  const options = { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: MAX_STREAM_BYTES };
  try {
    return zlib.inflateSync(data, options);
  } catch {
    try {
      // Algunos generadores omiten o rompen la cabecera zlib.
      return data.length > 2 ? zlib.inflateRawSync(data.subarray(2), options) : null;
    } catch {
      return null;
    }
  }
}

class PdfDocument {
  readonly objects = new Map<number, PdfValue>();
  private decodedTotal = 0;

  constructor(private readonly buf: Buffer) {
    this.readIndirectObjects();
    this.expandObjectStreams();
  }

  resolve(v: PdfValue | undefined): PdfValue | undefined {
    for (let i = 0; i < 32 && v instanceof PdfRef; i++) v = this.objects.get(v.num);
    return v instanceof PdfRef ? undefined : v;
  }

  dict(v: PdfValue | undefined): PdfDict | undefined {
    const r = this.resolve(v);
    if (isDict(r)) return r;
    return r instanceof PdfStream ? r.dict : undefined;
  }

  array(v: PdfValue | undefined): PdfValue[] | undefined {
    const r = this.resolve(v);
    return Array.isArray(r) ? r : undefined;
  }

  /** Contenido decodificado del stream, o null si usa un filtro no soportado (imágenes) o excede los límites. */
  decode(stream: PdfStream): Buffer | null {
    if (stream.decoded !== undefined) return stream.decoded;
    let result: Buffer | null = null;
    const filter = this.resolve(stream.dict.get('Filter'));
    const filters = (Array.isArray(filter) ? filter : filter == null ? [] : [filter]).map((f) => nameOf(this.resolve(f)));
    if (filters.every((f) => f === 'FlateDecode' || f === 'Fl')) {
      result = stream.raw.length <= MAX_STREAM_BYTES ? stream.raw : null;
      for (let i = 0; i < filters.length && result; i++) result = inflate(result);
    }
    if (result) {
      this.decodedTotal += result.length;
      if (this.decodedTotal > MAX_TOTAL_DECODED) result = null;
    }
    stream.decoded = result;
    return result;
  }

  private readIndirectObjects(): void {
    const text = this.buf.toString('latin1');
    // Sin el lookbehind y los topes, una tira enorme de dígitos haría la búsqueda cuadrática.
    const header = /(?<!\d)(\d{1,10})\s+\d{1,5}\s+obj\b/g;
    let m: RegExpExecArray | null;
    while ((m = header.exec(text)) && this.objects.size < MAX_OBJECTS) {
      const lx = new Lexer(this.buf, m.index + m[0].length);
      try {
        const value = parseValue(lx, true);
        if (value === undefined) break;
        const after = lx.next();
        if (after?.t === 'kw' && after.v === 'stream' && isDict(value)) {
          const { data, end } = this.readStreamData(text, lx.pos, value);
          this.objects.set(Number(m[1]), new PdfStream(value, data));
          header.lastIndex = Math.max(header.lastIndex, end);
        } else {
          this.objects.set(Number(m[1]), value);
          header.lastIndex = Math.max(header.lastIndex, lx.pos);
        }
      } catch {
        // objeto roto: se saltea y se sigue con el próximo
      }
    }
  }

  private readStreamData(text: string, pos: number, dict: PdfDict): { data: Buffer; end: number } {
    const buf = this.buf;
    let start = pos;
    if (buf[start] === 0x0d && buf[start + 1] === 0x0a) start += 2;
    else if (buf[start] === 0x0a || buf[start] === 0x0d) start += 1;
    const length = dict.get('Length');
    if (typeof length === 'number' && length >= 0 && start + length <= buf.length) {
      if (/^\s*endstream/.test(text.slice(start + length, start + length + 32))) {
        return { data: buf.subarray(start, start + length), end: start + length };
      }
    }
    const idx = text.indexOf('endstream', start);
    let stop = idx < 0 ? buf.length : idx;
    if (stop > start && buf[stop - 1] === 0x0a) stop--;
    if (stop > start && buf[stop - 1] === 0x0d) stop--;
    return { data: buf.subarray(start, stop), end: idx < 0 ? buf.length : idx + 9 };
  }

  private expandObjectStreams(): void {
    for (const value of [...this.objects.values()]) {
      if (!(value instanceof PdfStream) || nameOf(value.dict.get('Type')) !== 'ObjStm') continue;
      try {
        const data = this.decode(value);
        if (!data) continue;
        const n = Math.min(numberOf(value.dict.get('N'), 0), MAX_OBJECTS);
        const first = numberOf(value.dict.get('First'), 0);
        const lx = new Lexer(data);
        const entries: Array<[number, number]> = [];
        for (let i = 0; i < n; i++) {
          const num = lx.next();
          const off = lx.next();
          if (num?.t !== 'num' || off?.t !== 'num') break;
          entries.push([num.v, off.v]);
        }
        for (const [num, off] of entries) {
          if (this.objects.size >= MAX_OBJECTS) return;
          if (this.objects.has(num)) continue; // un objeto suelto con el mismo número es más nuevo
          const v = parseValue(new Lexer(data, first + off), true);
          if (v !== undefined) this.objects.set(num, v);
        }
      } catch {
        // object stream roto: se ignora
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Fuentes: /ToUnicode, codificación y anchos
// ---------------------------------------------------------------------------------------------------------------

interface CodeRange {
  bytes: number;
  lo: number;
  hi: number;
}
interface CMap {
  ranges: CodeRange[];
  map: Map<string, string>;
}

const codeKey = (bytes: number, code: number): string => `${bytes}:${code}`;
const bytesToInt = (b: Buffer): number => b.reduce((acc, x) => acc * 256 + x, 0);

function utf16be(b: Buffer): string {
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode((b[i] << 8) | b[i + 1]);
  if (b.length % 2) s += String.fromCharCode(b[b.length - 1]);
  return s.replace(/\u0000/g, '');
}

const GLYPHS: Record<string, string> = {
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%', ampersand: '&', quotesingle: "'",
  quoteright: '’', quoteleft: '‘', parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',', hyphen: '-',
  minus: '-', period: '.', slash: '/', zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', colon: ':', semicolon: ';', less: '<', equal: '=', greater: '>', question: '?',
  at: '@', bracketleft: '[', backslash: '\\', bracketright: ']', underscore: '_', braceleft: '{', bar: '|',
  braceright: '}', endash: '–', emdash: '—', bullet: '•', quotedblleft: '“', quotedblright: '”', ordfeminine: 'ª',
  ordmasculine: 'º', degree: '°', exclamdown: '¡', questiondown: '¿', germandbls: 'ß', ellipsis: '…', nbspace: ' ',
  nonbreakingspace: ' ', fi: 'fi', fl: 'fl',
};
const ACCENTS: Record<string, string> = {
  acute: '́', grave: '̀', dieresis: '̈', circumflex: '̂', tilde: '̃', cedilla: '̧', ring: '̊',
};

function glyphToUnicode(name: string): string {
  if (GLYPHS[name] !== undefined) return GLYPHS[name];
  if (/^[A-Za-z]$/.test(name)) return name;
  const accented = /^([A-Za-z])(acute|grave|dieresis|circumflex|tilde|cedilla|ring)$/.exec(name);
  if (accented) return (accented[1] + ACCENTS[accented[2]]).normalize('NFC');
  const uni = /^uni([0-9A-Fa-f]{4})/.exec(name) ?? /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (uni) {
    const cp = parseInt(uni[1], 16);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  }
  return '';
}

function parseCMap(data: Buffer): CMap {
  const cmap: CMap = { ranges: [], map: new Map() };
  let work = MAX_TABLE_WORK;
  const lx = new Lexer(data);
  const isEnd = (t: Token | null, kw: string): boolean => !t || (t.t === 'kw' && t.v === kw);
  for (let tok = lx.next(); tok; tok = lx.next()) {
    if (tok.t !== 'kw') continue;
    if (tok.v === 'begincodespacerange') {
      for (let a = lx.next(); !isEnd(a, 'endcodespacerange'); a = lx.next()) {
        const b = lx.next();
        if (a?.t === 'str' && b?.t === 'str' && a.v.length > 0 && a.v.length <= 4 && cmap.ranges.length < MAX_CODE_RANGES) {
          cmap.ranges.push({ bytes: a.v.length, lo: bytesToInt(a.v), hi: bytesToInt(b.v) });
        }
      }
    } else if (tok.v === 'beginbfchar') {
      for (let src = lx.next(); !isEnd(src, 'endbfchar'); src = lx.next()) {
        const dst = lx.next();
        if (src?.t !== 'str' || src.v.length === 0 || src.v.length > 4 || cmap.map.size >= MAX_CMAP_ENTRIES) continue;
        const text = dst?.t === 'str' ? utf16be(dst.v) : dst?.t === 'name' ? glyphToUnicode(dst.v) : '';
        cmap.map.set(codeKey(src.v.length, bytesToInt(src.v)), text);
      }
    } else if (tok.v === 'beginbfrange') {
      for (let lo = lx.next(); !isEnd(lo, 'endbfrange'); lo = lx.next()) {
        const hi = lx.next();
        const dstTok = lx.next();
        if (!dstTok) break;
        const dst = valueFromToken(lx, dstTok, false, 0);
        if (lo?.t !== 'str' || hi?.t !== 'str' || lo.v.length === 0 || lo.v.length > 4) continue;
        const bytes = lo.v.length;
        const from = bytesToInt(lo.v);
        const to = Math.min(bytesToInt(hi.v), from + MAX_CMAP_ENTRIES);
        if (dst instanceof PdfString) {
          const base = utf16be(dst.bytes);
          if (!base) continue;
          const prefix = base.slice(0, -1);
          const last = base.charCodeAt(base.length - 1);
          for (let code = from; code <= to && cmap.map.size < MAX_CMAP_ENTRIES && work-- > 0; code++) {
            cmap.map.set(codeKey(bytes, code), prefix + String.fromCharCode(last + code - from));
          }
        } else if (Array.isArray(dst)) {
          dst.forEach((d, i) => {
            if (d instanceof PdfString && from + i <= to && cmap.map.size < MAX_CMAP_ENTRIES && work-- > 0) cmap.map.set(codeKey(bytes, from + i), utf16be(d.bytes));
          });
        }
      }
    }
  }
  return cmap;
}

interface Glyph {
  text: string;
  /** Avance en milésimas de em. */
  width: number;
  /** Código de un byte 32: le aplica el espaciado de palabras (Tw). */
  isSpace: boolean;
}

interface FontInfo {
  decode(bytes: Buffer): Glyph[];
}

const DEFAULT_WIDTH = 500;

function splitCodes(bytes: Buffer, ranges: CodeRange[], fallbackBytes: number): Array<{ code: number; n: number }> {
  const out: Array<{ code: number; n: number }> = [];
  const sizes = [...new Set(ranges.map((r) => r.bytes))].sort((a, b) => a - b);
  let pos = 0;
  while (pos < bytes.length) {
    let n = 0;
    for (const size of sizes) {
      if (pos + size > bytes.length) continue;
      const code = bytesToInt(bytes.subarray(pos, pos + size));
      if (ranges.some((r) => r.bytes === size && code >= r.lo && code <= r.hi)) {
        n = size;
        break;
      }
    }
    if (!n) n = Math.min(sizes[0] ?? fallbackBytes, bytes.length - pos);
    out.push({ code: bytesToInt(bytes.subarray(pos, pos + n)), n });
    pos += n;
  }
  return out;
}

function buildFont(doc: PdfDocument, font: PdfDict): FontInfo {
  const toUnicodeStream = doc.resolve(font.get('ToUnicode'));
  const toUnicodeData = toUnicodeStream instanceof PdfStream ? doc.decode(toUnicodeStream) : null;
  const cmap = toUnicodeData ? parseCMap(toUnicodeData) : null;

  if (nameOf(font.get('Subtype')) === 'Type0') {
    const descendant = doc.dict(doc.array(font.get('DescendantFonts'))?.[0]);
    const defaultWidth = numberOf(descendant?.get('DW'), 1000);
    const widths = new Map<number, number>();
    const w = doc.array(descendant?.get('W')) ?? [];
    let work = MAX_TABLE_WORK;
    for (let i = 0; i < w.length && work > 0; ) {
      const first = doc.resolve(w[i]);
      const next = doc.resolve(w[i + 1]);
      if (typeof first !== 'number') break;
      if (Array.isArray(next)) {
        next.slice(0, Math.max(0, work)).forEach((x, k) => widths.set(first + k, numberOf(doc.resolve(x), defaultWidth)));
        work -= next.length;
        i += 2;
      } else {
        const last = Math.min(numberOf(next, first), first + MAX_CMAP_ENTRIES);
        const width = numberOf(doc.resolve(w[i + 2]), defaultWidth);
        for (let c = first; c <= last && work-- > 0; c++) widths.set(c, width);
        i += 3;
      }
    }
    return {
      decode: (bytes) =>
        splitCodes(bytes, cmap?.ranges ?? [], 2).map(({ code, n }) => ({
          text: cmap?.map.get(codeKey(n, code)) ?? '',
          width: widths.get(code) ?? defaultWidth,
          isSpace: false,
        })),
    };
  }

  const firstChar = numberOf(doc.resolve(font.get('FirstChar')), 0);
  const widthArray = doc.array(font.get('Widths'));
  const differences = new Map<number, string>();
  const encoding = doc.dict(font.get('Encoding'));
  const diffs = doc.array(encoding?.get('Differences')) ?? [];
  let code = 0;
  for (const d of diffs) {
    const v = doc.resolve(d);
    if (typeof v === 'number') code = v;
    else if (v instanceof PdfName) differences.set(code++, glyphToUnicode(v.value));
  }
  return {
    decode: (bytes) =>
      [...bytes].map((byte) => {
        const mapped = cmap?.map.get(codeKey(1, byte));
        const text = mapped ?? differences.get(byte) ?? cp1252Char(byte);
        const width = widthArray ? numberOf(doc.resolve(widthArray[byte - firstChar]), DEFAULT_WIDTH) : DEFAULT_WIDTH;
        return { text, width, isSpace: byte === 32 };
      }),
  };
}

const FALLBACK_FONT: FontInfo = {
  decode: (bytes) => [...bytes].map((b) => ({ text: cp1252Char(b), width: DEFAULT_WIDTH, isSpace: b === 32 })),
};

// ---------------------------------------------------------------------------------------------------------------
// Interpretación de los content streams
// ---------------------------------------------------------------------------------------------------------------

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const toMatrix = (ops: PdfValue[]): Matrix | null => {
  const nums = ops.slice(-6);
  return nums.length === 6 && nums.every((x) => typeof x === 'number' && Number.isFinite(x)) ? (nums as Matrix) : null;
};

interface GraphicsState {
  ctm: Matrix;
  font: FontInfo;
  fontSize: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  leading: number;
}

/** Arma las líneas: salto cuando cambia la altura del texto o lo pide un operador; espacio cuando hay un hueco. */
class TextWriter {
  private readonly lines: string[] = [];
  private current = '';
  private lastY = 0;
  private lastEndX = 0;
  private chars = 0;
  breakRequested = false;
  spaceRequested = false;
  /** Operadores interpretados en todo el documento (el tope es global, no por página). */
  operators = 0;

  get full(): boolean {
    return this.chars >= MAX_OUTPUT_CHARS;
  }

  emit(text: string, x: number, y: number, size: number, endX: number): void {
    if (!text || this.full) return;
    if (this.current) {
      const tolerance = Math.max(1, Math.abs(size) * 0.3);
      if (this.breakRequested || Math.abs(y - this.lastY) > tolerance) this.newLine();
      else {
        const gap = x - this.lastEndX;
        const em = Math.max(1, Math.abs(size));
        if ((this.spaceRequested || gap > em * 0.2 || gap < -em) && !/\s$/.test(this.current) && !/^\s/.test(text)) this.current += ' ';
      }
    }
    this.breakRequested = false;
    this.spaceRequested = false;
    this.current += text;
    this.chars += text.length;
    this.lastY = y;
    this.lastEndX = endX;
  }

  newLine(): void {
    this.lines.push(this.current);
    this.current = '';
  }

  endPage(): void {
    if (this.current) this.newLine();
    this.lines.push('');
    this.breakRequested = false;
    this.spaceRequested = false;
  }

  toString(): string {
    if (this.current) this.newLine();
    return this.lines.join('\n');
  }
}

class PageInterpreter {
  private state: GraphicsState = {
    ctm: IDENTITY,
    font: FALLBACK_FONT,
    fontSize: 12,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    leading: 0,
  };
  private stack: GraphicsState[] = [];
  private tm: Matrix = IDENTITY;
  private tlm: Matrix = IDENTITY;
  private readonly activeForms = new Set<PdfStream>();

  constructor(
    private readonly doc: PdfDocument,
    private readonly fonts: Map<PdfDict, FontInfo>,
    private readonly out: TextWriter,
  ) {}

  run(content: Buffer, resources: PdfDict | undefined, depth = 0): void {
    const lx = new Lexer(content);
    const operands: PdfValue[] = [];
    for (let tok = lx.next(); tok; tok = lx.next()) {
      if (tok.t === 'kw' && tok.v !== 'true' && tok.v !== 'false' && tok.v !== 'null') {
        if (++this.out.operators > MAX_OPERATORS || this.out.full) return;
        if (tok.v === 'BI') this.skipInlineImage(lx);
        else this.operator(tok.v, operands, resources, depth);
        operands.length = 0;
        continue;
      }
      const v = valueFromToken(lx, tok, false, 0);
      if (operands.length < 64) operands.push(v);
    }
  }

  private operator(op: string, args: PdfValue[], resources: PdfDict | undefined, depth: number): void {
    const s = this.state;
    const num = (i: number): number => numberOf(args[args.length - 1 - i], 0); // i = 0 es el último operando
    switch (op) {
      case 'q':
        if (this.stack.length < 256) this.stack.push({ ...s });
        break;
      case 'Q':
        this.state = this.stack.pop() ?? s;
        break;
      case 'cm': {
        const m = toMatrix(args);
        if (m) s.ctm = multiply(m, s.ctm);
        break;
      }
      case 'BT':
        this.tm = IDENTITY;
        this.tlm = IDENTITY;
        break;
      case 'Tf':
        s.font = this.font(resources, nameOf(args[args.length - 2]));
        s.fontSize = num(0);
        break;
      case 'Tc':
        s.charSpacing = num(0);
        break;
      case 'Tw':
        s.wordSpacing = num(0);
        break;
      case 'Tz':
        s.hScale = num(0) / 100;
        break;
      case 'TL':
        s.leading = num(0);
        break;
      case 'Td':
        this.moveLine(num(1), num(0));
        break;
      case 'TD':
        s.leading = -num(0);
        this.moveLine(num(1), num(0));
        break;
      case 'Tm': {
        const m = toMatrix(args);
        if (m) this.tm = this.tlm = m;
        break;
      }
      case 'T*':
        this.nextLine();
        break;
      case 'Tj':
        this.show(args[args.length - 1]);
        break;
      case "'":
        this.nextLine();
        this.show(args[args.length - 1]);
        break;
      case '"':
        s.wordSpacing = num(2);
        s.charSpacing = num(1);
        this.nextLine();
        this.show(args[args.length - 1]);
        break;
      case 'TJ': {
        const arr = args[args.length - 1];
        if (!Array.isArray(arr)) break;
        for (const item of arr) {
          if (item instanceof PdfString) this.show(item);
          else if (typeof item === 'number') {
            this.advance((-item / 1000) * s.fontSize * s.hScale);
            if (item < -200) this.out.spaceRequested = true;
          }
        }
        break;
      }
      case 'Do':
        this.drawForm(nameOf(args[args.length - 1]), resources, depth);
        break;
    }
  }

  private moveLine(tx: number, ty: number): void {
    const l = this.tlm;
    this.tlm = [l[0], l[1], l[2], l[3], l[4] + tx * l[0] + ty * l[2], l[5] + tx * l[1] + ty * l[3]];
    this.tm = this.tlm;
  }

  private nextLine(): void {
    this.moveLine(0, -this.state.leading);
    this.out.breakRequested = true;
  }

  private advance(tx: number): void {
    const m = this.tm;
    this.tm = [m[0], m[1], m[2], m[3], m[4] + tx * m[0], m[5] + tx * m[1]];
  }

  private show(value: PdfValue | undefined): void {
    if (!(value instanceof PdfString)) return;
    const s = this.state;
    const glyphs = s.font.decode(value.bytes);
    const start = multiply(this.tm, s.ctm);
    let tx = 0;
    for (const g of glyphs) tx += ((g.width / 1000) * s.fontSize + s.charSpacing + (g.isSpace ? s.wordSpacing : 0)) * s.hScale;
    this.advance(tx);
    const end = multiply(this.tm, s.ctm);
    const size = s.fontSize * Math.hypot(start[2], start[3]);
    this.out.emit(glyphs.map((g) => g.text).join(''), start[4], start[5], size, end[4]);
  }

  private font(resources: PdfDict | undefined, name: string | undefined): FontInfo {
    const fontDict = name ? this.doc.dict(this.doc.dict(resources?.get('Font'))?.get(name)) : undefined;
    if (!fontDict) return FALLBACK_FONT;
    let info = this.fonts.get(fontDict);
    if (!info) {
      info = buildFont(this.doc, fontDict);
      this.fonts.set(fontDict, info);
    }
    return info;
  }

  private drawForm(name: string | undefined, resources: PdfDict | undefined, depth: number): void {
    if (!name || depth >= MAX_FORM_DEPTH) return;
    const xobject = this.doc.resolve(this.doc.dict(resources?.get('XObject'))?.get(name));
    if (!(xobject instanceof PdfStream) || nameOf(xobject.dict.get('Subtype')) !== 'Form' || this.activeForms.has(xobject)) return;
    const data = this.doc.decode(xobject);
    if (!data) return;
    const saved = { ...this.state };
    const savedStack = this.stack;
    const [savedTm, savedTlm] = [this.tm, this.tlm];
    const matrix = toMatrix(this.doc.array(xobject.dict.get('Matrix'))?.map((v) => this.doc.resolve(v) ?? 0) ?? []);
    if (matrix) this.state.ctm = multiply(matrix, this.state.ctm);
    this.stack = [];
    this.activeForms.add(xobject);
    try {
      this.run(data, this.doc.dict(xobject.dict.get('Resources')) ?? resources, depth + 1);
    } finally {
      this.activeForms.delete(xobject);
      this.state = saved;
      this.stack = savedStack;
      [this.tm, this.tlm] = [savedTm, savedTlm];
    }
  }

  /** Imagen en línea: BI <dict> ID <bytes binarios> EI. Los bytes no se tokenizan. */
  private skipInlineImage(lx: Lexer): void {
    for (let t = lx.next(); t && !(t.t === 'kw' && t.v === 'ID'); t = lx.next());
    const b = lx.buf;
    let i = lx.pos + 1;
    for (; i + 1 < lx.end; i++) {
      if (b[i] === 0x45 && b[i + 1] === 0x49 && isWhite(b[i - 1]) && (i + 2 >= lx.end || isWhite(b[i + 2]))) break;
    }
    lx.pos = Math.min(i + 2, lx.end);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------------------------------------------

interface PageRef {
  page: PdfDict;
  resources: PdfDict | undefined;
}

function collectPages(doc: PdfDocument): PageRef[] {
  const pages: PageRef[] = [];
  const visited = new Set<PdfDict>();
  const walk = (node: PdfValue | undefined, inherited: PdfDict | undefined, depth: number): void => {
    const d = doc.dict(node);
    if (!d || visited.has(d) || depth > MAX_NESTING || pages.length >= MAX_PAGES) return;
    visited.add(d);
    const resources = doc.dict(d.get('Resources')) ?? inherited;
    const kids = doc.array(d.get('Kids'));
    if (nameOf(d.get('Type')) !== 'Page' && kids) kids.forEach((k) => walk(k, resources, depth + 1));
    else pages.push({ page: d, resources });
  };

  const catalogs = [...doc.objects.values()].filter((v): v is PdfDict => isDict(v) && nameOf(v.get('Type')) === 'Catalog');
  for (const catalog of catalogs.reverse()) {
    walk(catalog.get('Pages'), undefined, 0);
    if (pages.length) return pages;
  }

  // Sin catálogo utilizable: las páginas en el orden de los objetos, heredando recursos por /Parent.
  const nums = [...doc.objects.keys()].sort((a, b) => a - b);
  for (const n of nums) {
    const d = doc.objects.get(n);
    if (!isDict(d) || nameOf(d.get('Type')) !== 'Page' || pages.length >= MAX_PAGES) continue;
    let resources = doc.dict(d.get('Resources'));
    for (let p = doc.dict(d.get('Parent')), i = 0; !resources && p && i < MAX_NESTING; p = doc.dict(p.get('Parent')), i++) {
      resources = doc.dict(p.get('Resources'));
    }
    pages.push({ page: d, resources });
  }
  return pages;
}

function pageContent(doc: PdfDocument, page: PdfDict): Buffer {
  const contents = doc.resolve(page.get('Contents'));
  const parts = Array.isArray(contents) ? contents.map((c) => doc.resolve(c)) : [contents];
  const buffers: Buffer[] = [];
  for (const part of parts) {
    if (!(part instanceof PdfStream)) continue;
    const data = doc.decode(part);
    if (data) buffers.push(data, Buffer.from('\n'));
  }
  return Buffer.concat(buffers);
}

function clean(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f�]/g, '')
      .replace(/[ \t ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/** Texto de un PDF, una línea por renglón. Nunca lanza: si el archivo está roto, cifrado o es solo imagen, devuelve ''. */
export function extractPdfText(buf: Buffer): string {
  try {
    const doc = new PdfDocument(buf);
    const fonts = new Map<PdfDict, FontInfo>();
    const out = new TextWriter();
    for (const { page, resources } of collectPages(doc)) {
      try {
        new PageInterpreter(doc, fonts, out).run(pageContent(doc, page), resources);
      } catch {
        // página rota: se sigue con la próxima
      }
      out.endPage();
      if (out.full) break;
    }
    return clean(out.toString());
  } catch {
    return '';
  }
}
