import { describe, expect, it } from 'vitest';
import { ConflictError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { hashPayload } from '@/server/domain/contact';
import {
  attachIdempotencyResult,
  claimIdempotencyKey,
  type ClaimResult,
} from '@/server/services/idempotency.service';
import { createEnquiry } from '@/server/services/enquiry.service';
import { createEnquirySchema } from '@/lib/validation/enquiry';
import { uniqueEmail, uniqueIp, uniquePhone, uniqueSuffix } from './helpers';

const SCOPE = 'enquiry.create';

function key(): string {
  return `idem:test:${uniqueSuffix()}`;
}

function states(results: ClaimResult[]): string[] {
  return results.map((result) => result.state).sort();
}

async function submitEnquiry() {
  const input = createEnquirySchema.parse({
    listings: ['gulmohar-banjara-banquets'],
    contactName: 'Idempotency Tester',
    contactEmail: uniqueEmail('idem'),
    contactPhone: uniquePhone(),
    consentPrivacy: true,
  });

  return createEnquiry(input, {
    actorUserId: null,
    ipAddress: uniqueIp(),
    userAgent: 'vitest-idempotency',
    idempotencyKey: null,
  });
}

describe('claimIdempotencyKey', () => {
  it('claims a fresh key', async () => {
    const requestHash = hashPayload({ a: 1 });

    await expect(claimIdempotencyKey({ key: key(), scope: SCOPE, requestHash })).resolves.toEqual({
      state: 'claimed',
    });
  });

  it('returns replay with no enquiry id when the same key and hash arrive again', async () => {
    const idempotencyKey = key();
    const requestHash = hashPayload({ a: 1 });

    const first = await claimIdempotencyKey({ key: idempotencyKey, scope: SCOPE, requestHash });
    const second = await claimIdempotencyKey({ key: idempotencyKey, scope: SCOPE, requestHash });

    expect(first).toEqual({ state: 'claimed' });
    expect(second).toEqual({ state: 'replay', enquiryId: null });
  });

  it('returns mismatch when the same key arrives with a different payload hash', async () => {
    const idempotencyKey = key();

    await claimIdempotencyKey({
      key: idempotencyKey,
      scope: SCOPE,
      requestHash: hashPayload({ a: 1 }),
    });
    const mismatch = await claimIdempotencyKey({
      key: idempotencyKey,
      scope: SCOPE,
      requestHash: hashPayload({ a: 2 }),
    });

    expect(mismatch).toEqual({ state: 'mismatch' });
  });

  it('scopes keys so the same key in another scope is independent', async () => {
    const sharedKey = key();
    const requestHash = hashPayload({ a: 1 });

    await claimIdempotencyKey({ key: sharedKey, scope: 'enquiry.create', requestHash });
    const otherScope = await claimIdempotencyKey({
      key: sharedKey,
      scope: 'enquiry.track',
      requestHash,
    });

    expect(otherScope).toEqual({ state: 'claimed' });
  });

  it('resolves a concurrent double-claim to exactly one claimed and one replay', async () => {
    const idempotencyKey = key();
    const requestHash = hashPayload({ race: true });

    const results = await Promise.all([
      claimIdempotencyKey({ key: idempotencyKey, scope: SCOPE, requestHash }),
      claimIdempotencyKey({ key: idempotencyKey, scope: SCOPE, requestHash }),
    ]);

    // The unique constraint on (scope, key) is the mechanism: one INSERT wins
    // and the loser observes the committed row. Two "claimed" results would be
    // a race and two "replay" results would mean nobody owned the key.
    expect(states(results)).toEqual(['claimed', 'replay']);
    expect(
      await prisma.idempotencyKey.count({ where: { key: idempotencyKey, scope: SCOPE } }),
    ).toBe(1);
  });

  it('resolves a concurrent claim storm to exactly one claimed', async () => {
    const idempotencyKey = key();
    const requestHash = hashPayload({ storm: true });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimIdempotencyKey({ key: idempotencyKey, scope: SCOPE, requestHash }),
      ),
    );

    expect(results.filter((result) => result.state === 'claimed')).toHaveLength(1);
    expect(results.filter((result) => result.state === 'replay')).toHaveLength(4);
  });
});

describe('attachIdempotencyResult', () => {
  it('makes a later replay return the enquiry id that was recorded', async () => {
    const idempotencyKey = key();
    const requestHash = hashPayload({ attach: true });

    const claim = await claimIdempotencyKey({
      key: idempotencyKey,
      scope: SCOPE,
      requestHash,
    });
    expect(claim.state).toBe('claimed');

    const submission = await submitEnquiry();
    const enquiry = await prisma.enquiry.findUniqueOrThrow({
      where: { referenceCode: submission.referenceCode },
      select: { id: true },
    });

    await attachIdempotencyResult(idempotencyKey, SCOPE, enquiry.id);

    const replay = await claimIdempotencyKey({
      key: idempotencyKey,
      scope: SCOPE,
      requestHash,
    });

    expect(replay).toEqual({ state: 'replay', enquiryId: enquiry.id });
  });
});

describe('createEnquiry replay protection', () => {
  it('replays the original enquiry for a repeated client key without creating a second row', async () => {
    const idempotencyKey = `client-${uniqueSuffix()}`;
    const input = createEnquirySchema.parse({
      listings: ['rasoi-raag-caterers'],
      contactName: 'Replay Tester',
      contactEmail: uniqueEmail('replay'),
      contactPhone: uniquePhone(),
      consentPrivacy: true,
    });
    const context = {
      actorUserId: null,
      ipAddress: uniqueIp(),
      userAgent: 'vitest-replay',
      idempotencyKey,
    };

    const first = await createEnquiry(input, context);
    const second = await createEnquiry(input, context);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.referenceCode).toBe(first.referenceCode);

    const enquiries = await prisma.enquiry.count({
      where: { contactEmail: input.contactEmail },
    });
    expect(enquiries).toBe(1);
  });

  it('throws a ConflictError when the same key is reused with a different payload', async () => {
    const idempotencyKey = `client-${uniqueSuffix()}`;
    const base = {
      contactName: 'Mismatch Tester',
      contactPhone: uniquePhone(),
      consentPrivacy: true as const,
    };

    const first = createEnquirySchema.parse({
      ...base,
      listings: ['gulmohar-banjara-banquets'],
      contactEmail: uniqueEmail('mismatch'),
    });
    const differing = createEnquirySchema.parse({
      ...base,
      listings: ['patang-photography'],
      contactEmail: uniqueEmail('mismatch'),
    });

    const context = {
      actorUserId: null,
      ipAddress: uniqueIp(),
      userAgent: 'vitest-mismatch',
      idempotencyKey,
    };

    await createEnquiry(first, context);

    const error = await createEnquiry(differing, context).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe('CONFLICT');
  });
});
