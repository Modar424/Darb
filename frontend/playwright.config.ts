import { defineConfig } from '@playwright/test';

/**
 * E2E runs against an already running stack (API + frontend). Required env:
 *   E2E_PASSWORD  – password of the seeded demo users
 * Optional: E2E_BASE_URL (default http://localhost:3000), PW_CHROMIUM_PATH / PW_CHROMIUM_ARGS to use a
 * custom Chromium instead of the one installed by `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: process.env.PW_CHROMIUM_ARGS ? process.env.PW_CHROMIUM_ARGS.split(' ') : undefined,
    },
  },
});
