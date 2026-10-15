import { defineConfig, devices } from '@playwright/test';

/**
 * The isolated test database. Required, never defaulted — see the webServer env.
 *
 * `source .dev-env.sh` exports it; CI provides it from the postgres service.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must be set to run the end-to-end suite. It is deliberately not defaulted: ' +
      'a fallback naming one machine-specific database either fails everywhere else or, worse, ' +
      'succeeds against the wrong database.',
  );
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * The suite runs against a real production build served by `next start`, with
 * the application pointed at the isolated test database. Desktop, mobile and
 * both colour schemes are separate projects so a responsive or theme regression
 * fails a named project rather than hiding inside a single run.
 *
 * `fullyParallel` is disabled because the specs share one database.
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    testIdAttribute: 'data-testid',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },

  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `${BASE_URL}/api/event-types`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // The E2E run must never touch the development database. `TEST_DATABASE_URL`
      // is required rather than defaulted: a hard-coded fallback that names one
      // developer's PostgreSQL account works on exactly one machine and fails
      // confusingly everywhere else, and a silent fallback is the wrong shape for
      // a variable whose whole purpose is to guarantee the *right* database.
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      BETTER_AUTH_URL: BASE_URL,
      // `pnpm start` runs a production build, so the hardened environment checks
      // apply. These are test-only values that satisfy them deliberately: the
      // suite exercises the local storage driver because no R2 bucket exists in
      // this environment, which is exactly what the opt-in flag is for.
      BETTER_AUTH_SECRET: 'e2e-only-secret-not-used-anywhere-else-0123456789',
      IP_HASH_SALT: 'e2e-only-ip-hash-salt',
      ALLOW_LOCAL_MEDIA_STORAGE: 'true',
      // The suite signs in and submits enquiries repeatedly from a single
      // address, so the production abuse ceilings are raised for this run only.
      // The protection itself is still exercised by the integration tests.
      RATE_LIMIT_AUTH_PER_IP: '2000',
      RATE_LIMIT_ENQUIRY_PER_IP: '200',
      RATE_LIMIT_ENQUIRY_PER_EMAIL: '50',
    },
  },

  projects: [
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'desktop-dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
