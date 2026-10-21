import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logging/json-logger';
import { loadEnvFile } from './database/load-env';
import { loadConfig } from './config/configuration';
import { setupApp } from './setup-app';

async function bootstrap() {
  loadEnvFile();
  const cfg = loadConfig(); // fail fast on invalid configuration
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new JsonLogger(cfg.logLevel),
    bodyParser: false,
  });
  setupApp(app);
  await app.listen(cfg.port);
  new JsonLogger(cfg.logLevel).log(
    `LMS API listening on :${cfg.port} (docs: ${cfg.swaggerEnabled ? '/api/v1/docs' : 'disabled'})`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
