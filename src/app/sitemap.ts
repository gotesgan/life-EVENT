import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/env';
import { PAGINATION_DEFAULTS } from '@/lib/pagination';
import { searchQuerySchema } from '@/lib/validation/search';
import { listCategories, listLocations } from '@/server/services/catalog.service';
import { searchPublicListings } from '@/server/services/search.service';

/**
 * XML sitemap.
 *
 * Three finite families of URL plus one page per published listing:
 *
 *  - the static entry points (home, the full category and vendor lists, the trust
 *    pages);
 *  - every category page, including subcategories;
 *  - every city page, which in this product is `/vendors?location=<city>`;
 *  - every published listing.
 *
 * Filtered result sets are intentionally absent — `robots.ts` disallows them, and
 * a sitemap that advertised them would work against that.
 *
 * Listing URLs are read through the same public search the vendor page uses, so
 * drafts, archived and unpublished listings can never appear here.
 */

/** A ceiling on how many listing URLs one build will enumerate. */
const MAX_LISTING_URLS = 2000;

function flattenCategorySlugs(
  nodes: ReadonlyArray<{ slug: string; children: ReadonlyArray<{ slug: string }> }>,
): string[] {
  const slugs: string[] = [];
  for (const node of nodes) {
    slugs.push(node.slug);
    for (const child of node.children) slugs.push(child.slug);
  }
  return Array.from(new Set(slugs));
}

async function publishedListingEntries(base: string): Promise<MetadataRoute.Sitemap> {
  const pageSize = PAGINATION_DEFAULTS.maxPageSize;
  const maxPages = Math.ceil(MAX_LISTING_URLS / pageSize);
  const entries: MetadataRoute.Sitemap = [];

  const first = await searchPublicListings({
    query: searchQuerySchema.parse({ page: 1, pageSize, sort: 'recommended' }),
    rawParams: {},
    basePath: '/vendors',
  });

  const collect = (cards: ReadonlyArray<{ slug: string }>) => {
    for (const card of cards) {
      entries.push({
        url: `${base}/vendors/${encodeURIComponent(card.slug)}`,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  };

  collect(first.cards);

  const totalPages = Math.min(first.pagination.totalPages, maxPages);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await searchPublicListings({
      query: searchQuerySchema.parse({ page, pageSize, sort: 'recommended' }),
      rawParams: {},
      basePath: '/vendors',
    });
    collect(next.cards);
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/categories`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/vendors`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [categories, cities, listings] = await Promise.all([
    listCategories(),
    listLocations({ type: 'CITY' }),
    publishedListingEntries(base),
  ]);

  const categoryEntries: MetadataRoute.Sitemap = flattenCategorySlugs(categories).map((slug) => ({
    url: `${base}/categories/${encodeURIComponent(slug)}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const cityEntries: MetadataRoute.Sitemap = cities.map((city) => ({
    // The dedicated location landing page, which is now a real indexable route
    // rather than a filter permutation of the search results.
    url: `${base}/cities/${encodeURIComponent(city.slug)}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticEntries, ...categoryEntries, ...cityEntries, ...listings];
}
