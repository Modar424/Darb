import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { AppConfig, loadConfig } from '../config/configuration';
import { ALL_ENTITIES } from './entities';

export function dataSourceOptionsFromConfig(cfg: AppConfig): DataSourceOptions {
  return {
    type: 'mysql',
    host: cfg.db.host,
    port: cfg.db.port,
    username: cfg.db.user,
    password: cfg.db.password,
    database: cfg.db.name,
    charset: 'utf8mb4',
    timezone: 'Z',
    ssl: cfg.db.ssl ? { rejectUnauthorized: true } : undefined,
    entities: ALL_ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    // Schema changes happen ONLY through migrations. Never enable synchronize.
    synchronize: false,
    migrationsRun: false,
    logging: cfg.env === 'test' ? false : ['error'],
    connectTimeout: 10000,
    extra: { connectionLimit: 10, waitForConnections: true, queueLimit: 100 },
  };
}

export const buildDataSourceOptions = (env: Record<string, string | undefined> = process.env) =>
  dataSourceOptionsFromConfig(loadConfig(env));
