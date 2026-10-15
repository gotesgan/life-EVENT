import { ATTRIBUTE_FILTER_PREFIX } from '@/lib/validation/search';

/**
 * Client-side URL state for the search results page.
 *
 * The URL is the single source of truth for filter state, so every helper here
 * is a pure function over a plain params record. That keeps "apply a filter",
 * "remove one chip", "clear all", "change page" and "change sort" consistent —
 * in particular, pagination and sorting always preserve the active filters,
 * because they are expressed as edits to the same object rather than rebuilt
 * from scratch.
 */
export type QueryParams = Record<string, string | undefined>;

/** Keys that describe *what* to show, not *which page* of it. */
const PAGINATION_KEYS = ['page'] as const;

export function parseQuery(search: string): QueryParams {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const result: QueryParams = {};

  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    if (all.length === 0) continue;
    result[key] = all.length > 1 ? all.join(',') : all[0];
  }

  return result;
}

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, value);
  }

  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
}

export function attributeKey(code: string): string {
  return `${ATTRIBUTE_FILTER_PREFIX}${code}`;
}

/** Values of a multi-value param as an array. */
export function readList(params: QueryParams, key: string): string[] {
  const value = params[key];
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function writeList(params: QueryParams, key: string, values: readonly string[]): QueryParams {
  const next = { ...params };
  if (values.length === 0) delete next[key];
  else next[key] = [...new Set(values)].join(',');
  return next;
}

export function toggleListValue(params: QueryParams, key: string, value: string): QueryParams {
  const current = readList(params, key);
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return resetPage(writeList(params, key, next));
}

export function setListValue(params: QueryParams, key: string, value: string): QueryParams {
  return resetPage(writeList(params, key, value ? [value] : []));
}

export function setSingleValue(
  params: QueryParams,
  key: string,
  value: string | undefined,
): QueryParams {
  const next = { ...params };
  if (!value) delete next[key];
  else next[key] = value;
  return resetPage(next);
}

export function toggleFlag(params: QueryParams, key: string): QueryParams {
  const next = { ...params };
  if (next[key] === 'true') delete next[key];
  else next[key] = 'true';
  return resetPage(next);
}

/**
 * Reads a numeric range filter back out of the URL.
 *
 * Mirrors the server's encoding exactly (`min-max`, `min-`, `-max`, bare value
 * meaning "at least") so the control shows what the server actually applied.
 */
export function readNumericRange(
  params: QueryParams,
  key: string,
): { min: number | null; max: number | null } {
  const raw = params[key];
  if (!raw) return { min: null, max: null };

  if (!raw.includes('-')) {
    const value = Number(raw);
    return Number.isFinite(value) ? { min: value, max: null } : { min: null, max: null };
  }

  const index = raw.indexOf('-');
  const left = raw.slice(0, index).trim();
  const right = raw.slice(index + 1).trim();
  const min = left === '' ? null : Number(left);
  const max = right === '' ? null : Number(right);

  return {
    min: min !== null && Number.isFinite(min) ? min : null,
    max: max !== null && Number.isFinite(max) ? max : null,
  };
}

export function writeNumericRange(
  params: QueryParams,
  key: string,
  range: { min: number | null; max: number | null },
): QueryParams {
  const next = { ...params };
  const { min, max } = range;

  if (min === null && max === null) {
    delete next[key];
  } else if (min !== null && max !== null) {
    next[key] = min === max ? String(min) : `${min}-${max}`;
  } else if (min !== null) {
    next[key] = `${min}-`;
  } else {
    next[key] = `-${max}`;
  }

  return resetPage(next);
}

export function readAttributeRange(
  params: QueryParams,
  code: string,
): { min: number | null; max: number | null } {
  return readNumericRange(params, attributeKey(code));
}

export function writeAttributeValue(
  params: QueryParams,
  definition: { code: string; dataType: string },
  value: string | undefined,
): QueryParams {
  return setSingleValue(params, attributeKey(definition.code), value);
}

/**
 * Removes every filter but keeps the base path and the non-filter parameters
 * the page needs. "Clear all" on a category page must not eject the user from
 * that category.
 */
export function clearAllFilters(
  params: QueryParams,
  options: { keep?: readonly string[] } = {},
): QueryParams {
  const keep = new Set(options.keep ?? []);
  const next: QueryParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith(ATTRIBUTE_FILTER_PREFIX)) continue;
    if (keep.has(key)) next[key] = value;
  }

  return next;
}

/** Filter keys the UI considers "active constraints". */
export const FILTER_KEYS = [
  'q',
  'location',
  'eventType',
  'amenity',
  'verified',
  'featured',
  'priceMin',
  'priceMax',
  'capacityMin',
  'capacityMax',
] as const;

export function countActiveFilters(params: QueryParams): number {
  let count = 0;

  if (params.q) count += 1;
  if (params.location) count += 1;
  if (params.verified === 'true') count += 1;
  if (params.featured === 'true') count += 1;
  if (params.priceMin || params.priceMax) count += 1;
  if (params.capacityMin || params.capacityMax) count += 1;
  count += readList(params, 'eventType').length;
  count += readList(params, 'amenity').length;

  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith(ATTRIBUTE_FILTER_PREFIX) && value) count += 1;
  }

  return count;
}

/** Every filter is cleared, so the UI can hide "Clear all" when it is a no-op. */
export function hasActiveFilters(params: QueryParams): boolean {
  return countActiveFilters(params) > 0;
}

/**
 * Changing filters or sorting must return to page 1. Keeping the old page is
 * the classic way to drop a user onto an empty results page after narrowing.
 */
export function resetPage(params: QueryParams): QueryParams {
  const next = { ...params };
  for (const key of PAGINATION_KEYS) delete next[key];
  return next;
}

export function setPage(params: QueryParams, page: number): QueryParams {
  const next = { ...params };
  if (page <= 1) delete next.page;
  else next.page = String(page);
  return next;
}

export function setSort(params: QueryParams, sort: string): QueryParams {
  const next = resetPage(params);
  if (sort === 'recommended') delete next.sort;
  else next.sort = sort;
  return next;
}

/** Merges the shortlist/selected ids used by the multi-provider enquiry form. */
export function setSelectedListings(params: QueryParams, slugs: readonly string[]): QueryParams {
  const next = { ...params };
  if (slugs.length === 0) delete next.enquire;
  else next.enquire = [...new Set(slugs)].join(',');
  return next;
}

export function readSelectedListings(params: QueryParams): string[] {
  return readList(params, 'enquire');
}
