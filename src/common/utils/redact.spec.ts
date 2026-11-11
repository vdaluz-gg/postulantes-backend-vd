import { errorForLog, redact } from './redact';

describe('redact', () => {
  it.each([
    ['DNI con puntos', 'Key (dni)=(38.412.907) already exists', '[dni]'],
    ['DNI sin puntos', 'duplicate key value: 38412907', '[dni]'],
    ['CUIL con guiones', 'cuil 27-38412907-8 inválido', '[cuil]'],
    ['CUIL sin guiones', 'cuil 27384129078 inválido', '[cuil]'],
    ['mail', 'no se pudo avisar a martina@ejemplo.com', '[email]'],
    ['WhatsApp internacional', 'falló el envío a +5491155550142', '[tel]'],
    ['WhatsApp con espacios', 'falló el envío a +54 9 11 5555-0142', '[tel]'],
    ['código de seguimiento', 'GET /applications/track/GG-7K2M9Q', '[codigo]'],
    ['token Bearer', 'Authorization: Bearer abc.def-123_xyz', '[redacted]'],
    ['JWT suelto', 'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma_123', '[token]'],
  ])('tapa %s', (_name, input, marker) => {
    expect(redact(input)).toContain(marker);
  });

  it.each([
    ['secret=abc123 host=10.0.0.9', 'abc123'],
    ['password: Clave-Segura-2026', 'Clave-Segura-2026'],
    ['client_secret=s3cr3t&client_id=x', 's3cr3t'],
    ['api_key = AKIA123456', 'AKIA123456'],
  ])('tapa el valor de una clave en "%s"', (input, secret) => {
    expect(redact(input)).not.toContain(secret);
  });

  it('conserva lo que sirve para depurar: tipo de error, nombre de tabla, ids técnicos y direcciones IP', () => {
    const text = 'QueryFailedError en "candidates" (uuid 8d6c5f6e-0000-4000-8000-000000000000) desde 10.0.0.5: timeout';
    expect(redact(text)).toBe(text);
  });

  it('no confunde números largos que no son un DNI, como una duración o un puerto', () => {
    expect(redact('timeout de 30000 ms en el puerto 5432, 12 reintentos')).toBe('timeout de 30000 ms en el puerto 5432, 12 reintentos');
  });

  it('redacta todas las apariciones', () => {
    expect(redact('a@x.com y b@y.com')).toBe('[email] y [email]');
  });
});

describe('errorForLog', () => {
  it('toma el mensaje de un Error y lo redacta', () => {
    expect(errorForLog(new Error('falló para 38412907'))).toBe('falló para [dni]');
  });
  it('acepta cualquier otro valor lanzado', () => {
    expect(errorForLog('mail martina@ejemplo.com')).toBe('mail [email]');
    expect(errorForLog(undefined)).toBe('undefined');
  });
});
