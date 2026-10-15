import { describe, expect, it } from 'vitest';
import { formatCapacityRange, formatCurrency, formatDate, formatPriceRange } from '@/lib/format';
import { normaliseSearchText } from '@/server/domain/search-filters';
import {
  ATTRIBUTE_FILTER_PREFIX,
  buildSearchQueryString,
  extractAttributeFilterParams,
  searchQuerySchema,
} from '@/lib/validation/search';

/**
 * Client-safe environment surface.
 *
 * The project has no module literally named `client-env`; the modules a Client
 * Component imports are `@/lib/format`, the pure search-normalisation helper in
 * `@/server/domain/search-filters` and the URL-state helpers in
 * `@/lib/validation/search`. This suite pins the two guarantees those modules
 * must keep: they are pure (no hidden state or I/O) and they normalise text the
 * way the server does, so a client-rendered value cannot disagree with the
 * server.
 */

describe('formatting helpers are pure', () => {
  it('formatPriceRange returns an equal result on every call', () => {
    const input = { priceMin: 1_200, priceMax: 4_200, priceUnit: 'PER_PLATE' as const };
    const frozen = { ...input };

    const results = [formatPriceRange(input), formatPriceRange(input), formatPriceRange(input)];

    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    expect(input).toEqual(frozen);
  });

  it('formatCapacityRange returns an equal result on every call', () => {
    expect(formatCapacityRange(100, 200)).toBe(formatCapacityRange(100, 200));
    expect(formatCapacityRange(null, null)).toBe(formatCapacityRange(null, null));
  });

  it('formatDate is pure and does not mutate its Date argument', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const time = date.getTime();

    expect(formatDate(date)).toBe(formatDate(date));
    expect(date.getTime()).toBe(time);
  });

  it('formatCurrency is pure for the same amount', () => {
    expect(formatCurrency(50_000)).toBe(formatCurrency(50_000));
  });

  it('does not accumulate state across calls with different inputs', () => {
    const first = formatPriceRange({ priceMin: 100, priceMax: null, priceUnit: null });
    formatPriceRange({ priceMin: 999, priceMax: 1_000, priceUnit: 'PER_EVENT' });
    const second = formatPriceRange({ priceMin: 100, priceMax: null, priceUnit: null });

    expect(second).toBe(first);
  });
});

describe('normaliseSearchText collapses whitespace and lowercases', () => {
  it('lowercases and collapses runs of whitespace to a single space', () => {
    expect(normaliseSearchText('  The   GRAND\n\tSandalwood  ')).toBe('the grand sandalwood');
  });

  it('collapses non-breaking and repeated spaces', () => {
    expect(normaliseSearchText('a\u00a0\u00a0b   c')).toBe('a b c');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normaliseSearchText('   \n\t  ')).toBe('');
  });

  it('is idempotent, so a normalised value can be safely re-normalised', () => {
    const once = normaliseSearchText('  Hello   WORLD ');
    expect(normaliseSearchText(once)).toBe(once);
  });

  it('matches the normalisation the search builder applies to a query', () => {
    // The builder stores and queries lowercase, whitespace-collapsed text; a
    // client that pre-normalises must produce the same string.
    expect(normaliseSearchText('Rooftop  GARDEN')).toBe('rooftop garden');
  });
});

describe('search URL-state helpers are pure and round-trip', () => {
  it('extracts only f.-prefixed parameters and trims them', () => {
    const raw = {
      'f.style': ' candid , documentary ',
      'f.empty': '   ',
      'f.': 'ignored',
      page: '2',
      q: 'garden',
    };

    expect(extractAttributeFilterParams(raw)).toEqual({
      style: ['candid , documentary'],
    });
  });

  it('accepts array-valued parameters and drops blanks', () => {
    expect(extractAttributeFilterParams({ 'f.amenity': ['parking', ' ', 'valet'] })).toEqual({
      amenity: ['parking', 'valet'],
    });
  });

  it('buildSearchQueryString omits false and undefined base values', () => {
    const query = buildSearchQueryString(
      { category: 'venues', verified: false, q: undefined, sort: 'price_asc' },
      {},
    );
    const params = new URLSearchParams(query);

    expect(params.get('category')).toBe('venues');
    expect(params.get('sort')).toBe('price_asc');
    expect(params.has('verified')).toBe(false);
    expect(params.has('q')).toBe(false);
  });

  it('serialises attribute filters under the reserved prefix', () => {
    const query = buildSearchQueryString(
      { category: 'venues' },
      { style: ['candid', 'documentary'] },
    );
    const params = new URLSearchParams(query);

    expect(params.get(`${ATTRIBUTE_FILTER_PREFIX}style`)).toBe('candid,documentary');
  });

  it('is repeatable for the same input', () => {
    const base = { category: 'venues', page: 2 };
    const filters = { style: ['candid'] };

    expect(buildSearchQueryString(base, filters)).toBe(buildSearchQueryString(base, filters));
  });

  it('a query string built by the client parses back into the server schema', () => {
    const query = buildSearchQueryString(
      { category: 'venues', location: 'mumbai', priceMax: 1_000_000, sort: 'price_asc' },
      { venue_type: 'banquet-hall' },
    );
    const parsed = searchQuerySchema.parse(Object.fromEntries(new URLSearchParams(query)));

    expect(parsed).toMatchObject({
      category: 'venues',
      location: 'mumbai',
      priceMax: 1_000_000,
      sort: 'price_asc',
    });
    expect(extractAttributeFilterParams(Object.fromEntries(new URLSearchParams(query)))).toEqual({
      venue_type: ['banquet-hall'],
    });
  });
});
