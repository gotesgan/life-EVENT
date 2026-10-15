import { describe, expect, it } from 'vitest';
import { RateLimitedError } from '@/lib/errors';
import { consumeRateLimit, enforceRateLimit } from '@/server/services/rate-limit.service';
import { uniqueSuffix } from './helpers';

const WINDOW_SECONDS = 900;

function rule(overrides: Partial<{ key: string; limit: number; windowSeconds: number }> = {}) {
  return {
    key: `rate:test:${uniqueSuffix()}`,
    limit: 3,
    windowSeconds: WINDOW_SECONDS,
    ...overrides,
  };
}

/** A timestamp guaranteed to sit at the start of a fixed window. */
function windowAlignedNow(offsetWindows = 0): Date {
  const windowMs = WINDOW_SECONDS * 1000;
  return new Date(Math.floor(Date.now() / windowMs) * windowMs + offsetWindows * windowMs);
}

describe('consumeRateLimit inside one window', () => {
  it('allows up to the limit and reports the remaining budget', async () => {
    const currentRule = rule({ limit: 3 });
    const now = windowAlignedNow();

    const first = await consumeRateLimit(currentRule, now);
    const second = await consumeRateLimit(currentRule, now);
    const third = await consumeRateLimit(currentRule, now);

    expect(first).toMatchObject({ allowed: true, remaining: 2 });
    expect(second).toMatchObject({ allowed: true, remaining: 1 });
    expect(third).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('rejects the request immediately after the limit is exhausted', async () => {
    const currentRule = rule({ limit: 2 });
    const now = windowAlignedNow();

    await consumeRateLimit(currentRule, now);
    await consumeRateLimit(currentRule, now);
    const rejected = await consumeRateLimit(currentRule, now);

    expect(rejected.allowed).toBe(false);
    expect(rejected.remaining).toBe(0);
  });

  it('reports a positive retryAfterSeconds that stays within the window', async () => {
    const currentRule = rule({ limit: 1 });
    const now = windowAlignedNow();

    const first = await consumeRateLimit(currentRule, now);
    const rejected = await consumeRateLimit(currentRule, now);

    for (const result of [first, rejected]) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(WINDOW_SECONDS);
    }
  });

  it('does not let one key consume another key’s budget', async () => {
    const currentRule = rule({ limit: 1 });
    const otherRule = rule({ limit: 1 });
    const now = windowAlignedNow();

    await consumeRateLimit(currentRule, now);
    const exhausted = await consumeRateLimit(currentRule, now);
    const other = await consumeRateLimit(otherRule, now);

    expect(exhausted.allowed).toBe(false);
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(0);
  });
});

describe('consumeRateLimit across windows', () => {
  it('resets the count in the next fixed window', async () => {
    const currentRule = rule({ limit: 2 });
    const firstWindow = windowAlignedNow();
    const secondWindow = windowAlignedNow(1);

    await consumeRateLimit(currentRule, firstWindow);
    await consumeRateLimit(currentRule, firstWindow);
    const rejected = await consumeRateLimit(currentRule, firstWindow);
    expect(rejected.allowed).toBe(false);

    const nextWindowFirst = await consumeRateLimit(currentRule, secondWindow);
    expect(nextWindowFirst).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('stores one bucket per window rather than one per key', async () => {
    const currentRule = rule({ limit: 5 });
    const first = await consumeRateLimit(currentRule, windowAlignedNow());
    const otherWindow = await consumeRateLimit(currentRule, windowAlignedNow(3));

    expect(first.allowed).toBe(true);
    expect(otherWindow.allowed).toBe(true);
    expect(otherWindow.remaining).toBe(4);
  });
});

describe('enforceRateLimit', () => {
  it('throws a RateLimitedError once the bucket is exhausted', async () => {
    const currentRule = rule({
      key: `rate:enforce:${uniqueSuffix()}`,
      limit: 2,
      windowSeconds: 60,
    });

    await enforceRateLimit(currentRule);
    await enforceRateLimit(currentRule);

    await expect(enforceRateLimit(currentRule)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('attaches a positive retryAfterSeconds and the HTTP mapping to the error', async () => {
    const currentRule = rule({
      key: `rate:enforce:${uniqueSuffix()}`,
      limit: 1,
      windowSeconds: 60,
    });
    await enforceRateLimit(currentRule);

    const error = await enforceRateLimit(currentRule).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RateLimitedError);
    const rateLimited = error as RateLimitedError;
    expect(rateLimited.code).toBe('RATE_LIMITED');
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.retryAfterSeconds).toBeGreaterThan(0);
    expect(rateLimited.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});
