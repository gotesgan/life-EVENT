/**
 * Text helpers shared by the venue import pipeline.
 *
 * Everything here is pure and deterministic: the same workbook row must always
 * produce the same slug, because the slug is the upsert key the importer uses to
 * keep re-runs idempotent.
 */

const SENTINEL_WEBSITES = new Set([
  'website link not verified',
  'available online',
  'n/a',
  'na',
  'none',
  '-',
  '',
]);

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function slugify(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Turns the workbook's inconsistent website column into an absolute URL.
 *
 * The sheets mix bare domains (`fern hotels.com`), full URLs, and prose such as
 * "Website link not verified". Only the first two are usable; the prose is
 * dropped rather than guessed at.
 */
export function normaliseWebsite(value: string | undefined): string | null {
  const raw = collapseWhitespace(value ?? '');
  if (!raw) return null;
  if (SENTINEL_WEBSITES.has(raw.toLowerCase())) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes('.')) return null;
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Digits-only phone, keeping a leading `+` so display stays recognisable. */
export function normalisePhone(value: string | undefined): string | null {
  const raw = collapseWhitespace(value ?? '');
  if (!raw) return null;
  if (/available online|not verified|n\/a/i.test(raw)) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 8 ? raw : null;
}

export function normaliseEmail(value: string | undefined): string | null {
  const raw = collapseWhitespace(value ?? '').toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(raw) ? raw : null;
}

/** Splits a `;`-separated workbook cell into trimmed, non-empty values. */
export function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[;|]/)
    .map((part) => collapseWhitespace(part))
    .filter(Boolean);
}

export function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

/** Truncates on a word boundary so a description never ends mid-word. */
export function truncate(value: string, limit: number): string {
  const text = collapseWhitespace(value);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-–—]$/, '')}…`;
}

export function stripHtml(value: string): string {
  return collapseWhitespace(
    value
      // Comments first: `<[^>]+>` would stop at the first `>` inside `<!-- … -->`
      // and leave the comment body behind as prose.
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
}

/**
 * Removes the scaffolding that survives `stripHtml` on page-builder sites:
 * breadcrumbs, stray arrows, "Introduction" labels and duplicated separators.
 */
export function cleanProse(value: string): string {
  let text = collapseWhitespace(value);

  // "Home > Della Enclave Villa Resort Introduction Welcome to…" — drop the
  // breadcrumb prefix, which is navigation rather than description.
  const breadcrumb = /^(?:home|about(?:\s*us)?|our\s+story)\s*>\s*(?:[^>]{1,60}>\s*){1,4}/i.exec(
    text,
  );
  if (breadcrumb) text = text.slice(breadcrumb[0].length);

  return collapseWhitespace(
    text
      .replace(/\s*-+>\s*/g, ' ')
      .replace(/\s*»\s*/g, ' ')
      .replace(/\bIntroduction\b\s*/gi, '')
      .replace(/\s*\|\s*/g, ' — ')
      .replace(/\s{2,}/g, ' '),
  );
}

export function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: '’',
    lsquo: '‘',
    ldquo: '“',
    rdquo: '”',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    rupee: '₹',
  };
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return named[entity.toLowerCase()] ?? match;
  });
}
