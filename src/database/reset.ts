import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadConfig } from '../config/configuration';
import { loadEnvFile } from './load-env';
import { buildDataSourceOptions } from './options';
import { runSeed } from './seeds/seed';

/** LOCAL DEVELOPMENT ONLY: drops all tables, re-runs migrations, re-seeds. */
async function main() {
  loadEnvFile();
  const cfg = loadConfig();
  if (cfg.isProduction) throw new Error('Refusing to reset the database in production');
  if (!['localhost', '127.0.0.1', 'mysql', 'db'].includes(cfg.db.host))
    throw new Error(`Refusing to reset non-local host ${cfg.db.host}`);
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10) throw new Error('Set SEED_PASSWORD (min 10 chars)');
  const ds = await new DataSource(buildDataSourceOptions()).initialize();
  try {
    await ds.dropDatabase();
    await ds.runMigrations();
    await runSeed(ds, password);
    console.log(`Database ${cfg.db.name} reset and seeded.`);
  } finally {
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
