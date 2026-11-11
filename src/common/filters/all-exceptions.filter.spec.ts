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

  describe('errores del cliente que no son excepciones de Nest (por ejemplo, los del lector de JSON)', () => {
    const clientError = (status: number, message: string) => Object.assign(new Error(message), { status, statusCode: status, expose: true });

    it('un cuerpo demasiado grande es un 413 con un mensaje genérico, no un 500', () => {
      const { host, status, json } = hostWith('/api/v1/candidates/validate');
      filter.catch(clientError(413, 'request entity too large (limit 102400)'), host);
      expect(status).toHaveBeenCalledWith(413);
      expect(json.mock.calls[0][0]).toEqual(
        expect.objectContaining({ statusCode: 413, error: 'Payload Too Large', message: 'El pedido es demasiado grande' }),
      );
    });

    it('un JSON mal formado es un 400 y no se repite el detalle del lector', () => {
      const { host, status, json } = hostWith();
      filter.catch(clientError(400, 'Unexpected token } in JSON at position 8'), host);
      expect(status).toHaveBeenCalledWith(400);
      expect(json.mock.calls[0][0]).toEqual(expect.objectContaining({ statusCode: 400, message: 'El pedido no es válido' }));
    });

    it('no se registra como error del servidor: no es una falla nuestra', () => {
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch(clientError(413, 'request entity too large'), hostWith().host);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('un error con "status" que no se puede mostrar (sin expose) sigue siendo un 500 genérico', () => {
      const { host, status } = hostWith();
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      filter.catch(Object.assign(new Error('detalle interno'), { status: 400 }), host);
      expect(status).toHaveBeenCalledWith(500);
    });
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
