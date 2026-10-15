import { beforeEach, describe, expect, it } from 'vitest';
import { PATCH as patchAmenity } from '@/app/api/admin/catalog/amenities/[id]/route';
import { PATCH as patchCategory } from '@/app/api/admin/catalog/categories/[id]/route';
import { PATCH as patchEventType } from '@/app/api/admin/catalog/event-types/[id]/route';
import { PATCH as patchLocation } from '@/app/api/admin/catalog/locations/[id]/route';
import { GET as listListings } from '@/app/api/listings/route';
import {
  clearRuntimeState,
  jsonRequest,
  makeRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  withCookie,
} from './api-helpers';
import { uniqueSlug } from '../integration/helpers';

/**
 * Catalogue renames must refresh the denormalised `searchText` of every listing
 * that references the renamed entity.
 *
 * `searchText` embeds names copied from categories, locations, event types and
 * amenities. A rename that skipped the refresh left the trigram haystack holding
 * a word that no longer existed anywhere, so search matched the old name and
 * missed the new one. These tests drive the real admin PATCH routes and assert
 * the observable outcome: the new name is findable through public search and the
 * previous name is not.
 */

interface SearchBody {
  cards: Array<{ id: string; slug: string }>;
  pagination: { page: number; totalPages: number; totalItems: number };
}

async function searchTextOf(listingId: string): Promise<string> {
  const { prisma } = await import('@/lib/db');
  const row = await prisma.businessListing.findUniqueOrThrow({
    where: { id: listingId },
    select: { searchText: true },
  });
  return row.searchText ?? '';
}

/** Collects every id matching a text query, across pages. */
async function searchAllPages(token: string): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;

  for (;;) {
    const response = await listListings(
      makeRequest(`/api/listings?q=${encodeURIComponent(token)}&pageSize=48&page=${page}`),
      routeContext({}),
    );
    expect(response.status).toBe(200);
    const body = await readJson<SearchBody>(response);

    ids.push(...body.cards.map((card) => card.id));

    if (page >= body.pagination.totalPages || page > 20 || body.cards.length === 0) break;
    page += 1;
  }

  return ids;
}

/**
 * Renames `entityId` through `patch` twice and asserts that each rename is
 * reflected in the listing's searchText and in public search. The second rename
 * is what proves the previous name no longer matches.
 */
async function expectRenameRefreshesSearchText(
  listingId: string,
  entityId: string,
  patch: (id: string, name: string) => Promise<Response>,
): Promise<void> {
  const tokenA = uniqueSlug('rename-a');
  const tokenB = uniqueSlug('rename-b');
  const before = await searchTextOf(listingId);

  const first = await patch(entityId, tokenA);
  expect(first.status).toBe(200);

  const afterA = await searchTextOf(listingId);
  expect(afterA).not.toBe(before);
  expect(afterA).toContain(tokenA);
  expect(await searchAllPages(tokenA)).toContain(listingId);

  const second = await patch(entityId, tokenB);
  expect(second.status).toBe(200);

  const afterB = await searchTextOf(listingId);
  expect(afterB).toContain(tokenB);
  expect(afterB).not.toContain(tokenA);
  expect(await searchAllPages(tokenA)).not.toContain(listingId);
  expect(await searchAllPages(tokenB)).toContain(listingId);
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('catalogue renames refresh listing searchText', () => {
  it('refreshes when a category is renamed', async () => {
    const admin = await signInAsAdmin();
    const { prisma } = await import('@/lib/db');
    const listing = await prisma.businessListing.findFirstOrThrow({
      where: {
        publicationStatus: 'PUBLISHED',
        archivedAt: null,
        primaryCategoryId: { not: '' },
      },
      select: { id: true, primaryCategoryId: true },
      orderBy: { slug: 'asc' },
    });

    await expectRenameRefreshesSearchText(listing.id, listing.primaryCategoryId!, (id, name) =>
      patchCategory(
        jsonRequest(
          `/api/admin/catalog/categories/${id}`,
          'PATCH',
          { name },
          withCookie(admin.cookie),
        ),
        routeContext({ id }),
      ),
    );
  });

  it('refreshes when a location is renamed', async () => {
    const admin = await signInAsAdmin();
    const { prisma } = await import('@/lib/db');
    const listing = await prisma.businessListing.findFirstOrThrow({
      where: {
        publicationStatus: 'PUBLISHED',
        archivedAt: null,
        primaryLocationId: { not: '' },
      },
      select: { id: true, primaryLocationId: true },
      orderBy: { slug: 'asc' },
    });

    await expectRenameRefreshesSearchText(listing.id, listing.primaryLocationId!, (id, name) =>
      patchLocation(
        jsonRequest(
          `/api/admin/catalog/locations/${id}`,
          'PATCH',
          { name },
          withCookie(admin.cookie),
        ),
        routeContext({ id }),
      ),
    );
  });

  it('refreshes when an event type is renamed', async () => {
    const admin = await signInAsAdmin();
    const { prisma } = await import('@/lib/db');
    const listing = await prisma.businessListing.findFirstOrThrow({
      where: {
        publicationStatus: 'PUBLISHED',
        archivedAt: null,
        eventTypes: { some: {} },
      },
      select: { id: true, eventTypes: { select: { eventTypeId: true }, take: 1 } },
      orderBy: { slug: 'asc' },
    });

    await expectRenameRefreshesSearchText(
      listing.id,
      listing.eventTypes[0]!.eventTypeId,
      (id, name) =>
        patchEventType(
          jsonRequest(
            `/api/admin/catalog/event-types/${id}`,
            'PATCH',
            { name },
            withCookie(admin.cookie),
          ),
          routeContext({ id }),
        ),
    );
  });

  it('refreshes when an amenity is renamed', async () => {
    const admin = await signInAsAdmin();
    const { prisma } = await import('@/lib/db');
    const listing = await prisma.businessListing.findFirstOrThrow({
      where: {
        publicationStatus: 'PUBLISHED',
        archivedAt: null,
        amenities: { some: {} },
      },
      select: { id: true, amenities: { select: { amenityId: true }, take: 1 } },
      orderBy: { slug: 'asc' },
    });

    await expectRenameRefreshesSearchText(listing.id, listing.amenities[0]!.amenityId, (id, name) =>
      patchAmenity(
        jsonRequest(
          `/api/admin/catalog/amenities/${id}`,
          'PATCH',
          { label: name },
          withCookie(admin.cookie),
        ),
        routeContext({ id }),
      ),
    );
  });
});
