import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnvFile } from './load-env';
import { buildDataSourceOptions } from './options';

loadEnvFile();

// Default export used by the TypeORM CLI (npm run migration:*).
export default new DataSource(buildDataSourceOptions());
