import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { LISTING_SORT_OPTIONS, searchQuerySchema, type ListingSort } from '@/lib/validation/search';
import { buildListingOrderBy } from '@/server/domain/search-filters';
import {
  createTestAdmin,
  attachCoverMedia,
  requireCategoryId,
  requireLocationId,
  uniqueSlug,
  uniqueSuffix,
} from './helpers';
import { adminCreateListing, adminSetPublicationStatus } from '@/server/services/listing.service';
import { adminSetListingAttributeValues } from '@/server/services/attribute.service';
import { listingCreateSchema } from '@/lib/validation/listing';
import {
  resolveCategorySubtreeIds,
  resolveLocationSubtreeIds,
} from '@/server/services/catalog.service';
import { searchPublicListings } from '@/server/services/search.service';
import type { AdminActorContext } from '@/server/services/listing.service';

async function newActor(): Promise<AdminActorContext> {
  const admin = await createTestAdmin('search-admin');
  return admin.actor;
}

async function runSearch(
  overrides: Record<string, unknown> & {
    rawParams?: Record<string, string | string[] | undefined>;
  } = {},
) {
  const { rawParams, ...queryOverrides } = overrides;
  const query = searchQuerySchema.parse(queryOverrides);

  return searchPublicListings({
    query,
    rawParams: rawParams ?? {},
    basePath: '/vendors',
  });
}

interface PublishedListingOptions {
  categorySlug?: string;
  locationSlug?: string;
  name?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  description?: string;
  publish?: boolean;
}

async function createPublishedListing(options: PublishedListingOptions = {}) {
  const actor = await newActor();
  const input = listingCreateSchema.parse({
    name: options.name ?? `Search Fixture ${uniqueSuffix()}`,
    primaryCategoryId: await requireCategoryId(options.categorySlug ?? 'photographers'),
    primaryLocationId: await requireLocationId(options.locationSlug ?? 'bandra-west'),
    description: options.description ?? 'A searchable fixture description',
    priceMin: options.priceMin ?? null,
    priceMax: options.priceMax ?? null,
  });

  const created = await adminCreateListing(input, actor);
  await attachCoverMedia(created.id);

  if (options.publish !== false) {
    await adminSetPublicationStatus(created.id, 'publish', actor);
  }

  return { ...created, actor };
}

describe('category-only search', () => {
  it('returns only listings inside the category subtree and only published ones', async () => {
    const subtree = new Set(await resolveCategorySubtreeIds('venues'));

    const result = await runSearch({ category: 'venues', pageSize: 48 });

    expect(result.pagination.totalItems).toBeGreaterThan(0);
    expect(result.cards.length).toBeGreaterThan(0);

    const rows = await prisma.businessListing.findMany({
      where: { id: { in: result.cards.map((card) => card.id) } },
      select: {
        id: true,
        publicationStatus: true,
        archivedAt: true,
        categories: { select: { categoryId: true } },
      },
    });

    for (const row of rows) {
      expect(row.publicationStatus).toBe('PUBLISHED');
      expect(row.archivedAt).toBeNull();
      expect(row.categories.some((category) => subtree.has(category.categoryId))).toBe(true);
    }

    const seeded = await prisma.businessListing.findUniqueOrThrow({
      where: { slug: 'gulmohar-banjara-banquets' },
      select: { id: true },
    });
    expect(result.cards.map((card) => card.id)).toContain(seeded.id);
  });

  it('throws for an unknown category rather than returning everything', async () => {
    await expect(runSearch({ category: 'not-a-category' })).rejects.toBeDefined();
  });
});

describe('city filtering', () => {
  it('narrows the category result set and matches primary location or a service area', async () => {
    const all = await runSearch({ category: 'venues', pageSize: 48 });
    const inMumbai = await runSearch({ category: 'venues', location: 'mumbai', pageSize: 48 });

    expect(inMumbai.pagination.totalItems).toBeLessThanOrEqual(all.pagination.totalItems);

    const mumbaiIds = new Set(await resolveLocationSubtreeIds('mumbai'));
    const rows = await prisma.businessListing.findMany({
      where: { id: { in: inMumbai.cards.map((card) => card.id) } },
      select: {
        id: true,
        primaryLocationId: true,
        serviceAreas: { select: { locationId: true } },
      },
    });

    for (const row of rows) {
      const matches =
        mumbaiIds.has(row.primaryLocationId) ||
        row.serviceAreas.some((area) => mumbaiIds.has(area.locationId));
      expect(matches).toBe(true);
    }
  });

  it('includes a listing whose service area is a different city than its base', async () => {
    // Seeded: the-second-light-collective is based in Koramangala (Bengaluru)
    // but lists Pune and Mumbai as service areas.
    const result = await runSearch({ category: 'photography', location: 'pune', pageSize: 48 });

    expect(result.cards.map((card) => card.slug)).toContain('the-second-light-collective');
  });
});

describe('combined filters', () => {
  it('returns the intersection of a category attribute, a city and a price range', async () => {
    // A dedicated attribute + option keeps the expected set exact: no seeded
    // listing can satisfy a value that is unique to this run.
    const attributeCode = uniqueSlug('search-style');
    const optionValue = `needle-${uniqueSuffix()}`;
    const attribute = await prisma.attributeDefinition.create({
      data: { code: attributeCode, label: 'Search Style', dataType: 'MULTI_SELECT' },
      select: { id: true },
    });
    await prisma.attributeOption.create({
      data: { attributeId: attribute.id, value: optionValue, label: 'Needle' },
    });
    await prisma.categoryAttribute.create({
      data: {
        categoryId: await requireCategoryId('photographers'),
        attributeId: attribute.id,
        isFilterable: true,
        isVisibleOnProfile: true,
      },
    });

    const tagged = await createPublishedListing({
      locationSlug: 'bandra-west',
      priceMin: 100_000,
      priceMax: 200_000,
    });
    const tooExpensive = await createPublishedListing({
      locationSlug: 'bandra-west',
      priceMin: 800_000,
      priceMax: 900_000,
    });
    const wrongCity = await createPublishedListing({
      locationSlug: 'baner',
      priceMin: 100_000,
      priceMax: 200_000,
    });
    const untagged = await createPublishedListing({
      locationSlug: 'bandra-west',
      priceMin: 100_000,
      priceMax: 200_000,
    });

    for (const listing of [tagged, tooExpensive, wrongCity]) {
      await adminSetListingAttributeValues({
        listingId: listing.id,
        values: [{ attributeId: attribute.id, optionValues: [optionValue] }],
        actor: listing.actor,
      });
    }

    const result = await runSearch({
      category: 'photographers',
      location: 'mumbai',
      priceMin: 100_000,
      priceMax: 300_000,
      pageSize: 48,
      rawParams: { [`f.${attributeCode}`]: optionValue },
    });

    expect(new Set(result.cards.map((card) => card.id))).toEqual(new Set([tagged.id]));
    // A listing that satisfies city and price but not the attribute is excluded.
    expect(result.cards.map((card) => card.id)).not.toContain(untagged.id);

    // Every returned row really does satisfy all three constraints.
    const row = await prisma.businessListing.findUniqueOrThrow({
      where: { id: tagged.id },
      select: {
        priceMin: true,
        priceMax: true,
        primaryLocationId: true,
        attributeValues: { where: { attributeId: attribute.id }, select: { optionIds: true } },
      },
    });
    expect(row.priceMin).toBe(100_000);
    expect(row.priceMax).toBe(200_000);
    expect(row.primaryLocationId).toBe(await requireLocationId('bandra-west'));
    expect(row.attributeValues[0]?.optionIds).toHaveLength(1);
  });

  it('rejects an attribute filter when no category is active', async () => {
    await expect(
      runSearch({ rawParams: { 'f.photography_style': 'candid' } }),
    ).rejects.toBeDefined();
  });
});

describe('pagination and result-count agreement', () => {
  it('reports a total that matches the union of every page', async () => {
    const pageSize = 2;
    const first = await runSearch({ category: 'venues', pageSize, page: 1 });
    const total = first.pagination.totalItems;

    expect(total).toBeGreaterThan(0);
    expect(first.pagination.totalPages).toBe(Math.ceil(total / pageSize));

    const seen = new Set<string>();
    let collected = 0;

    for (let page = 1; page <= first.pagination.totalPages; page += 1) {
      const result = await runSearch({ category: 'venues', pageSize, page });

      expect(result.pagination.totalItems).toBe(total);

      const isFullPage = page < first.pagination.totalPages;
      if (isFullPage) {
        expect(result.cards.length).toBe(pageSize);
      }
      // The reported total is the size of the whole result set, never the size
      // of this page, so it must be at least the number of rows returned so far
      // (it is asserted to equal `total` on every page above).
      expect(result.pagination.totalItems).toBeGreaterThanOrEqual(
        (page - 1) * pageSize + result.cards.length,
      );

      for (const card of result.cards) {
        expect(seen.has(card.id)).toBe(false);
        seen.add(card.id);
        collected += 1;
      }
    }

    expect(collected).toBe(total);
    expect(seen.size).toBe(total);
  });

  it('never repeats a listing between page 1 and page 2', async () => {
    const pageSize = 2;
    const first = await runSearch({ pageSize, page: 1 });
    const second = await runSearch({ pageSize, page: 2 });

    expect(first.cards).toHaveLength(pageSize);
    expect(second.cards).toHaveLength(pageSize);

    const firstIds = new Set(first.cards.map((card) => card.id));
    for (const card of second.cards) {
      expect(firstIds.has(card.id)).toBe(false);
    }
  });

  it('rejects a pageSize above the cap at the schema boundary', () => {
    expect(() => searchQuerySchema.parse({ pageSize: 49 })).toThrow();
    expect(() => searchQuerySchema.parse({ pageSize: 0 })).toThrow();
    expect(() => searchQuerySchema.parse({ pageSize: -5 })).toThrow();
    expect(searchQuerySchema.parse({ pageSize: 48 }).pageSize).toBe(48);
  });
});

describe('sorting', () => {
  it('orders price_asc non-decreasing with unknown prices last', async () => {
    const result = await runSearch({ sort: 'price_asc', pageSize: 48 });
    const prices = result.cards
      .map((card) => card.priceMin)
      .filter((price): price is number => price !== null);

    for (let index = 1; index < prices.length; index += 1) {
      expect(prices[index]!).toBeGreaterThanOrEqual(prices[index - 1]!);
    }

    const firstNull = result.cards.findIndex((card) => card.priceMin === null);
    if (firstNull !== -1) {
      expect(result.cards.slice(firstNull).every((card) => card.priceMin === null)).toBe(true);
    }
  });

  it('orders price_desc non-increasing', async () => {
    const result = await runSearch({ sort: 'price_desc', pageSize: 48 });
    const prices = result.cards
      .map((card) => card.priceMin)
      .filter((price): price is number => price !== null);

    for (let index = 1; index < prices.length; index += 1) {
      expect(prices[index]!).toBeLessThanOrEqual(prices[index - 1]!);
    }
  });

  it('orders newest by publishedAt descending', async () => {
    const result = await runSearch({ sort: 'newest', pageSize: 48 });
    const rows = await prisma.businessListing.findMany({
      where: { id: { in: result.cards.map((card) => card.id) } },
      select: { id: true, publishedAt: true },
    });
    const publishedAtById = new Map(rows.map((row) => [row.id, row.publishedAt]));

    const times = result.cards.map((card) => publishedAtById.get(card.id)?.getTime() ?? 0);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index]!).toBeLessThanOrEqual(times[index - 1]!);
    }
  });

  it('orders name_asc exactly as the whitelisted clause does', async () => {
    const result = await runSearch({ sort: 'name_asc', pageSize: 48 });
    const expected = await prisma.businessListing.findMany({
      where: { publicationStatus: 'PUBLISHED', archivedAt: null },
      orderBy: buildListingOrderBy('name_asc'),
      take: 48,
      select: { id: true },
    });

    expect(result.cards.map((card) => card.id)).toEqual(expected.map((row) => row.id));
  });

  it('places featured listings first for the recommended sort', async () => {
    const result = await runSearch({ sort: 'recommended', pageSize: 48 });
    let seenNonFeatured = false;

    for (const card of result.cards) {
      if (!card.isFeatured) seenNonFeatured = true;
      else expect(seenNonFeatured).toBe(false);
    }
  });

  it('ends every allowed sort with the deterministic id tie-break', () => {
    for (const sort of LISTING_SORT_OPTIONS) {
      expect(buildListingOrderBy(sort).at(-1)).toEqual({ id: 'asc' });
    }
  });

  it('falls back to recommended for an unknown sort', () => {
    expect(buildListingOrderBy('bogus' as unknown as ListingSort)).toEqual(
      buildListingOrderBy('recommended'),
    );
  });
});

describe('unpublished listings never leak into search', () => {
  it('hides a draft, an unpublished and an archived fixture', async () => {
    const draft = await createPublishedListing({ publish: false });
    const unpublished = await createPublishedListing({});
    await adminSetPublicationStatus(unpublished.id, 'unpublish', unpublished.actor);
    const archived = await createPublishedListing({});
    await adminSetPublicationStatus(archived.id, 'archive', archived.actor);

    const hiddenIds = new Set([draft.id, unpublished.id, archived.id]);
    const result = await runSearch({ category: 'photographers', pageSize: 48 });

    for (const card of result.cards) {
      expect(hiddenIds.has(card.id)).toBe(false);
    }
  });

  it('hides the seeded drafts and unpublished listings', async () => {
    const cases: Array<{ category: string; slug: string }> = [
      { category: 'venues', slug: 'navrang-convention-centre' },
      { category: 'photography', slug: 'chitrakatha-films' },
      { category: 'beauty', slug: 'saffron-threads-styling' },
      { category: 'rentals-and-transport', slug: 'raatrani-rovers' },
    ];

    for (const testCase of cases) {
      const result = await runSearch({ category: testCase.category, pageSize: 48 });
      expect(result.cards.map((card) => card.slug)).not.toContain(testCase.slug);
    }
  });
});

describe('appliedFilters chips', () => {
  it('produces one chip per active filter and each removeHref drops only its own key', async () => {
    const eventType = await prisma.eventType.findFirstOrThrow({ select: { slug: true } });
    const amenity = await prisma.amenity.findFirstOrThrow({ select: { code: true } });

    const rawParams: Record<string, string> = {
      category: 'photographers',
      q: 'studio',
      location: 'mumbai',
      eventType: eventType.slug,
      verified: 'true',
      priceMin: '100000',
      priceMax: '300000',
      capacityMin: '50',
      capacityMax: '500',
      amenity: amenity.code,
      'f.photography_style': 'candid',
    };
    const originalKeys = new Set(Object.keys(rawParams));

    const result = await runSearch({
      category: 'photographers',
      q: 'studio',
      location: 'mumbai',
      eventType: eventType.slug,
      verified: 'true',
      priceMin: 100_000,
      priceMax: 300_000,
      capacityMin: 50,
      capacityMax: 500,
      amenity: amenity.code,
      pageSize: 12,
      rawParams,
    });

    const chipOwnKeys: Record<string, string[]> = {
      q: ['q'],
      location: ['location'],
      [`eventType:${eventType.slug}`]: ['eventType'],
      verified: ['verified'],
      price: ['priceMin', 'priceMax'],
      capacity: ['capacityMin', 'capacityMax'],
      [`amenity:${amenity.code}`]: ['amenity'],
      photography_style: ['f.photography_style'],
    };

    const codes = result.appliedFilters.map((chip) => chip.code);
    expect(codes.sort()).toEqual(Object.keys(chipOwnKeys).sort());
    expect(result.activeFilterCount).toBe(Object.keys(chipOwnKeys).length);
    expect(result.appliedFilters).toHaveLength(result.activeFilterCount);

    for (const chip of result.appliedFilters) {
      const own = chipOwnKeys[chip.code];
      expect(own).toBeDefined();

      const queryString = chip.removeHref.split('?')[1] ?? '';
      const remaining = new Set(new URLSearchParams(queryString).keys());
      const expected = new Set([...originalKeys].filter((key) => !own!.includes(key)));

      expect([...remaining].sort()).toEqual([...expected].sort());
      for (const key of own!) {
        expect(remaining.has(key)).toBe(false);
      }
    }
  });

  it('does not add a chip for an inactive filter', async () => {
    const result = await runSearch({ category: 'photographers', pageSize: 12 });

    expect(result.appliedFilters).toEqual([]);
    expect(result.activeFilterCount).toBe(0);
  });
});
