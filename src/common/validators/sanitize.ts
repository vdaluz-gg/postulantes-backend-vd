export interface SanitizeOptions {
  /** Conserva los saltos de línea (descripciones y notas largas). Por defecto el texto queda en una línea. */
  readonly multiline?: boolean;
}

/** Etiquetas y comentarios HTML, incluida una etiqueta que quedó sin cerrar hasta el final del texto. */
const HTML_TAG = /<\/?[a-zA-Z!][^>]*(?:>|$)|<!--[\s\S]*?(?:-->|$)/g;

/** Rangos Unicode (inclusive) que se eliminan: control (menos \n), ancho cero y cambio de dirección del texto. */
const INVISIBLE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x0008],
  [0x000b, 0x000c],
  [0x000e, 0x001f],
  [0x007f, 0x007f],
  [0x200b, 0x200f], // ancho cero y marcas de dirección
  [0x202a, 0x202e], // incrustaciones y anulaciones de dirección
  [0x2060, 0x2060],
  [0x2066, 0x2069], // aislamientos de dirección
  [0xfeff, 0xfeff], // marca de orden de bytes
];
const char = (code: number): string => String.fromCharCode(code);
const INVISIBLE = new RegExp(`[${INVISIBLE_RANGES.map(([from, to]) => `${char(from)}-${char(to)}`).join('')}]`, 'g');
/** Fin de línea de cualquier sistema, incluidos los separadores de línea y de párrafo de Unicode. */
const LINE_BREAK = new RegExp(`\\r\\n?|[${char(0x2028)}${char(0x2029)}]`, 'g');

/**
 * Limpia un texto libre antes de guardarlo: saca etiquetas HTML, caracteres de control y caracteres invisibles que
 * se usan para disfrazar texto (cambio de dirección, ancho cero). Es una defensa más contra XSS almacenado: la
 * principal es que quien muestre el texto lo escape (Angular lo hace por defecto). Lo que no es texto pasa tal
 * cual, para que la validación lo rechace con su propio mensaje.
 */
export function sanitizeText<T>(value: T, options: SanitizeOptions = {}): T {
  if (typeof value !== 'string') return value;
  let text: string = value;
  // Se repite hasta que no cambie: sacar una etiqueta interna puede rearmar una externa ("<<b>script>").
  for (let previous = ''; previous !== text; ) {
    previous = text;
    text = text.replace(HTML_TAG, '');
  }
  text = text.replace(LINE_BREAK, '\n').replace(INVISIBLE, '');
  if (options.multiline) {
    text = text
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/\s+/g, ' ');
  }
  return text.trim() as unknown as T;
}
