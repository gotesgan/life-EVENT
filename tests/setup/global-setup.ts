import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { SEED_LOCK_KEY, TRUNCATE_ALL_SQL } from './truncate';

/**
 * Vitest global setup.
 *
 * Runs exactly once for the whole integration/API suite: it points Prisma at the
 * isolated test database, applies migrations, and seeds the reference data. It
 * refuses to run unless `TEST_DATABASE_URL` is set and is different from
 * `DATABASE_URL`, so a misconfigured environment can never truncate development
 * or production data.
 */
export default async function globalSetup() {
  config();

  const testUrl = process.env.TEST_DATABASE_URL;
  const devUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL must be set. Integration tests never run against the development database.',
    );
  }

  if (devUrl && testUrl === devUrl) {
    throw new Error(
      'Refusing to run: TEST_DATABASE_URL and DATABASE_URL point at the same database.',
    );
  }

  const env = {
    ...process.env,
    // The Prisma CLI uses `datasource.url` from prisma.config.ts, which reads
    // DIRECT_URL first, so both must be redirected at the test database.
    DATABASE_URL: testUrl,
    DIRECT_URL: testUrl,
    // The seed refuses to run when NODE_ENV=production; do not inherit a shell
    // value that would make the harness fail for the wrong reason.
    NODE_ENV: 'test' as const,
  };

  execSync('npx prisma migrate deploy', { env, stdio: 'inherit', cwd: process.cwd() });

  // Serialised with the same advisory lock the per-file setup uses, so two
  // overlapping test processes (a CI retry, or a developer running the suite
  // twice) cannot race the seed's delete-then-insert and fail a unique
  // constraint. See tests/setup/integration.ts.
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SEED_LOCK_KEY]);

    // Clear before seeding. The seed asserts invariants about the data it
    // creates — every listing has a cover image, for one — so anything left in
    // the database by a *different* suite makes it abort before a single test
    // runs. Playwright deliberately leaves a cover-less draft behind to test the
    // publish guard, which is exactly what broke this. Per-file setup truncates,
    // but it runs after this, so this is the only place that can fix it.
    await client.query(TRUNCATE_ALL_SQL);

    execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit', cwd: process.cwd() });
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SEED_LOCK_KEY]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }

  // NOTE: process.env is deliberately NOT mutated here. Global setup runs in the
  // main process and workers inherit its environment, so writing DATABASE_URL
  // here would make `TEST_DATABASE_URL === DATABASE_URL` downstream and trip the
  // safety guard in tests/setup/integration.ts. Each worker redirects its own
  // environment instead.
}
