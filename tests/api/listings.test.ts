import { beforeEach, describe, expect, it } from 'vitest';
import { GET as listListings } from '@/app/api/listings/route';
import { GET as getListingBySlug } from '@/app/api/listings/[slug]/route';
import {
  SEEDED_LISTINGS,
  clearRuntimeState,
  makeRequest,
  readJson,
  routeContext,
  type ApiErrorResponse,
} from './api-helpers';

interface SearchBody {
  cards: Array<{ slug: string; isVerified: boolean; name: string; isNameHidden?: boolean }>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  appliedFilters: Array<{ code: string }>;
  activeFilterCount: number;
}

interface ListingDetailBody {
  data: { slug: string; publicationStatus: string };
}

async function search(query: string) {
  const response = await listListings(makeRequest(`/api/listings${query}`), routeContext({}));
  return { status: response.status, body: await readJson<SearchBody>(response) };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('GET /api/listings', () => {
  it('returns only published, non-archived listings', async () => {
    const { prisma } = await import('@/lib/db');
    const published = await prisma.businessListing.findMany({
      where: { publicationStatus: 'PUBLISHED', archivedAt: null },
      select: { slug: true },
    });
    const publishedSlugs = new Set(published.map((row) => row.slug));

    const { status, body } = await search('?pageSize=48');
    expect(status).toBe(200);
    expect(body.pagination.totalItems).toBe(publishedSlugs.size);
    expect(body.cards).toHaveLength(publishedSlugs.size);
  });

  /**
   * The enquiry gate, asserted at the API boundary.
   *
   * An anonymous client must receive the anonymous identity: no trading name and
   * no name-bearing slug. The site's own forms post the opaque `ul_` reference,
   * so that is the identifier these payloads carry until the reveal cookie is
   * present.
   */
  it('masks a listing identity until the reveal cookie is present', async () => {
    const { status, body } = await search('?pageSize=48');
    expect(status).toBe(200);

    for (const card of body.cards) {
      expect(card.isNameHidden).toBe(true);
      expect(card.slug).toMatch(/^ul_[a-z0-9]+$/);
      // A masked card's name is a category + locality label, never a trade name.
      expect(card.name).not.toContain('Gulmohar');
      expect(card.name).not.toContain('Sandalwood');
    }
  });

  it('exposes the real identity once the visitor has enquired', async () => {
    const { prisma } = await import('@/lib/db');
    const listing = await prisma.businessListing.findUniqueOrThrow({
      where: { slug: SEEDED_LISTINGS.published },
      select: { slug: true, name: true },
    });

    const { sealRevealedSlugs, REVEAL_COOKIE } = await import('@/lib/listing-privacy');
    const response = await listListings(
      makeRequest(`/api/listings?pageSize=48`, {
        headers: { cookie: `${REVEAL_COOKIE}=${sealRevealedSlugs([listing.slug])}` },
      }),
      routeContext({}),
    );
    const body = await readJson<SearchBody>(response);
    const revealed = body.cards.find((card) => card.slug === listing.slug);

    expect(revealed, 'the revealed listing should be addressable by its real slug').toBeTruthy();
    expect(revealed?.name).toBe(listing.name);

    // Every other card stays masked, so the unlock is per-listing rather than a
    // global "this visitor may see all names" switch.
    for (const card of body.cards) {
      if (card.slug === listing.slug) continue;
      expect(card.isNameHidden).toBe(true);
    }
  });

  it('narrows results when filters are combined', async () => {
    const baseline = await search('?pageSize=48');
    const filtered = await search('?pageSize=48&category=venues&verified=true');

    expect(filtered.status).toBe(200);
    expect(filtered.body.pagination.totalItems).toBeGreaterThan(0);
    expect(filtered.body.pagination.totalItems).toBeLessThanOrEqual(
      baseline.body.pagination.totalItems,
    );
    for (const card of filtered.body.cards) {
      expect(card.isVerified).toBe(true);
    }
  });

  it('rejects an unknown attribute filter, listing the allowed codes', async () => {
    const { status, body } = await search('?category=banquet-halls&f.nope=1');
    expect(status).toBe(400);

    const error = errorOf(body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toMatchObject({ unknown: ['nope'] });
    const allowed = (error.details as { allowed: string[] }).allowed;
    expect(allowed).toContain('guest_capacity');
  });

  it('rejects an attribute filter without a category', async () => {
    const { status, body } = await search('?f.guest_capacity=100');
    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an inverted numeric range', async () => {
    const { status, body } = await search('?category=banquet-halls&f.guest_capacity=500-100');
    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');
  });

  it('does not repeat rows across pages', async () => {
    const first = await search('?pageSize=2&page=1');
    const second = await search('?pageSize=2&page=2');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstSlugs = first.body.cards.map((card) => card.slug);
    const secondSlugs = second.body.cards.map((card) => card.slug);

    expect(firstSlugs).toHaveLength(2);
    expect(secondSlugs.length).toBeGreaterThan(0);
    for (const slug of secondSlugs) {
      expect(firstSlugs).not.toContain(slug);
    }
    expect(second.body.pagination.hasPreviousPage).toBe(true);
  });

  it('rejects a page size above the cap', async () => {
    const { status, body } = await search('?pageSize=49');
    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/listings/[slug]', () => {
  it('returns 404 for a draft listing', async () => {
    const response = await getListingBySlug(
      makeRequest(`/api/listings/${SEEDED_LISTINGS.draft}`),
      routeContext({ slug: SEEDED_LISTINGS.draft }),
    );
    expect(response.status).toBe(404);
    expect(errorOf(await readJson(response)).code).toBe('NOT_FOUND');
  });

  it('returns a published listing', async () => {
    const response = await getListingBySlug(
      makeRequest(`/api/listings/${SEEDED_LISTINGS.published}`),
      routeContext({ slug: SEEDED_LISTINGS.published }),
    );
    expect(response.status).toBe(200);

    const body = await readJson<ListingDetailBody>(response);
    expect(body.data.slug).toBe(SEEDED_LISTINGS.published);
    expect(body.data.publicationStatus).toBe('PUBLISHED');
  });
});
