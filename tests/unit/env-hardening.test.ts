import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getServerEnv, resetServerEnvCache } from '@/lib/env';

/**
 * Environment validation must fail closed.
 *
 * A configuration check that only runs in production is worthless if it cannot
 * be exercised, so these tests drive `NODE_ENV=production` directly and assert
 * that a placeholder secret, a default salt, or missing media storage is a
 * startup failure rather than a silently degraded deploy.
 *
 * `resetServerEnvCache()` is required because the parsed environment is memoised.
 */

const MANAGED_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'IP_HASH_SALT',
  'ALLOW_LOCAL_MEDIA_STORAGE',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PHASE',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
] as const;

let original: Record<string, string | undefined> = {};

const VALID_PRODUCTION = {
  DATABASE_URL: 'postgresql://user:pass@host:5432/db?schema=public',
  BETTER_AUTH_SECRET: 'a'.repeat(48),
  IP_HASH_SALT: 'b'.repeat(24),
  NEXT_PUBLIC_APP_URL: 'https://liveenvt.example',
  ALLOW_LOCAL_MEDIA_STORAGE: 'false',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
  R2_PUBLIC_BASE_URL: 'https://media.example.test',
} as const;

function applyEnv(overrides: Record<string, string | undefined>) {
  // `process.env.NODE_ENV` is declared readonly by Next's types, so the record is
  // addressed through an index signature.
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
});

afterEach(() => {
  const env = process.env as Record<string, string | undefined>;

  for (const key of MANAGED_KEYS) {
    if (original[key] === undefined) delete env[key];
    else env[key] = original[key]!;
  }
  resetServerEnvCache();
});

describe('production environment hardening', () => {
  it('accepts a fully configured production environment', () => {
    applyEnv({ NODE_ENV: 'production' });
    expect(() => getServerEnv()).not.toThrow();
  });

  it('rejects a placeholder BETTER_AUTH_SECRET', () => {
    applyEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'replace-with-a-long-random-secret' });
    expect(() => getServerEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects a BETTER_AUTH_SECRET shorter than 32 characters', () => {
    applyEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'only-sixteen-ish' });
    expect(() => getServerEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects the development IP hash salt', () => {
    applyEnv({ NODE_ENV: 'production', IP_HASH_SALT: 'dev-only-ip-salt' });
    expect(() => getServerEnv()).toThrow(/IP_HASH_SALT/);
  });

  it('rejects an IP hash salt that is too short to be a real secret', () => {
    applyEnv({ NODE_ENV: 'production', IP_HASH_SALT: 'short' });
    expect(() => getServerEnv()).toThrow(/IP_HASH_SALT/);
  });

  it('rejects a production deploy with no public app URL', () => {
    applyEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: undefined });
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it('rejects a production deploy that falls back to the localhost default', () => {
    applyEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' });
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it('rejects a production app URL with no scheme to build links from', () => {
    applyEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'liveenvt.example' });
    expect(() => getServerEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it('rejects a production deploy with no media storage configured', () => {
    applyEnv({
      NODE_ENV: 'production',
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });
    expect(() => getServerEnv()).toThrow(/Media storage is not configured in production/);
  });

  it('allows the local driver in production only with an explicit opt-in', () => {
    applyEnv({
      NODE_ENV: 'production',
      ALLOW_LOCAL_MEDIA_STORAGE: 'true',
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });
    const env = getServerEnv();
    expect(env.ALLOW_LOCAL_MEDIA_STORAGE).toBe(true);
  });

  it('parses the opt-in flag as a boolean, so a string cannot leak into logic', () => {
    applyEnv({ NODE_ENV: 'production', ALLOW_LOCAL_MEDIA_STORAGE: 'true' });
    expect(typeof getServerEnv().ALLOW_LOCAL_MEDIA_STORAGE).toBe('boolean');
  });

  it('reports every problem at once rather than one at a time', () => {
    applyEnv({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'dev-only',
      IP_HASH_SALT: 'dev-only-ip-salt',
      R2_BUCKET: undefined,
    });

    try {
      getServerEnv();
      throw new Error('expected getServerEnv() to throw');
    } catch (error) {
      const message = String((error as Error).message);
      expect(message).toMatch(/BETTER_AUTH_SECRET/);
      expect(message).toMatch(/IP_HASH_SALT/);
      expect(message).toMatch(/Media storage/);
    }
  });
});

describe('the build phase is exempt from deployment checks', () => {
  it('lets a production build run with only local placeholder values', () => {
    // `next build` collects page data with NODE_ENV=production, so applying the
    // deployment checks there made `pnpm build` fail from a clean checkout — the
    // build machine has no production secrets and does not need them. Nothing is
    // served during a build, so there is no request that could be handled with a
    // default salt.
    applyEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
      BETTER_AUTH_SECRET: 'replace-with-a-long-random-secret',
      IP_HASH_SALT: 'dev-only-ip-salt',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });

    expect(() => getServerEnv()).not.toThrow();
  });

  it('still fails closed at runtime, where NEXT_PHASE is unset', () => {
    applyEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: undefined,
      BETTER_AUTH_SECRET: 'replace-with-a-long-random-secret',
      IP_HASH_SALT: 'dev-only-ip-salt',
    });

    expect(() => getServerEnv()).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe('non-production environments stay permissive', () => {
  it('allows a development environment with defaults', () => {
    applyEnv({
      NODE_ENV: 'development',
      // 16+ characters: the base minimum applies in every environment.
      BETTER_AUTH_SECRET: 'dev-only-secret-16',
      IP_HASH_SALT: 'dev-only-ip-salt',
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });
    expect(() => getServerEnv()).not.toThrow();
  });

  it('allows the test environment without any storage configuration', () => {
    applyEnv({
      NODE_ENV: 'test',
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
      R2_PUBLIC_BASE_URL: undefined,
    });
    expect(() => getServerEnv()).not.toThrow();
  });
});
