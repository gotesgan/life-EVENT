/**
 * Slug generation. Pure and deterministic so it can be unit tested and reused
 * by listings, categories and locations.
 */

const DIACRITICS = /[\u0300-\u036f]/g;

export function slugify(input: string): string {
  // The length cap is applied *before* the final trim so that cutting a long
  // input at the cap cannot leave a trailing dash (e.g. 79 "a"s followed by
  // "-b" would otherwise end with "-").
  const capped = input
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);

  return capped.replace(/^-+|-+$/g, '');
}

/**
 * Appends a numeric suffix when a slug is already taken.
 * `taken` is the result of an existence check, so this stays a pure function.
 */
export function disambiguateSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || 'item';
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix <= 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error(`Could not find a free slug for "${root}"`);
}

/** Builds a materialised hierarchy path, e.g. `maharashtra/mumbai/bandra-west`. */
export function buildPath(segments: readonly string[]): string {
  return segments
    .map((segment) => slugify(segment))
    .filter(Boolean)
    .join('/');
}
