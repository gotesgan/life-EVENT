/**
 * Admin listing filter keys.
 *
 * This lives in a plain module rather than beside the filter component on
 * purpose. `ListingsFilters.tsx` is a `'use client'` module, and **every export
 * of a client module becomes a client reference when imported into a Server
 * Component** — not the underlying value. Importing the array from there made
 * `LISTING_FILTER_KEYS.filter(...)` in `src/app/admin/listings/page.tsx` throw
 * `TypeError: ... .filter is not a function` at runtime, because the "array" was
 * a reference proxy.
 *
 * Rule this encodes: components may be shared across the boundary; plain data
 * and helpers must live in a non-client module.
 */
export const LISTING_FILTER_KEYS = [
  'q',
  'publicationStatus',
  'verificationStatus',
  'categoryId',
  'locationId',
  'isFeatured',
] as const;

export type ListingFilterKey = (typeof LISTING_FILTER_KEYS)[number];
