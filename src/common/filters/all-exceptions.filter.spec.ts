import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hostWith(url = '/api/v1/x') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('devuelve el formato único para una excepción HTTP', () => {
    const { host, status, json } = hostWith('/api/v1/job-offers/NOPE');
    filter.catch(new NotFoundException('Oferta no encontrada'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'Not Found',
        message: 'Oferta no encontrada',
        path: '/api/v1/job-offers/NOPE',
        timestamp: expect.any(String),
      }),
    );
  });

  it('conserva la lista de mensajes de validación', () => {
    const { host, json } = hostWith();
    filter.catch(new BadRequestException({ message: ['dni inválido', 'email inválido'], error: 'Bad Request' }), host);
    expect(json.mock.calls[0][0].message).toEqual(['dni inválido', 'email inválido']);
  });

  it('no filtra el detalle de errores inesperados', () => {
    const { host, status, json } = hostWith();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    filter.catch(new Error('password authentication failed for user "gg" at 10.0.0.5'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  describe('lo que queda en el log del servidor', () => {
    const logged = (): string => {
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { host } = hostWith('/api/v1/backoffice/candidates?q=38412907&email=martina@ejemplo.com');
      const err = new Error('Key (dni)=(38412907) already exists para martina@ejemplo.com');
      filter.catch(err, host);
      const text = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      spy.mockRestore();
      return text;
    };

    it('no lleva DNI ni mail, ni en el mensaje, ni en el stack, ni en la URL', () => {
      const text = logged();
      expect(text).not.toMatch(/38412907|martina@ejemplo\.com/);
      expect(text).toContain('[dni]');
    });

    it('registra la ruta sin la query (que puede traer una búsqueda por DNI o mail)', () => {
      expect(logged()).toContain('/api/v1/backoffice/candidates:');
      expect(logged()).not.toContain('?q=');
    });
  });
});
