import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { APP_CONFIG, AppConfig } from './config/configuration';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the integration tests so tests exercise the real HTTP hardening. */
export function setupApp(app: NestExpressApplication): AppConfig {
  const cfg = app.get<AppConfig>(APP_CONFIG);
  const http = app.getHttpAdapter().getInstance() as import('express').Express;

  http.disable('x-powered-by');
  http.set('trust proxy', cfg.trustProxy ? 1 : false);

  const apiHelmet = helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: cfg.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  const docsHelmet = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: null,
      },
    },
    hsts: false,
  });
  http.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    return (req.path.startsWith(`/${API_PREFIX}/docs`) ? docsHelmet : apiHelmet)(req, res, next);
  });

  app.use(cookieParser());
  app.useBodyParser('json', { limit: cfg.bodyLimit });
  app.useBodyParser('urlencoded', { limit: cfg.bodyLimit, extended: false });

  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || cfg.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  if (cfg.swaggerEnabled) {
    const doc = new DocumentBuilder()
      .setTitle('LMS API')
      .setDescription(
        'Cookie session auth. Send the CSRF token (from login or GET /auth/me) as `X-CSRF-Token` on state-changing requests.',
      )
      .setVersion('1.0')
      .addCookieAuth(cfg.cookie.name)
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-CSRF-Token' }, 'csrf')
      .build();
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, SwaggerModule.createDocument(app, doc));
  }
  return cfg;
}
