import { z } from 'zod';
import { paginationSchema } from '@/lib/pagination';

/**
 * Sorting. Only these values are accepted, and each maps to a concrete
 * order-by clause in the repository — user input is never interpolated into a
 * query.
 *
 * `recommended` is the default: featured listings first, then top picks,
 * then most recently published, with `id` as a deterministic
 * tie-break so pagination is stable across pages.
 */
export const LISTING_SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'newest',
  'name_asc',
] as const;

export type ListingSort = (typeof LISTING_SORT_OPTIONS)[number];

export const SORT_LABELS: Record<ListingSort, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Recently added',
  name_asc: 'Name A–Z',
};

const booleanParam = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((value) => value === 'true' || value === '1');

/** Comma-separated list, trimmed, blanks removed, de-duplicated, capped. */
const csvParam = z
  .string()
  .transform((value) =>
    Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ),
  )
  .pipe(z.array(z.string().min(1).max(80)).max(20));

const optionalNumber = z.coerce.number().int().min(0).max(100_000_000).optional();

/**
 * The shared part of the search contract, used by both the public listing
 * endpoint and the search results page. Category-specific attribute filters are
 * carried in `f.<attributeCode>` query parameters and validated separately,
 * because their meaning depends on the active category.
 */
export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  eventType: csvParam.optional(),
  verified: booleanParam.optional(),
  featured: booleanParam.optional(),
  amenity: csvParam.optional(),
  priceMin: optionalNumber,
  priceMax: optionalNumber,
  capacityMin: optionalNumber,
  capacityMax: optionalNumber,
  sort: z.enum(LISTING_SORT_OPTIONS).default('recommended'),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const ATTRIBUTE_FILTER_PREFIX = 'f.' as const;

/**
 * Pulls `f.<code>` parameters out of a raw query object.
 *
 * The prefix keeps category attribute filters from colliding with the reserved
 * core parameters (`page`, `sort`, `q`, ...), which means an attribute code can
 * never shadow a pagination key.
 */
export function extractAttributeFilterParams(
  raw: Record<string, string | string[] | undefined>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(ATTRIBUTE_FILTER_PREFIX)) continue;
    const code = key.slice(ATTRIBUTE_FILTER_PREFIX.length);
    if (!code) continue;

    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    const cleaned = values.map((v) => v.trim()).filter(Boolean);
    if (cleaned.length > 0) result[code] = cleaned;
  }

  return result;
}

/** Serialises filter state back into a query string (used by the UI). */
export function buildSearchQueryString(
  base: Record<string, string | number | boolean | undefined>,
  attributeFilters: Record<string, string | string[] | undefined> = {},
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || value === '' || value === false) continue;
    params.set(key, String(value));
  }

  for (const [code, value] of Object.entries(attributeFilters)) {
    const values = Array.isArray(value) ? value : [value];
    const cleaned = values.filter((v): v is string => Boolean(v));
    if (cleaned.length > 0) params.set(`${ATTRIBUTE_FILTER_PREFIX}${code}`, cleaned.join(','));
  }

  return params.toString();
}
