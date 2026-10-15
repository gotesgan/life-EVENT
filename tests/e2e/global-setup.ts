import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { SEED_LOCK_KEY, TRUNCATE_ALL_SQL } from '../setup/truncate';
import pg from 'pg';

/**
 * Playwright global setup.
 *
 * Points the end-to-end run at the isolated test database, applies migrations
 * and re-seeds it, so the suite always starts from the same realistic state.
 * Refuses to run when the test database is not configured separately from the
 * development database.
 *
 * The seed is wrapped in a PostgreSQL advisory lock and preceded by a truncate,
 * for the same reasons as the Vitest harness (`tests/setup/integration.ts`):
 *  - two processes seeding at once race the seed's delete-then-insert and fail a
 *    unique constraint;
 *  - seeding over data a previous run left behind trips the seed's own
 *    consistency check ("every listing has a cover media row"), which then
 *    surfaces as a setup failure rather than as a test result.
 */
export default async function globalSetup() {
  config();

  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL must be set. End-to-end tests never run against the development database.',
    );
  }

  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      'Refusing to run: TEST_DATABASE_URL and DATABASE_URL point at the same database.',
    );
  }

  const env = {
    ...process.env,
    DATABASE_URL: testUrl,
    DIRECT_URL: testUrl,
    // Deterministic: the seed refuses to run when NODE_ENV=production, and the
    // harness must not inherit whatever the developer's shell happens to have.
    NODE_ENV: 'test' as const,
  };

  execSync('npx prisma migrate deploy', { env, stdio: 'inherit', cwd: process.cwd() });

  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [SEED_LOCK_KEY]);
    await client.query(TRUNCATE_ALL_SQL);
    execSync('npx tsx prisma/seed.ts', { env, stdio: 'inherit', cwd: process.cwd() });
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SEED_LOCK_KEY]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}
