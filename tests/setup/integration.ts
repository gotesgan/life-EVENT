import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { afterAll, beforeAll } from 'vitest';

/**
 * Per-file integration harness.
 *
 * Wires the process at the isolated test database *before* any application
 * module is imported, so the shared Prisma singleton used by services points at
 * the test database rather than the development one.
 *
 * `beforeAll` here runs after the global setup has migrated and seeded, so test
 * files can rely on seed data existing unless they explicitly truncate.
 */
config();

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error('TEST_DATABASE_URL must be set for integration tests');
}

if (testUrl === process.env.DATABASE_URL) {
  throw new Error(
    'Refusing to run: TEST_DATABASE_URL and DATABASE_URL point at the same database.',
  );
}

process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;

export const testDatabaseUrl = testUrl;

/** Tables in an order that satisfies foreign keys. */
const TABLES_IN_DELETE_ORDER = [
  'enquiry_notes',
  'enquiry_activities',
  'enquiry_listings',
  'enquiries',
  'listing_attribute_values',
  'listing_amenities',
  'listing_event_types',
  'listing_service_areas',
  'listing_media',
  'listing_services',
  'listing_packages',
  'venue_spaces',
  'listing_categories',
  'business_listings',
  'category_attributes',
  'attribute_options',
  'attribute_definitions',
  'amenities',
  'event_types',
  'categories',
  'customer_profiles',
  'sessions',
  'accounts',
  'verifications',
  'idempotency_keys',
  'rate_limit_buckets',
  'audit_logs',
  'vendor_invites',
  'vendor_applications',
  'email_logs',
  'meta_event_logs',
  'app_settings',
  'users',
  'locations',
] as const;

/**
 * Deletes every row from every application table.
 *
 * `TRUNCATE ... CASCADE` is used rather than ordered DELETEs so a forgotten
 * table cannot leave rows behind and silently leak state between test files.
 */
export async function truncateAllTables(): Promise<void> {
  const { prisma } = await import('@/lib/db');
  const list = TABLES_IN_DELETE_ORDER.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Re-runs the seed against the test database. */
export function seedTestDatabase(): void {
  execSync('npx tsx prisma/seed.ts', {
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
    stdio: 'pipe',
    cwd: process.cwd(),
  });
}

/**
 * Advisory-lock key for seeding. Any two processes seeding the same database at
 * the same time would race on the seed's delete-then-insert of child
 * collections and fail a unique constraint, so seeding is serialised across
 * processes with a PostgreSQL session-level advisory lock.
 */
const SEED_LOCK_KEY = 918_273_645;

/**
 * Seeds the test database while holding an advisory lock.
 *
 * A dedicated connection is used because advisory locks are session-scoped: the
 * lock and the unlock must happen on the same connection. The lock is released
 * in a `finally`, so a failed seed cannot deadlock later files.
 */
export async function seedTestDatabaseSafely(): Promise<void> {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: testUrl });

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SEED_LOCK_KEY]);
    seedTestDatabase();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SEED_LOCK_KEY]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

/** Tables that accumulate runtime state and are safe to clear between tests. */
export async function clearRuntimeState(): Promise<void> {
  const { prisma } = await import('@/lib/db');
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "enquiry_notes", "enquiry_activities", "enquiry_listings", "enquiries", "idempotency_keys", "rate_limit_buckets", "audit_logs", "vendor_invites", "vendor_applications", "email_logs", "meta_event_logs", "app_settings" RESTART IDENTITY CASCADE',
  );
}

/**
 * Gives every test file a deterministic starting state.
 *
 * The database is truncated and then re-seeded before each file, rather than
 * merely re-seeded. Incremental re-seeding is not sufficient: a suite that
 * creates its own listings (for example constraint tests that insert listings
 * with no media) makes the seed's own consistency check fail for the next file,
 * which then reports a seed error instead of a test result and masks every
 * integration guarantee behind it. Truncating first removes that class of
 * cross-file coupling entirely.
 *
 * Seeding holds a PostgreSQL advisory lock, so this stays safe even if two test
 * processes run at the same time.
 */
beforeAll(async () => {
  await truncateAllTables();
  await seedTestDatabaseSafely();
}, 180_000);

afterAll(async () => {
  const { prisma } = await import('@/lib/db');
  await prisma.$disconnect();
});
