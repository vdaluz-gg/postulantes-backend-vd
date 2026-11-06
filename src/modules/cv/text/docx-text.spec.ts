import { buildDocx, buildZip, wordParagraphs } from '../../../../test/utils/zip-builder';
import { extractDocxText, wordXmlToText } from './docx-text';

describe('wordXmlToText', () => {
  it('párrafos, tabuladores, saltos y entidades', () => {
    const xml =
      '<w:p><w:r><w:t>Nombre:</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Luc&#237;a Fern&#xE1;ndez</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>A &amp; B &lt;ok&gt; &quot;s&quot; &apos;n&apos;</w:t><w:br/><w:t>otra l&iacute;nea</w:t></w:r></w:p>';
    expect(wordXmlToText(xml)).toBe('Nombre:\tLucía Fernández\nA & B <ok> "s" \'n\'\notra l&iacute;nea\n');
  });

  it('ignora las definiciones de tabulaciones, los códigos de campo y el texto borrado', () => {
    const xml =
      '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="2835"/></w:tabs></w:pPr>' +
      '<w:r><w:instrText>HYPERLINK "mailto:x@y.com"</w:instrText></w:r><w:r><w:delText>borrado</w:delText></w:r>' +
      '<w:r><w:t>lucia@ejemplo.com</w:t></w:r></w:p>';
    expect(wordXmlToText(xml)).toBe('lucia@ejemplo.com\n');
  });

  it('no se vuelve lento con bloques sin cerrar', () => {
    const start = Date.now();
    expect(wordXmlToText('<mc:Fallback>'.repeat(300_000) + '<w:tabs>'.repeat(300_000))).toBe('');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('no duplica los cuadros de texto (mc:Fallback)', () => {
    const box = '<w:txbxContent><w:p><w:r><w:t>Monte Grande</w:t></w:r></w:p></w:txbxContent>';
    const xml = `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps">${box}</mc:Choice><mc:Fallback>${box}</mc:Fallback></mc:AlternateContent></w:r></w:p>`;
    expect(wordXmlToText(xml)).toBe('Monte Grande\n\n');
  });
});

describe('extractDocxText', () => {
  it('lee primero el encabezado (contacto) y después el cuerpo', () => {
    const docx = buildDocx(wordParagraphs(['Perfil', 'Atención al cliente']), [wordParagraphs(['Lucía Fernández', 'lucia@ejemplo.com'])]);
    expect(extractDocxText(docx)).toBe('Lucía Fernández\nlucia@ejemplo.com\nPerfil\nAtención al cliente');
  });

  it('acepta entradas sin comprimir (stored)', () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const docx = buildZip([{ name: 'word/document.xml', data: `<w:document ${W}><w:body>${wordParagraphs(['Hola', 'Chau'])}</w:body></w:document>`, store: true }]);
    expect(extractDocxText(docx)).toBe('Hola\nChau');
  });

  it('ignora una parte que pasa el tamaño máximo sin romperse', () => {
    const huge = `<w:document><w:body>${wordParagraphs(['grande'])}${' '.repeat(11 * 1024 * 1024)}</w:body></w:document>`;
    const docx = buildZip([
      { name: 'word/header1.xml', data: `<w:hdr>${wordParagraphs(['Lucía Fernández'])}</w:hdr>` },
      { name: 'word/document.xml', data: huge },
    ]);
    expect(extractDocxText(docx)).toBe('Lucía Fernández');
  });

  it('una parte dañada no impide leer las demás', () => {
    const good = buildDocx(wordParagraphs(['cuerpo']), [wordParagraphs(['encabezado'])]);
    const broken = Buffer.from(good);
    // Rompe los datos comprimidos del primer archivo después de [Content_Types].xml (document.xml).
    const at = broken.indexOf('word/document.xml') + 'word/document.xml'.length;
    broken.fill(0xff, at, at + 8);
    expect(() => extractDocxText(broken)).not.toThrow();
  });

  it.each([
    ['vacío', Buffer.alloc(0)],
    ['basura', Buffer.from('PK\u0003\u0004 esto no es un zip word/document.xml')],
    ['zip sin word/document.xml', buildZip([{ name: 'word/header1.xml', data: '<w:t>x</w:t>' }])],
    ['zip truncado', buildDocx(wordParagraphs(['Hola'])).subarray(0, 60)],
  ])('nunca lanza: %s → vacío', (_, buf) => {
    expect(extractDocxText(buf)).toBe('');
  });
});
