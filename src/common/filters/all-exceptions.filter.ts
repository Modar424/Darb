import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import type { AuthedRequest } from '../types';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  requestId?: string;
  path: string;
  timestamp: string;
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

/** Single place that shapes every error response; never leaks stack traces, SQL or internals. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<AuthedRequest>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: unknown };
        if (Array.isArray(b.message)) {
          message = 'Validation failed';
          details = b.message;
        } else if (typeof b.message === 'string') {
          message = b.message;
        }
      }
    } else if (exception instanceof QueryFailedError) {
      const errno = (exception as unknown as { driverError?: { errno?: number } }).driverError
        ?.errno;
      if (errno === 1062) {
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
      } else if (errno === 1451 || errno === 1452) {
        status = HttpStatus.CONFLICT;
        message = 'Operation conflicts with related data';
      }
    } else if (this.isHttpError(exception)) {
      // body-parser / http-errors (payload too large, malformed JSON, ...)
      status = exception.status;
      message =
        status === 413
          ? 'Payload too large'
          : status === 415
            ? 'Unsupported media type'
            : 'Malformed request';
    }

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `${req.method} ${req.path} -> ${status} requestId=${req.requestId ?? '-'}`,
        err.stack,
      );
      message = 'Internal server error';
      details = undefined;
    }

    const payload: ErrorBody = {
      statusCode: status,
      error: STATUS_TEXT[status] ?? 'Error',
      message,
      ...(details !== undefined ? { details } : {}),
      requestId: req.requestId,
      path: req.path,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(payload);
  }

  private isHttpError(e: unknown): e is { status: number } {
    if (!e || typeof e !== 'object') return false;
    const s = (e as { status?: unknown }).status;
    const t = (e as { type?: unknown }).type;
    return typeof s === 'number' && s >= 400 && s < 500 && typeof t === 'string';
  }
}
