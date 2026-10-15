import { beforeEach, describe, expect, it } from 'vitest';
import { POST as setPublication } from '@/app/api/admin/listings/[id]/publication/route';
import { listingCreateSchema } from '@/lib/validation/listing';
import { adminCreateListing } from '@/server/services/listing.service';
import {
  clearRuntimeState,
  jsonRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
} from './api-helpers';
import {
  attachCoverMedia,
  createTestAdmin,
  requireCategoryId,
  requireLocationId,
  uniqueSuffix,
} from '../integration/helpers';

/**
 * `POST /api/admin/listings/[id]/publication` — the publication gate.
 *
 * Publishing is refused unless the listing has a description and at least one
 * READY image, and the state machine is publish/unpublish/archive/restore. Each
 * refusal is asserted against the persisted `publicationStatus`, not just the
 * status code.
 */

type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';

interface PublicationBody {
  data: { id: string; publicationStatus: PublicationStatus; publishedAt: string | null };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

async function createListingFixture(
  options: { description?: string | null; withMedia?: boolean } = {},
): Promise<{ id: string; slug: string }> {
  const admin = await createTestAdmin('publication-admin');
  const input = listingCreateSchema.parse({
    name: `Publication Fixture ${uniqueSuffix()}`,
    primaryCategoryId: await requireCategoryId('photographers'),
    primaryLocationId: await requireLocationId('bandra-west'),
    ...(options.description === null
      ? {}
      : { description: options.description ?? 'A publishable fixture description' }),
  });

  const created = await adminCreateListing(input, admin.actor);
  if (options.withMedia !== false) await attachCoverMedia(created.id);

  return { id: created.id, slug: created.slug };
}

async function callPublication(
  listingId: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: PublicationBody & ApiErrorResponse }> {
  const response = await setPublication(
    jsonRequest(`/api/admin/listings/${listingId}/publication`, 'POST', body, withCookie(cookie)),
    routeContext({ id: listingId }),
  );
  return {
    status: response.status,
    body: await readJson<PublicationBody & ApiErrorResponse>(response),
  };
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('POST /api/admin/listings/[id]/publication authorization', () => {
  it('returns 401 without a session', async () => {
    const listing = await createListingFixture();
    const response = await setPublication(
      jsonRequest(`/api/admin/listings/${listing.id}/publication`, 'POST', { action: 'publish' }),
      routeContext({ id: listing.id }),
    );
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 for a signed-in customer', async () => {
    const customer = await signInAsCustomer('priya');
    const listing = await createListingFixture();
    const { status, body } = await callPublication(listing.id, customer.cookie, {
      action: 'publish',
    });
    expect(status).toBe(403);
    expect(errorOf(body).code).toBe('FORBIDDEN');
  });
});

describe('publication guards', () => {
  it('returns 404 for an unknown listing', async () => {
    const admin = await signInAsAdmin();
    const missingId = crypto.randomUUID();
    const { status, body } = await callPublication(missingId, admin.cookie, { action: 'publish' });
    expect(status).toBe(404);
    expect(errorOf(body).code).toBe('NOT_FOUND');
  });

  it('refuses to publish a listing with no READY image', async () => {
    const admin = await signInAsAdmin();
    const listing = await createListingFixture({ withMedia: false });

    const { status, body } = await callPublication(listing.id, admin.cookie, { action: 'publish' });
    expect(status).toBe(409);
    expect(errorOf(body).code).toBe('CONFLICT');
    expect(errorOf(body).message).toMatch(/image/i);

    const { prisma } = await import('@/lib/db');
    const row = await prisma.businessListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { publicationStatus: true, publishedAt: true },
    });
    expect(row.publicationStatus).toBe('DRAFT');
    expect(row.publishedAt).toBeNull();
  });

  it('refuses to publish a listing with no description', async () => {
    const admin = await signInAsAdmin();
    const listing = await createListingFixture({ description: null });

    const { status, body } = await callPublication(listing.id, admin.cookie, { action: 'publish' });
    expect(status).toBe(409);
    expect(errorOf(body).code).toBe('CONFLICT');
    expect(errorOf(body).message).toMatch(/description/i);

    const { prisma } = await import('@/lib/db');
    const row = await prisma.businessListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { publicationStatus: true },
    });
    expect(row.publicationStatus).toBe('DRAFT');
  });

  it('publishes a listing that satisfies both requirements and writes an audit row', async () => {
    const admin = await signInAsAdmin();
    const listing = await createListingFixture();

    const { status, body } = await callPublication(listing.id, admin.cookie, {
      action: 'publish',
      reason: 'Ready to go live',
    });

    expect(status).toBe(200);
    expect(body.data.id).toBe(listing.id);
    expect(body.data.publicationStatus).toBe('PUBLISHED');
    expect(body.data.publishedAt).not.toBeNull();

    const { prisma } = await import('@/lib/db');
    const row = await prisma.businessListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { publicationStatus: true, publishedAt: true, archivedAt: true },
    });
    expect(row.publicationStatus).toBe('PUBLISHED');
    expect(row.publishedAt).not.toBeNull();
    expect(row.archivedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'listing.published', entityId: listing.id },
      select: { actorUserId: true, metadata: true },
    });
    expect(audit?.actorUserId).toBe(admin.userId);
    expect(audit?.metadata).toMatchObject({ reason: 'Ready to go live' });
  });

  it('refuses to publish an already published listing', async () => {
    const admin = await signInAsAdmin();
    const listing = await createListingFixture();

    const first = await callPublication(listing.id, admin.cookie, { action: 'publish' });
    expect(first.status).toBe(200);

    const second = await callPublication(listing.id, admin.cookie, { action: 'publish' });
    expect(second.status).toBe(409);
    expect(errorOf(second.body).code).toBe('CONFLICT');
  });

  it('moves a published listing through unpublish, archive and restore', async () => {
    const admin = await signInAsAdmin();
    const listing = await createListingFixture();
    const { prisma } = await import('@/lib/db');

    await callPublication(listing.id, admin.cookie, { action: 'publish' });

    const unpublished = await callPublication(listing.id, admin.cookie, { action: 'unpublish' });
    expect(unpublished.status).toBe(200);
    expect(unpublished.body.data.publicationStatus).toBe('UNPUBLISHED');

    const archived = await callPublication(listing.id, admin.cookie, { action: 'archive' });
    expect(archived.status).toBe(200);
    expect(archived.body.data.publicationStatus).toBe('ARCHIVED');
    let row = await prisma.businessListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { publicationStatus: true, archivedAt: true },
    });
    expect(row.archivedAt).not.toBeNull();

    const restored = await callPublication(listing.id, admin.cookie, { action: 'restore' });
    expect(restored.status).toBe(200);
    expect(restored.body.data.publicationStatus).toBe('DRAFT');
    row = await prisma.businessListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { publicationStatus: true, archivedAt: true },
    });
    expect(row.publicationStatus).toBe('DRAFT');
    expect(row.archivedAt).toBeNull();
  });

  it('rejects an unknown publication action', async () => {
    const admin = await signInAsAdmin();
    const listing = await createListingFixture();
    const { status, body } = await callPublication(listing.id, admin.cookie, { action: 'explode' });
    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');
  });
});
