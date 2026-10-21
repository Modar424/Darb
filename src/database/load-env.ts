import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Loads .env for CLI tools (TypeORM CLI, seeds). Real environment variables always win. */
export function loadEnvFile(): void {
  const file = resolve(process.cwd(), '.env');
  if (existsSync(file)) {
    const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
    if (loader) loader.call(process, file);
  }
}
