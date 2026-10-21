import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../types';

/** Assigns a request id and logs one privacy-conscious line per request (no query string, headers or bodies). */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: AuthedRequest, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(incoming)
        ? incoming
        : randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      this.logger.log(
        JSON.stringify({
          requestId: id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Math.round(ms),
          userId: req.user?.id,
        }),
      );
    });
    next();
  }
}
