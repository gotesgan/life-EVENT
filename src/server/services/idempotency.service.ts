import 'server-only';
import { prisma } from '@/lib/db';

export interface ClaimInput {
  key: string;
  scope: string;
  /** Stable hash of the canonical request payload. */
  requestHash: string;
  ttlSeconds?: number;
}

export type ClaimResult =
  | { state: 'claimed' }
  /** The same intent was already processed; return the original result. */
  | { state: 'replay'; enquiryId: string | null }
  /** The same key arrived with a different payload — a client bug. */
  | { state: 'mismatch' };

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Claims an idempotency key for one intent.
 *
 * The unique constraint on `(scope, key)` *is* the mechanism: a single INSERT
 * decides the winner. A SELECT-then-INSERT would be a race in which two
 * concurrent retries both create a lead.
 *
 * Retention is deliberately longer than the client's retry window (7 days), so
 * a request replayed from a queue or a slow client cannot create a second
 * enquiry.
 */
/**
 * Reads an existing claim without taking one.
 *
 * Used to answer "has this exact key already been used, and with which payload?"
 * *before* the new request body is validated. Without this, a genuine key
 * mismatch (the client reusing a key for a different intent) would only be
 * detected after validation, so an invalid body would be reported as a 400 field
 * error instead of the 409 that tells the client its key is stale.
 */
export async function findIdempotencyClaim(
  key: string,
  scope: string,
): Promise<{ requestHash: string; enquiryId: string | null } | null> {
  return prisma.idempotencyKey.findUnique({
    where: { scope_key: { scope, key } },
    select: { requestHash: true, enquiryId: true },
  });
}

export async function claimIdempotencyKey(input: ClaimInput): Promise<ClaimResult> {
  const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000);

  try {
    await prisma.idempotencyKey.create({
      data: {
        key: input.key,
        scope: input.scope,
        requestHash: input.requestHash,
        expiresAt,
      },
    });
    return { state: 'claimed' };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { scope_key: { scope: input.scope, key: input.key } },
    select: { requestHash: true, enquiryId: true },
  });

  if (!existing) {
    // The row was deleted between the failed insert and this read; treat the
    // caller as the owner rather than failing the request.
    return { state: 'claimed' };
  }

  if (existing.requestHash !== input.requestHash) {
    return { state: 'mismatch' };
  }

  return { state: 'replay', enquiryId: existing.enquiryId };
}

/**
 * Releases a claim that never produced a result.
 *
 * A claim is inserted before the enquiry is created, so a failure or a crash in
 * between leaves a row with `enquiryId = null`. That is not a commitment — there
 * is no enquiry to replay — so the next attempt is allowed to take the key over
 * instead of being told the enquiry already exists.
 */
export async function releaseIdempotencyKey(key: string, scope: string): Promise<void> {
  await prisma.idempotencyKey.deleteMany({
    where: { scope, key, enquiryId: null },
  });
}

/** Records which enquiry a claimed key produced, so replays can return it. */
export async function attachIdempotencyResult(
  key: string,
  scope: string,
  enquiryId: string,
): Promise<void> {
  await prisma.idempotencyKey.updateMany({
    where: { scope, key },
    data: { enquiryId },
  });
}

export async function pruneExpiredIdempotencyKeys(now: Date = new Date()): Promise<number> {
  if (Math.random() > 0.05) return 0;
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return count;
}
