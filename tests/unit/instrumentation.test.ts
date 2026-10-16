import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register } from '@/instrumentation';
import { resetServerEnvCache } from '@/lib/env';

/**
 * The server must validate its configuration rather than discover it per request.
 *
 * Regression guard for a defect with a particularly bad failure shape: because
 * `getServerEnv()` was only reached from inside request handling, a bad variable
 * surfaced *per request*, and on a page route it surfaced after the static shell
 * had already been flushed — so the client got **HTTP 200 with a zero-byte
 * body**. A status code of 200 means nothing in monitoring noticed.
 *
 * `register()` runs before any request is handled, so the same misconfiguration
 * is now raised on the way up. These tests pin that behaviour, and pin the fact
 * that the logged reason names the *variable*, never its secret value.
 */

const MANAGED_KEYS = [
  'NODE_ENV',
  'NEXT_RUNTIME',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'IP_HASH_SALT',
  'ALLOW_LOCAL_MEDIA_STORAGE',
  'NEXT_PUBLIC_APP_URL',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
] as const;

/** A production configuration that passes every check. */
const VALID_PRODUCTION = {
  NODE_ENV: 'production',
  NEXT_RUNTIME: 'nodejs',
  DATABASE_URL: 'postgresql://user:pass@host:5432/db?schema=public',
  BETTER_AUTH_SECRET: 'a'.repeat(48),
  IP_HASH_SALT: 'b'.repeat(24),
  NEXT_PUBLIC_APP_URL: 'https://liveenvt.example',
  ALLOW_LOCAL_MEDIA_STORAGE: 'false',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret-value-must-never-be-logged',
  R2_BUCKET: 'bucket',
  R2_PUBLIC_BASE_URL: 'https://media.example.test',
} as const;

let original: Record<string, string | undefined> = {};

function applyEnv(overrides: Record<string, string | undefined>) {
  const env = process.env as Record<string, string | undefined>;

  for (const key of MANAGED_KEYS) delete env[key];
  for (const [key, value] of Object.entries({ ...VALID_PRODUCTION, ...overrides })) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  resetServerEnvCache();
}

beforeEach(() => {
  original = {};
  for (const key of MANAGED_KEYS) original[key] = process.env[key];
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  const env = process.env as Record<string, string | undefined>;

  for (const key of MANAGED_KEYS) {
    if (original[key] === undefined) delete env[key];
    else env[key] = original[key]!;
  }
  resetServerEnvCache();
  vi.restoreAllMocks();
});

describe('server bootstrap validation', () => {
  it('starts with a valid production configuration', async () => {
    applyEnv({});
    await expect(register()).resolves.toBeUndefined();
  });

  it('refuses to start when a required production variable is a placeholder', async () => {
    applyEnv({ BETTER_AUTH_SECRET: 'replace-with-a-long-random-secret' });
    await expect(register()).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it('refuses to start on the development IP hash salt in production', async () => {
    applyEnv({ IP_HASH_SALT: 'dev-only-ip-salt' });
    await expect(register()).rejects.toThrow(/IP_HASH_SALT/);
  });

  it('refuses to start when production media storage is unconfigured', async () => {
    applyEnv({
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });
    await expect(register()).rejects.toThrow(/Media storage is not configured in production/);
  });

  it('logs the reason to the operator log stream, naming the variable', async () => {
    applyEnv({ IP_HASH_SALT: 'dev-only-ip-salt' });

    await register().catch(() => undefined);

    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .map((part) => String(part))
      .join('\n');

    expect(logged).toMatch(/server configuration is invalid/i);
    expect(logged).toMatch(/IP_HASH_SALT/);
  });

  it('never writes a secret value to the log', async () => {
    // Every secret is wrong *and* distinctive, so any value appearing in the log
    // is unambiguous evidence of a leak.
    applyEnv({
      BETTER_AUTH_SECRET: 'LEAK-CANARY-SECRET',
      IP_HASH_SALT: 'LEAK-CANARY-SALT',
      R2_SECRET_ACCESS_KEY: 'LEAK-CANARY-R2',
    });

    await register().catch(() => undefined);

    const logged = vi
      .mocked(console.error)
      .mock.calls.flat()
      .map((part) => String(part))
      .join('\n');

    expect(logged).not.toContain('LEAK-CANARY-SECRET');
    expect(logged).not.toContain('LEAK-CANARY-SALT');
    expect(logged).not.toContain('LEAK-CANARY-R2');
  });

  it('is a no-op on a runtime that does not own server configuration', async () => {
    // The edge runtime has neither these variables nor this failure mode, so
    // validating there would produce a false failure.
    applyEnv({ NEXT_RUNTIME: 'edge', IP_HASH_SALT: 'dev-only-ip-salt' });
    await expect(register()).resolves.toBeUndefined();
  });

  it('does not block development, where the defaults are legitimate', async () => {
    applyEnv({
      NODE_ENV: 'development',
      BETTER_AUTH_SECRET: 'dev-only-secret-16',
      IP_HASH_SALT: 'dev-only-ip-salt',
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });
    await expect(register()).resolves.toBeUndefined();
  });
});
