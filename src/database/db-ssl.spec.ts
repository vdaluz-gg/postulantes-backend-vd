import { dbSslOptions } from './db-ssl';

const CA = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';

describe('dbSslOptions', () => {
  it('apagado (local): sin TLS, igual que hasta ahora', () => {
    expect(dbSslOptions({ DB_SSL: false, DB_SSL_CA: '' })).toBe(false);
  });

  it('encendido: TLS verificando el certificado del servidor (nunca rejectUnauthorized: false)', () => {
    expect(dbSslOptions({ DB_SSL: true, DB_SSL_CA: '' })).toEqual({ rejectUnauthorized: true });
  });

  it('con un certificado propio (CA) lo usa para verificar; acepta los saltos de línea escritos como \\n', () => {
    expect(dbSslOptions({ DB_SSL: true, DB_SSL_CA: CA.replace(/\n/g, '\\n') })).toEqual({ rejectUnauthorized: true, ca: CA });
  });

  it('la CA sola, sin DB_SSL, se ignora', () => {
    expect(dbSslOptions({ DB_SSL: false, DB_SSL_CA: CA })).toBe(false);
  });
});
