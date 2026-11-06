/** Caracteres de Windows-1252 en 0x80–0x9F (en latin1 son controles). El resto coincide con latin1. */
const HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

/** Byte en Windows-1252 (WinAnsi) → carácter. Devuelve '' para los bytes sin carácter asignado. */
export function cp1252Char(byte: number): string {
  if (byte >= 0x80 && byte <= 0x9f) return HIGH[byte] ?? '';
  return String.fromCharCode(byte);
}
