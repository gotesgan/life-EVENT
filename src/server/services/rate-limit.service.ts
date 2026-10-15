import 'server-only';
import { prisma } from '@/lib/db';
import { RateLimitedError } from '@/lib/errors';

export interface RateLimitRule {
  /** Namespaced identity, e.g. `enquiry:ip:<hash>` or `track:email:<hash>`. */
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Fixed-window rate limiting backed by PostgreSQL.
 *
 * Deliberately not in process memory: serverless instances do not share memory,
 * so an in-memory counter would silently allow the full limit per instance —
 * exactly when a burst is most likely.
 *
 * The increment is performed by a single atomic upsert against the
 * `(key, windowStart)` unique constraint, so concurrent requests cannot both
 * read "3 of 5 used" and both proceed.
 */
export async function consumeRateLimit(
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowStart = windowStartFor(now, rule.windowSeconds);
  const expiresAt = new Date(windowStart.getTime() + rule.windowSeconds * 2000);

  let count: number;
  try {
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key_windowStart: { key: rule.key, windowStart } },
      create: { key: rule.key, windowStart, count: 1, expiresAt },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    count = bucket.count;
  } catch {
    // Two concurrent first-requests in the same window can race the insert.
    // Retrying the update path resolves it without weakening the limit.
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key_windowStart: { key: rule.key, windowStart } },
      create: { key: rule.key, windowStart, count: 1, expiresAt },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    count = bucket.count;
  }

  const windowEndMs = windowStart.getTime() + rule.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - now.getTime()) / 1000));

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  };
}

/** Throws the canonical 429 when the rule is exhausted. */
export async function enforceRateLimit(
  rule: RateLimitRule,
  message?: string,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(rule);
  if (!result.allowed) {
    throw new RateLimitedError(result.retryAfterSeconds, message);
  }
  return result;
}

/**
 * Removes expired buckets. Called opportunistically after a submission rather
 * than on a schedule, so no background worker is required for correctness.
 */
export async function pruneExpiredRateLimitBuckets(now: Date = new Date()): Promise<number> {
  // Sampling keeps the extra write off the hot path for the common case.
  if (Math.random() > 0.05) return 0;

  const { count } = await prisma.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return count;
}
