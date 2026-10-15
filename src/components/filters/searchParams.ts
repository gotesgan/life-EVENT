/**
 * Collapses a Next.js `searchParams` object into the flat string record the
 * search schema and the client helpers expect, and repairs values that cannot
 * be honoured.
 *
 * A repeated parameter (`?eventType=a&eventType=b`) arrives as an array; the
 * schema's CSV fields expect a single comma-separated string, so arrays are
 * joined with a comma — the exact encoding `csvParam` in
 * `@/lib/validation/search` parses back.
 *
 * ## Why this also clamps
 *
 * The API validates strictly and returns 400 for a malformed query, which is
 * right for a contract. A *page* is not a contract: `?priceMin=5000.5`, or a
 * query string truncated by a chat client, used to fail validation, and the
 * results route then rendered an error state that replaced the entire results
 * page — sidebar, filters and the user's typed input included. The URL is
 * user-editable and linkable, so a page has to degrade: drop the value that
 * cannot be honoured and run the search anyway.
 *
 * Repaired values are clamped to the schema's own bounds, so anything that
 * survives this function always validates.
 */
import { LISTING_SORT_OPTIONS } from '@/lib/validation/search';

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Mirrors `searchQuerySchema`. Shared with the API, so keep the numbers in step. */
const MAX_TEXT_LENGTH = 120;
const MIN_QUERY_LENGTH = 2;
const MAX_NUMBER = 100_000_000;

const TEXT_KEYS = new Set(['q', 'category', 'location']);
const CSV_KEYS = new Set(['eventType', 'amenity']);
const NUMBER_KEYS = new Set(['priceMin', 'priceMax', 'capacityMin', 'capacityMax']);

/**
 * Coerces one value into something the schema accepts, or drops it.
 *
 * Returns `undefined` when the value cannot be salvaged — an unparseable number,
 * a sort key that does not exist — rather than substituting a default, because a
 * default would silently change what the user asked for.
 */
function repairValue(key: string, value: string): string | undefined {
  if (TEXT_KEYS.has(key)) {
    const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH);
    // A one-character query is below the server's minimum. Dropping it keeps the
    // applied-filter chips honest: it is not a filter the server applied, so it
    // must not be displayed as one.
    if (trimmed === '') return undefined;
    if (key === 'q' && trimmed.length < MIN_QUERY_LENGTH) return undefined;
    return trimmed;
  }

  if (CSV_KEYS.has(key)) {
    const parts = value
      .split(',')
      .map((part) => part.trim().slice(0, MAX_TEXT_LENGTH))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(',') : undefined;
  }

  if (NUMBER_KEYS.has(key)) {
    // Truncate rather than round: a budget of 5000.9 is a budget of 5000, and
    // rounding up could exclude a listing the user meant to include.
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed)) return undefined;

    return String(Math.min(Math.max(Math.trunc(parsed), 0), MAX_NUMBER));
  }

  if (key === 'sort') {
    return (LISTING_SORT_OPTIONS as readonly string[]).includes(value) ? value : undefined;
  }

  return value;
}

export function normaliseSearchParams(raw: RawSearchParams): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const joined = Array.isArray(value) ? value.filter(Boolean).join(',') : value;
    if (joined === '') continue;

    const repaired = repairValue(key, joined);
    if (repaired === undefined) continue;

    result[key] = repaired;
  }

  return result;
}
