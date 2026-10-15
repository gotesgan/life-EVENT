import 'server-only';
import { z } from 'zod';
import type { UrlParams } from '@/components/admin/use-url-filters';

/**
 * Query-string handling shared by every admin page.
 *
 * Filters are validated with the same Zod schemas the HTTP API uses, so a URL
 * an administrator hand-edits cannot produce a query the service would reject.
 * An invalid value is *not* a 500: it is dropped and the page renders normally,
 * which matters because filter URLs are shareable and therefore hand-editable.
 */

export type PageSearchParams = Record<string, string | string[] | undefined>;

export function parsePageQuery<TSchema extends z.ZodType>(
  schema: TSchema,
  params: PageSearchParams,
): z.infer<TSchema> {
  // Normalise first: a repeated `?q=a&q=b` becomes `a`, and an empty value is
  // dropped entirely rather than failing a `z.enum` and discarding every other
  // filter on the page.
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single === undefined || single === '') continue;
    normalized[key] = single;
  }

  const result = schema.safeParse(normalized);
  if (result.success) return result.data;

  // At least one key failed. Validate each key individually against its own
  // field so only the offending filter is dropped: an over-long `?q=` must not
  // silently reset the status, assignee, category and date filters the admin
  // spent time building. The surviving raw values are then re-parsed as a whole
  // so every transform (booleans, trimming, coercions) still runs exactly once.
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(normalized)) {
      const field = shape[key];
      if (field === undefined) continue;
      if (field.safeParse(value).success) kept[key] = value;
    }
    const subset = schema.safeParse(kept);
    if (subset.success) return subset.data;
  }

  // Degenerate fallback: the schema exposes no recoverable subset (or is not an
  // object), so use its own defaults rather than returning unvalidated values.
  try {
    return schema.parse({}) as z.infer<TSchema>;
  } catch {
    return {} as z.infer<TSchema>;
  }
}

/** Flattens page search params into the single-valued shape the UI uses. */
export function toUrlParams(params: PageSearchParams): UrlParams {
  const out: UrlParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single === undefined || single === '') continue;
    out[key] = single;
  }
  return out;
}

/** Number of filters applied, ignoring pagination. */
export function countApplied(params: UrlParams, keys: readonly string[]): number {
  return keys.filter((key) => {
    const value = params[key];
    return value !== undefined && value !== '';
  }).length;
}
