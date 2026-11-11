import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { redact } from '../utils/redact';

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

const REASON: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * Único formato de error de la API. Las excepciones HTTP conservan su mensaje; cualquier otro error se
 * registra en el servidor y al cliente solo le llega un mensaje genérico (sin stack ni detalle de la base).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') message = payload;
      else if (payload && typeof payload === 'object' && 'message' in payload) {
        message = (payload as { message: string | string[] }).message;
      } else message = exception.message;
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      // La ruta va sin query (puede traer un DNI o un mail de una búsqueda) y todo pasa por redact: el mensaje de un
      // error de la base o de un proveedor puede incluir datos personales o secretos.
      const route = (req.url ?? '').split('?')[0];
      this.logger.error(`${redact(route)}: ${redact(err.message)}`, err.stack ? redact(err.stack) : undefined);
    }

    const body: ErrorBody = {
      statusCode: status,
      error: REASON[status] ?? 'Error',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }
}
