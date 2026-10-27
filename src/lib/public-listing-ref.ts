/**
 * Opaque public identifiers for listings.
 *
 * A listing's database slug is derived from its trading name
 * (`gulmohar-banjara-banquets`), so linking to `/vendors/<slug>` would print the
 * name the product deliberately withholds until an enquiry has been sent — the
 * URL would be the leak the mask exists to prevent.
 *
 * Public links therefore carry the listing **id** behind a short prefix. A cuid
 * is already opaque and URL-safe, so no hashing or encoding table is needed:
 * `ul_cm3xk…` identifies a listing, reveals nothing about it, and the resolver
 * can turn it back into an id without a database lookup.
 *
 * Slugs remain accepted by the same route, for the admin surface, for the
 * existing end-to-end fixtures and for any old shared link. They are simply not
 * what the public site generates any more.
 */
export const LISTING_REF_PREFIX = 'ul_';

/** The opaque path segment for a listing id. */
export function listingRef(id: string): string {
  return `${LISTING_REF_PREFIX}${id}`;
}

/** The id behind a public reference, or `null` when the segment is a slug. */
export function listingIdFromRef(segment: string): string | null {
  if (!segment.startsWith(LISTING_REF_PREFIX)) return null;

  const id = segment.slice(LISTING_REF_PREFIX.length);
  // A cuid is 25 characters of lowercase alphanumerics. Anything else is a
  // malformed reference, and treating it as a slug would produce a confusing 404
  // rather than a fast, deliberate one.
  return /^[a-z0-9]{20,40}$/i.test(id) ? id : null;
}

/** True when a path segment is a public reference rather than a slug. */
export function isListingRef(segment: string): boolean {
  return listingIdFromRef(segment) !== null;
}
