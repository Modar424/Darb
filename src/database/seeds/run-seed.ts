import 'reflect-metadata';
import { loadConfig } from '../../config/configuration';
import { loadEnvFile } from '../load-env';
import { buildDataSourceOptions } from '../options';
import { DataSource } from 'typeorm';
import { runSeed } from './seed';

async function main() {
  loadEnvFile();
  const cfg = loadConfig();
  if (cfg.isProduction) throw new Error('Refusing to seed demo data in production');
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10)
    throw new Error('Set SEED_PASSWORD (min 10 chars) in your environment/.env');
  const ds = await new DataSource(buildDataSourceOptions()).initialize();
  try {
    const { created } = await runSeed(ds, password);
    console.log(
      created
        ? 'Seed complete (admin@example.test, instructor1@example.test, student1@example.test ...)'
        : 'Seed skipped: demo data already present',
    );
  } finally {
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
