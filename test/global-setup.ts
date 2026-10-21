import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../src/database/options';

/** Rebuilds the schema of the TEST database from migrations (also validates the migrations themselves). */
export default async function globalSetup(): Promise<void> {
  const env = {
    NODE_ENV: 'test',
    DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
    DB_PORT: process.env.TEST_DB_PORT ?? '3306',
    DB_USER: process.env.TEST_DB_USER ?? 'lms',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? 'change_me_local_only',
    DB_NAME: process.env.TEST_DB_NAME ?? 'lms_test',
  };
  if (!env.DB_NAME.endsWith('_test'))
    throw new Error('Refusing to run tests against a database not ending in _test');
  const ds = new DataSource(buildDataSourceOptions(env));
  await ds.initialize();
  try {
    await ds.dropDatabase();
    await ds.runMigrations();
  } finally {
    await ds.destroy();
  }
}
