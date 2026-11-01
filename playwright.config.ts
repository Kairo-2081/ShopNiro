import { defineConfig, devices } from '@playwright/test';
import { assertTestDatabase, resolveTarget } from './e2e/target.ts';

// Local by default. E2E_BASE_URL switches to staging, and the guards in e2e/target.ts refuse anything else.
const target = resolveTarget(process.env);
assertTestDatabase(process.env.DATABASE_URL, target);

const port = Number(process.env.E2E_PORT) || 3100;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: target.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: 'e2e/.auth/customer.json',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 5'] } },
    // 360 px is the narrowest width the roadmap asks for (a small Android phone).
    { name: 'narrow', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
  ],
  // Against staging the site is already running, so there is nothing to start.
  webServer: target.remote ? undefined : {
    command: 'npx tsx server/index.ts',
    url: `http://127.0.0.1:${port}/api/ready`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    // VITE_API_URL matters: without it the browser app calls the production API on Render.
    env: {
      NODE_ENV: 'test',
      PORT: String(port),
      VITE_API_URL: `http://127.0.0.1:${port}`,
      APP_URL: `http://127.0.0.1:${port}`,
      // Built-in fake gateway (refused outside development and test); no network and no real gateway.
      PAYMENT_SIMULATOR: 'true',
      // Several roles sign in from one address; the default of 5 per 15 minutes would block the suite.
      LOGIN_RATE_LIMIT_MAX: '100',
    },
  },
});
