import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
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
});
