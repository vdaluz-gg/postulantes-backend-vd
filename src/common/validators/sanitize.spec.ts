import { sanitizeText } from './sanitize';

describe('sanitizeText (una línea)', () => {
  it('deja intacto el texto normal, con tildes y ñ', () => {
    expect(sanitizeText('Año Ñandú: operario/a de producción')).toBe('Año Ñandú: operario/a de producción');
  });

  it('recorta y junta espacios repetidos', () => {
    expect(sanitizeText('  hola   mundo ')).toBe('hola mundo');
  });

  it('saca las etiquetas HTML y deja el texto', () => {
    expect(sanitizeText('<b>Hola</b> <script>alert(1)</script>')).toBe('Hola alert(1)');
  });

  it('saca una etiqueta que quedó sin cerrar', () => {
    expect(sanitizeText('Operario <img src=x onerror=alert(1)')).toBe('Operario');
  });

  it('no se deja engañar por etiquetas anidadas que se rearman al sacar la interna', () => {
    expect(sanitizeText('<<script>script>alert(1)')).toBe('alert(1)');
    // Puede quedar algún ">" suelto, pero ningún comienzo de etiqueta ("<" seguido de letra, "/" o "!").
    expect(sanitizeText('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toMatch(/<[a-zA-Z/!]/);
  });

  it('saca comentarios HTML', () => {
    expect(sanitizeText('uno<!-- dos -->tres')).toBe('unotres');
  });

  it('no toca los signos < y > comunes en un texto', () => {
    expect(sanitizeText('Sueldo > 500 y turnos < 8 hs')).toBe('Sueldo > 500 y turnos < 8 hs');
  });

  it('saca caracteres de control, de ancho cero y de cambio de dirección del texto', () => {
    // NUL, ancho cero, anulación de dirección, aislamiento de dirección y marca de orden de bytes.
    const hidden = [0x0000, 0x200b, 0x202e, 0x2066, 0xfeff].map((c) => String.fromCharCode(c));
    expect(sanitizeText(`a${hidden[0]}b${hidden[1]}c${hidden[2]}d${hidden[3]}e${hidden[4]}f`)).toBe('abcdef');
  });

  it('los separadores de línea y de párrafo de Unicode también se vuelven espacios', () => {
    expect(sanitizeText(`uno${String.fromCharCode(0x2028)}dos${String.fromCharCode(0x2029)}tres`)).toBe('uno dos tres');
  });

  it('los saltos de línea se vuelven espacios', () => {
    expect(sanitizeText('línea 1\r\nlínea 2\tfin')).toBe('línea 1 línea 2 fin');
  });
});

describe('sanitizeText (varias líneas)', () => {
  it('conserva los saltos de línea, normaliza \\r\\n y limita las líneas vacías seguidas', () => {
    expect(sanitizeText('a\r\nb\n\n\n\nc\td', { multiline: true })).toBe('a\nb\n\nc d');
  });

  it('también saca etiquetas HTML', () => {
    expect(sanitizeText('Tareas:\n<script>x()</script>\n- Armado', { multiline: true })).toBe('Tareas:\nx()\n- Armado');
  });
});

describe('sanitizeText con otros tipos', () => {
  it('devuelve tal cual lo que no es texto (la validación lo rechaza después)', () => {
    expect(sanitizeText(undefined as unknown as string)).toBeUndefined();
    expect(sanitizeText(42 as unknown as string)).toBe(42);
    expect(sanitizeText(null as unknown as string)).toBeNull();
  });
});
