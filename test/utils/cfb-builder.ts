const SECTOR = 512;
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const FATSECT = 0xfffffffd;
const NOSTREAM = 0xffffffff;

/**
 * Contenedor OLE (CFB v3) mínimo con los flujos dados. Cada flujo se rellena hasta 4096 bytes para que vaya en
 * sectores comunes (sin mini stream). Sector 0: FAT; sector 1: directorio; después, los flujos en orden.
 */
export function buildCfb(streams: Array<{ name: string; data: Buffer }>): Buffer {
  const padded = streams.map((s) => {
    const size = Math.max(4096, Math.ceil(s.data.length / SECTOR) * SECTOR);
    return { name: s.name, data: Buffer.concat([s.data, Buffer.alloc(size - s.data.length)]) };
  });
  const fat = new Array<number>(SECTOR / 4).fill(FREESECT);
  fat[0] = FATSECT;
  fat[1] = ENDOFCHAIN;
  let next = 2;
  const starts = padded.map((s) => {
    const start = next;
    const count = s.data.length / SECTOR;
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? ENDOFCHAIN : start + i + 1;
    next += count;
    return start;
  });
  if (next > fat.length) throw new Error('buildCfb: demasiados datos para una sola FAT');

  const header = Buffer.alloc(SECTOR);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0);
  header.writeUInt16LE(0x3e, 0x18);
  header.writeUInt16LE(3, 0x1a);
  header.writeUInt16LE(0xfffe, 0x1c);
  header.writeUInt16LE(9, 0x1e);
  header.writeUInt16LE(6, 0x20);
  header.writeUInt32LE(1, 0x2c);
  header.writeUInt32LE(1, 0x30);
  header.writeUInt32LE(4096, 0x38);
  header.writeUInt32LE(ENDOFCHAIN, 0x3c);
  header.writeUInt32LE(ENDOFCHAIN, 0x44);
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i === 0 ? 0 : FREESECT, 0x4c + i * 4);

  const entry = (name: string, type: number, start: number, size: number, child: number, right: number): Buffer => {
    const e = Buffer.alloc(128);
    e.write(name, 0, 'utf16le');
    e.writeUInt16LE((name.length + 1) * 2, 0x40);
    e[0x42] = type;
    e[0x43] = 1;
    e.writeUInt32LE(NOSTREAM, 0x44);
    e.writeUInt32LE(right, 0x48);
    e.writeUInt32LE(child, 0x4c);
    e.writeUInt32LE(start, 0x74);
    e.writeUInt32LE(size, 0x78);
    return e;
  };
  const dirEntries = [
    entry('Root Entry', 5, ENDOFCHAIN, 0, padded.length ? 1 : NOSTREAM, NOSTREAM),
    ...padded.map((s, i) => entry(s.name, 2, starts[i], s.data.length, NOSTREAM, i + 2 <= padded.length ? i + 2 : NOSTREAM)),
  ];
  if (dirEntries.length > SECTOR / 128) throw new Error('buildCfb: demasiados flujos');
  const directory = Buffer.concat([...dirEntries, Buffer.alloc(SECTOR - dirEntries.length * 128)]);
  const fatSector = Buffer.alloc(SECTOR);
  fat.forEach((v, i) => fatSector.writeUInt32LE(v >>> 0, i * 4));
  return Buffer.concat([header, fatSector, directory, ...padded.map((s) => s.data)]);
}

export interface WordPiece {
  text: string;
  /** true: Windows-1252 (1 byte por carácter); false: UTF-16LE. */
  compressed: boolean;
}

/**
 * DOC (Word 97) mínimo: FIB con ccpText/ccpHdd y CLX en `1Table`, con el texto en piezas. `main` es el cuerpo y
 * `headers` el texto de los encabezados (va después en las posiciones de carácter, como en Word).
 */
export function buildWordDoc(main: WordPiece[], headers: WordPiece[] = [], options: { encrypted?: boolean } = {}): Buffer {
  const TEXT_AT = 0x400;
  const pieces = [...main, ...headers];
  const bodies: Buffer[] = [];
  const fcs: number[] = [];
  let at = TEXT_AT;
  for (const p of pieces) {
    const bytes = p.compressed ? Buffer.from(p.text, 'latin1') : Buffer.from(p.text, 'utf16le');
    fcs.push(p.compressed ? ((at * 2) | 0x40000000) >>> 0 : at);
    bodies.push(bytes);
    at += bytes.length;
  }
  const fib = Buffer.alloc(TEXT_AT);
  fib.writeUInt16LE(0xa5ec, 0);
  fib.writeUInt16LE(0x00c1, 2);
  fib.writeUInt16LE(0x0200 | (options.encrypted ? 0x0100 : 0), 0x0a);
  const length = (list: WordPiece[]): number => list.reduce((n, p) => n + p.text.length, 0);
  fib.writeInt32LE(length(main), 0x4c);
  fib.writeInt32LE(0, 0x50);
  fib.writeInt32LE(length(headers), 0x54);

  const cps: number[] = [0];
  for (const p of pieces) cps.push(cps[cps.length - 1] + p.text.length);
  const plc = Buffer.alloc(cps.length * 4 + pieces.length * 8);
  cps.forEach((cp, i) => plc.writeUInt32LE(cp, i * 4));
  fcs.forEach((fc, i) => plc.writeUInt32LE(fc, cps.length * 4 + i * 8 + 2));
  const prc = Buffer.from([0x01, 0x02, 0x00, 0xaa, 0xbb]); // un Prc de relleno: el lector tiene que saltearlo
  const pcdt = Buffer.alloc(5);
  pcdt[0] = 0x02;
  pcdt.writeUInt32LE(plc.length, 1);
  const clx = Buffer.concat([prc, pcdt, plc]);
  fib.writeUInt32LE(0, 0x1a2);
  fib.writeUInt32LE(clx.length, 0x1a6);

  return buildCfb([
    { name: 'WordDocument', data: Buffer.concat([fib, ...bodies]) },
    { name: '1Table', data: clx },
  ]);
}
