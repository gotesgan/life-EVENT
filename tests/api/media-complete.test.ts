import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as presignMedia } from '@/app/api/admin/listings/[id]/media/presign/route';
import { POST as completeMedia } from '@/app/api/admin/listings/[id]/media/[mediaId]/complete/route';
import { getServerEnv } from '@/lib/env';
import { resetStorageDriverForTests, writeLocalObject } from '@/lib/storage';
import {
  SEEDED_LISTINGS,
  clearRuntimeState,
  jsonRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
} from './api-helpers';
import { requireListingId } from '../integration/helpers';

/**
 * `POST /api/admin/listings/[id]/media/[mediaId]/complete` — the real upload
 * security checkpoint.
 *
 * The bytes never pass through the server; the browser PUTs directly to
 * storage, so completion must re-read the stored object and refuse it when the
 * object is missing, when its content type is not an accepted image, when its
 * size disagrees with what was declared, or when the stored size is outside the
 * cap. The refusal must leave the row `PENDING`, never `READY`.
 *
 * Storage is pointed at a per-run temp directory, exercising the real local
 * driver (the same one development uses) rather than a mock.
 */

let storageDir: string;

async function useFreshStorageDir(): Promise<void> {
  storageDir = await mkdtemp(path.join(tmpdir(), 'liveenvt-media-api-'));
  process.env.LOCAL_STORAGE_DIR = storageDir;
  resetStorageDriverForTests();
}

interface CompleteBody {
  data: { id: string; publicUrl: string; altText: string; isCover: boolean; sortOrder: number };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

async function getStorageKey(mediaId: string): Promise<string> {
  const { prisma } = await import('@/lib/db');
  const row = await prisma.listingMedia.findUniqueOrThrow({
    where: { id: mediaId },
    select: { storageKey: true },
  });
  return row.storageKey;
}

async function callPresign(
  listingId: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<{ status: number; mediaId: string | null }> {
  const response = await presignMedia(
    jsonRequest(`/api/admin/listings/${listingId}/media/presign`, 'POST', body, withCookie(cookie)),
    routeContext({ id: listingId }),
  );
  const json = await readJson<{ data?: { mediaId: string } } & ApiErrorResponse>(response);
  return { status: response.status, mediaId: json.data?.mediaId ?? null };
}

async function callComplete(
  listingId: string,
  mediaId: string,
  cookie: string | null,
  body: Record<string, unknown>,
): Promise<{ status: number; body: CompleteBody & ApiErrorResponse }> {
  const headers = cookie ? withCookie(cookie) : {};
  const response = await completeMedia(
    jsonRequest(
      `/api/admin/listings/${listingId}/media/${mediaId}/complete`,
      'POST',
      body,
      headers,
    ),
    routeContext({ id: listingId, mediaId }),
  );
  return {
    status: response.status,
    body: await readJson<CompleteBody & ApiErrorResponse>(response),
  };
}

/**
 * Creates a `PENDING` media row directly and, unless `writeBytes` is null,
 * writes the matching object to disk. Used for the cases presign cannot create
 * (a stored type or size the allow-list/cap rejects) so the completion-time
 * re-verification is the thing under test.
 */
async function createPendingMedia(
  listingId: string,
  options: { mimeType: string; sizeBytes: number; storedContentType: string; writeBytes?: boolean },
): Promise<{ mediaId: string; storageKey: string }> {
  const { prisma } = await import('@/lib/db');
  const suffix = randomUUID();
  const storageKey = `tests-media/${suffix}.bin`;

  const row = await prisma.listingMedia.create({
    data: {
      listingId,
      storageKey,
      publicUrl: `/local-media/${storageKey}`,
      altText: 'Pending upload',
      mimeType: options.mimeType,
      sizeBytes: options.sizeBytes,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (options.writeBytes !== false) {
    await writeLocalObject(storageKey, Buffer.alloc(options.sizeBytes), options.storedContentType);
  }

  return { mediaId: row.id, storageKey };
}

beforeEach(async () => {
  await clearRuntimeState();
  await useFreshStorageDir();
});

afterAll(async () => {
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
  resetStorageDriverForTests();
});

describe('media completion authorization', () => {
  it('returns 401 without a session', async () => {
    const listingId = await requireListingId(SEEDED_LISTINGS.published);
    const { status } = await callComplete(listingId, crypto.randomUUID(), null, {
      altText: 'A photo',
    });
    expect(status).toBe(401);
  });

  it('returns 403 for a signed-in customer', async () => {
    const customer = await signInAsCustomer('priya');
    const listingId = await requireListingId(SEEDED_LISTINGS.published);
    const { status, body } = await callComplete(listingId, crypto.randomUUID(), customer.cookie, {
      altText: 'A photo',
    });
    expect(status).toBe(403);
    expect(errorOf(body).code).toBe('FORBIDDEN');
  });
});

describe('media completion happy path', () => {
  it('marks a verified object READY, trusts storage for type and size, and audits it', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    const presigned = await callPresign(listingId, admin.cookie, {
      filename: 'banquet-hall.png',
      contentType: 'image/png',
      sizeBytes: 64,
    });
    expect(presigned.status).toBe(201);
    expect(presigned.mediaId).not.toBeNull();

    const storageKey = await getStorageKey(presigned.mediaId!);
    await writeLocalObject(storageKey, Buffer.alloc(64, 7), 'image/png');

    const { status, body } = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: '  Grand   banquet hall  ',
      sortOrder: 0,
      isCover: true,
    });

    expect(status).toBe(200);
    expect(body.data.id).toBe(presigned.mediaId);
    expect(body.data.altText).toBe('Grand banquet hall');
    expect(body.data.isCover).toBe(true);

    const { prisma } = await import('@/lib/db');
    const row = await prisma.listingMedia.findUniqueOrThrow({
      where: { id: presigned.mediaId! },
      select: { status: true, altText: true, mimeType: true, sizeBytes: true, failureReason: true },
    });
    expect(row.status).toBe('READY');
    expect(row.altText).toBe('Grand banquet hall');
    expect(row.mimeType).toBe('image/png');
    expect(row.sizeBytes).toBe(64);
    expect(row.failureReason).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'listing.media_verified', entityId: listingId },
      select: { actorUserId: true, metadata: true },
    });
    expect(audit?.actorUserId).toBe(admin.userId);
    expect(audit?.metadata).toMatchObject({ mediaId: presigned.mediaId });
  });
});

describe('media completion refusals', () => {
  it('refuses an upload whose object is absent from storage', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    const presigned = await callPresign(listingId, admin.cookie, {
      filename: 'missing.png',
      contentType: 'image/png',
      sizeBytes: 32,
    });
    expect(presigned.status).toBe(201);

    const { status, body } = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: 'Never uploaded',
    });

    expect(status).toBe(404);
    expect(errorOf(body).code).toBe('NOT_FOUND');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.listingMedia.findUniqueOrThrow({
      where: { id: presigned.mediaId! },
      select: { status: true },
    });
    expect(row.status).toBe('PENDING');
  });

  it('refuses an object whose stored content type differs from the declared one', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    const presigned = await callPresign(listingId, admin.cookie, {
      filename: 'declared-png.png',
      contentType: 'image/png',
      sizeBytes: 48,
    });
    expect(presigned.status).toBe(201);

    // The client controls what it actually PUTs: declare a PNG, store a PDF.
    const storageKey = await getStorageKey(presigned.mediaId!);
    await writeLocalObject(storageKey, Buffer.alloc(48, 1), 'application/pdf');

    const { status, body } = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: 'Smuggled type',
    });

    expect(status).toBe(415);
    expect(errorOf(body).code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.listingMedia.findUniqueOrThrow({
      where: { id: presigned.mediaId! },
      select: { status: true },
    });
    expect(row.status).toBe('PENDING');
  });

  it('refuses a stored content type that is not on the allow-list even when it matches the declaration', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    // Reaches the completion-time allow-list re-check: the metadata round-trips
    // (stored equals declared) but the reported type is not an accepted image.
    const { mediaId } = await createPendingMedia(listingId, {
      mimeType: 'application/pdf',
      sizeBytes: 48,
      storedContentType: 'application/pdf',
    });

    const { status, body } = await callComplete(listingId, mediaId, admin.cookie, {
      altText: 'Not an image',
    });

    expect(status).toBe(415);
    const error = errorOf(body);
    expect(error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(error.details).toMatchObject({ actualContentType: 'application/pdf' });
    expect((error.details as { allowed: string[] }).allowed).toContain('image/png');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.listingMedia.findUniqueOrThrow({
      where: { id: mediaId },
      select: { status: true },
    });
    expect(row.status).toBe('PENDING');
  });

  it('refuses an object whose stored size disagrees with the declared size', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    const presigned = await callPresign(listingId, admin.cookie, {
      filename: 'short.png',
      contentType: 'image/png',
      sizeBytes: 64,
    });
    expect(presigned.status).toBe(201);

    const storageKey = await getStorageKey(presigned.mediaId!);
    await writeLocalObject(storageKey, Buffer.alloc(97, 3), 'image/png');

    const { status, body } = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: 'Wrong length',
    });

    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.listingMedia.findUniqueOrThrow({
      where: { id: presigned.mediaId! },
      select: { status: true, sizeBytes: true },
    });
    expect(row.status).toBe('PENDING');
    // The declared size on the row is not rewritten with the unverified value.
    expect(row.sizeBytes).toBe(64);
  });

  it('refuses a stored object whose size exceeds the upload cap', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);
    const cap = getServerEnv().MEDIA_MAX_UPLOAD_BYTES;

    const { mediaId } = await createPendingMedia(listingId, {
      mimeType: 'image/png',
      sizeBytes: cap + 1,
      storedContentType: 'image/png',
    });

    const { status, body } = await callComplete(listingId, mediaId, admin.cookie, {
      altText: 'Too big',
    });

    expect(status).toBe(413);
    const error = errorOf(body);
    expect(error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(error.details).toMatchObject({ maxBytes: cap });

    const { prisma } = await import('@/lib/db');
    const row = await prisma.listingMedia.findUniqueOrThrow({
      where: { id: mediaId },
      select: { status: true },
    });
    expect(row.status).toBe('PENDING');
  });

  it('returns 404 when the media row belongs to a different listing', async () => {
    const admin = await signInAsAdmin();
    const ownerListingId = await requireListingId(SEEDED_LISTINGS.published);
    const otherListingId = await requireListingId(SEEDED_LISTINGS.draft);

    const presigned = await callPresign(ownerListingId, admin.cookie, {
      filename: 'other-listing.png',
      contentType: 'image/png',
      sizeBytes: 16,
    });
    expect(presigned.status).toBe(201);
    const storageKey = await getStorageKey(presigned.mediaId!);
    await writeLocalObject(storageKey, Buffer.alloc(16, 2), 'image/png');

    const { status, body } = await callComplete(otherListingId, presigned.mediaId!, admin.cookie, {
      altText: 'Wrong listing',
    });

    expect(status).toBe(404);
    expect(errorOf(body).code).toBe('NOT_FOUND');
  });

  it('refuses to complete an upload that is already READY', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    const presigned = await callPresign(listingId, admin.cookie, {
      filename: 'twice.png',
      contentType: 'image/png',
      sizeBytes: 24,
    });
    const storageKey = await getStorageKey(presigned.mediaId!);
    await writeLocalObject(storageKey, Buffer.alloc(24, 4), 'image/png');

    const first = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: 'First completion',
    });
    expect(first.status).toBe(200);

    const second = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: 'Second completion',
    });
    expect(second.status).toBe(400);
    expect(errorOf(second.body).code).toBe('VALIDATION_ERROR');
  });

  it('rejects blank alt text before touching storage', async () => {
    const admin = await signInAsAdmin();
    const listingId = await requireListingId(SEEDED_LISTINGS.published);

    const presigned = await callPresign(listingId, admin.cookie, {
      filename: 'alt.png',
      contentType: 'image/png',
      sizeBytes: 16,
    });

    const { status, body } = await callComplete(listingId, presigned.mediaId!, admin.cookie, {
      altText: '   ',
    });
    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');
  });
});
