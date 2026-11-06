import { buildWordDoc } from '../../../../test/utils/cfb-builder';
import { extractDocText } from './doc-text';

const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const binary = (n: number, seed: number): Buffer => Buffer.from(Array.from({ length: n }, (_, i) => ((i + seed) * 37) % 32));
const utf16 = (s: string): Buffer => Buffer.from(s, 'utf16le');

describe('extractDocText: estructura de Word (tabla de piezas)', () => {
  it('lee el cuerpo y pone los encabezados adelante, con piezas en Windows-1252 y en UTF-16', () => {
    const doc = buildWordDoc(
      [
        { text: 'Curriculum Vitae\rDNI:\t40.123.456\r', compressed: true },
        { text: 'Localidad: Villa Maipú\r', compressed: false },
      ],
      [{ text: 'Lucía Fernández\rCel. 11 4444-0101\r', compressed: false }],
    );
    expect(extractDocText(doc)).toBe('Lucía Fernández\nCel. 11 4444-0101\nCurriculum Vitae\nDNI: 40.123.456\nLocalidad: Villa Maipú');
  });

  it('se queda con el resultado de los campos (no con su código) y convierte los separadores de Word', () => {
    const field = '\u0013 HYPERLINK "mailto:lucia@ejemplo.com" \u0014lucia@ejemplo.com\u0015';
    const doc = buildWordDoc([{ text: `Mail: ${field}\u000bTel.\u0007Cel.\r`, compressed: false }]);
    expect(extractDocText(doc)).toBe('Mail: lucia@ejemplo.com\nTel. Cel.');
  });

  it('un documento cifrado no tiene texto legible', () => {
    expect(extractDocText(buildWordDoc([{ text: 'secreto\r', compressed: true }], [], { encrypted: true }))).toBe('');
  });
});

describe('extractDocText: lectura heurística (si no hay estructura de Word)', () => {
  it('lee el texto guardado en UTF-16LE y descarta los nombres internos de Word', () => {
    const doc = Buffer.concat([
      OLE_SIGNATURE,
      binary(504, 1),
      utf16('Lucía Fernández\rDNI 40.123.456\rCelular: 11 4444-0101\r'),
      binary(64, 2),
      utf16('Root Entry'),
      binary(16, 3),
      utf16('Times New Roman'),
      binary(16, 4),
      utf16('WordDocument'),
    ]);
    expect(extractDocText(doc)).toBe('Lucía Fernández\nDNI 40.123.456\nCelular: 11 4444-0101');
  });

  it('lee el texto guardado en Windows-1252 (acentos incluidos)', () => {
    const doc = Buffer.concat([
      OLE_SIGNATURE,
      binary(504, 5),
      Buffer.from('Lucía Fernández\rLocalidad: Monte Grande\x0bArgentina\r', 'latin1'),
      binary(64, 6),
      utf16('Root Entry'),
    ]);
    expect(extractDocText(doc)).toBe('Lucía Fernández\nLocalidad: Monte Grande\nArgentina');
  });

  it('descarta tiras cortas, sin letras o que no parecen texto', () => {
    const doc = Buffer.concat([OLE_SIGNATURE, Buffer.from('ab\x00123456\x00xyz\x00Hola mundo\x00ÿÿÿÿÿÿ\x00theme/theme1.xml\x00', 'latin1')]);
    expect(extractDocText(doc)).toBe('Hola mundo');
  });

  it.each([
    ['vacío', Buffer.alloc(0)],
    ['solo binario', Buffer.concat([OLE_SIGNATURE, binary(2048, 9)])],
  ])('nunca lanza: %s → vacío', (_, buf) => {
    expect(extractDocText(buf)).toBe('');
  });
});
