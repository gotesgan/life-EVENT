/**
 * HTML → facts, for the venue scraper.
 *
 * There is no DOM parser in this project's dependency list, and adding one for a
 * one-off import would be the wrong trade (AGENTS.md: no new dependencies
 * without asking). These extractors are deliberately narrow: they read the
 * handful of shapes venue sites actually use — meta tags, JSON-LD, `<img>`
 * attributes, inline `background-image`, headings, paragraphs and rupee prices.
 *
 * They are tolerant, not correct-by-construction: a malformed page yields fewer
 * facts, never an exception.
 */

import { collapseWhitespace, decodeHtmlEntities, stripHtml } from './text';

export interface PageMeta {
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  canonical: string | null;
}

function attribute(tag: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(tag);
  if (!match) return null;
  const value = match[2] ?? match[3] ?? match[4] ?? '';
  return value ? decodeHtmlEntities(value) : null;
}

function metaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const match of html.matchAll(/<meta\s[^>]*>/gi)) {
    const tag = match[0];
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    const content = attribute(tag, 'content');
    if (key && content && !tags.has(key.toLowerCase())) tags.set(key.toLowerCase(), content);
  }
  return tags;
}

export function extractMeta(html: string, baseUrl: string): PageMeta {
  const tags = metaTags(html);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const canonical = /<link\s[^>]*rel=["']canonical["'][^>]*>/i.exec(html)?.[0];

  return {
    title: titleTag ? collapseWhitespace(decodeHtmlEntities(stripHtml(titleTag))) : null,
    description: tags.get('description') ?? null,
    ogTitle: tags.get('og:title') ?? null,
    ogDescription: tags.get('og:description') ?? null,
    ogImage: absoluteUrl(tags.get('og:image') ?? tags.get('twitter:image') ?? null, baseUrl),
    canonical: canonical ? absoluteUrl(attribute(canonical, 'href'), baseUrl) : null,
  };
}

export function absoluteUrl(value: string | null | undefined, baseUrl: string): string | null {
  const raw = collapseWhitespace(value ?? '');
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('javascript:')) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Every JSON-LD block on the page, flattened to a list of objects. */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = (match[1] ?? '').trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        objects.push(record);
        const graph = record['@graph'];
        if (Array.isArray(graph)) queue.push(...graph);
      }
    } catch {
      // A broken JSON-LD block is common; skip it rather than fail the page.
    }
  }
  return objects;
}

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif)(\?|$)/i;
const IMAGE_NOISE =
  /sprite|logo|icon|favicon|placeholder|loader|spinner|pixel|tracking|avatar|badge|whatsapp|facebook|instagram|twitter|linkedin|youtube|arrow|chevron|star-rating|flag-|payment|visa|mastercard/i;

/**
 * Candidate photographs, best-first.
 *
 * `og:image` leads because it is the one image a site explicitly nominates for
 * sharing. Everything else is scraped from `<img>`, `<source>` and inline
 * `background-image`, then filtered: logos, icons, sprites and tracking pixels
 * are never photographs, and an SVG cannot be cropped to the product's 16:9.
 */
export function extractImages(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const push = (value: string | null | undefined): void => {
    const url = absoluteUrl(value, baseUrl);
    if (url) found.push(url);
  };

  const tags = metaTags(html);
  push(tags.get('og:image'));
  push(tags.get('og:image:secure_url'));
  push(tags.get('twitter:image'));

  for (const record of extractJsonLd(html)) {
    const image = record.image;
    if (typeof image === 'string') push(image);
    else if (Array.isArray(image)) {
      for (const entry of image) {
        if (typeof entry === 'string') push(entry);
        else if (entry && typeof entry === 'object') push((entry as { url?: string }).url);
      }
    }
  }

  for (const match of html.matchAll(/<img\s[^>]*>/gi)) {
    const tag = match[0];
    push(attribute(tag, 'src'));
    push(attribute(tag, 'data-src'));
    push(attribute(tag, 'data-lazy-src'));
    push(attribute(tag, 'data-original'));
    push(attribute(tag, 'data-bg'));
    const srcset = attribute(tag, 'srcset') ?? attribute(tag, 'data-srcset');
    if (srcset) {
      const largest = srcset
        .split(',')
        .map((part) => part.trim().split(/\s+/)[0])
        .filter(Boolean)
        .pop();
      push(largest);
    }
  }

  for (const match of html.matchAll(/<source\s[^>]*srcset=["']([^"']+)["'][^>]*>/gi)) {
    const largest = (match[1] ?? '')
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .pop();
    push(largest);
  }

  for (const match of html.matchAll(
    /background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
  )) {
    push(match[1]);
  }

  const seen = new Set<string>();
  const images: string[] = [];
  for (const url of found) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (!IMAGE_EXTENSION.test(parsed.pathname)) continue;
    if (IMAGE_NOISE.test(parsed.pathname)) continue;
    const key = `${parsed.hostname}${parsed.pathname}`;
    if (seen.has(key)) continue;
    seen.add(key);
    images.push(url);
  }
  return images;
}

export function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  for (const match of html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = collapseWhitespace(decodeHtmlEntities(stripHtml(match[2] ?? '')));
    if (text.length >= 3 && text.length <= 120) headings.push(text);
  }
  return [...new Set(headings)];
}

export function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  for (const match of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = collapseWhitespace(decodeHtmlEntities(stripHtml(match[1] ?? '')));
    if (text.length >= 60 && text.length <= 1200) paragraphs.push(text);
  }
  return [...new Set(paragraphs)];
}

export function extractLinks(html: string, baseUrl: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  for (const match of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absoluteUrl(match[1], baseUrl);
    if (!href) continue;
    const text = collapseWhitespace(decodeHtmlEntities(stripHtml(match[2] ?? '')));
    links.push({ href, text });
  }
  return links;
}

const PHONE_PATTERN = /(?:\+91[\s-]?)?(?:\(?0?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}\b/g;

export function extractPhones(text: string): string[] {
  const phones = new Set<string>();
  for (const match of text.matchAll(PHONE_PATTERN)) {
    const raw = collapseWhitespace(match[0]);
    const digits = raw.replace(/\D/g, '');
    // Indian landlines and mobiles are 10–12 digits including the STD/prefix.
    if (digits.length >= 10 && digits.length <= 13) phones.add(raw);
  }
  return [...phones];
}

export function extractEmails(text: string): string[] {
  const emails = new Set<string>();
  for (const match of text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    emails.add(match[0].toLowerCase());
  }
  return [...emails];
}

export interface PriceMention {
  amount: number;
  currency: 'INR';
  /** The words around the amount, used to decide what it is a price *of*. */
  context: string;
  unit: 'PER_PLATE' | 'PER_PERSON' | 'PER_DAY' | 'PER_EVENT' | 'PER_PACKAGE' | 'UNKNOWN';
}

const PRICE_PATTERN = /(?:₹|rs\.?|inr)\s*([\d][\d,]{2,9})(?:\s*(?:\/-|only|onwards|\+)?)?/gi;

function classifyUnit(context: string): PriceMention['unit'] {
  const haystack = context.toLowerCase();
  if (/per\s*plate|plate|thali/.test(haystack)) return 'PER_PLATE';
  if (/per\s*(?:person|head|pax|guest)/.test(haystack)) return 'PER_PERSON';
  if (/per\s*day|per\s*night|tariff/.test(haystack)) return 'PER_DAY';
  if (/per\s*(?:event|function)/.test(haystack)) return 'PER_EVENT';
  if (/package|combo|deal/.test(haystack)) return 'PER_PACKAGE';
  return 'UNKNOWN';
}

/**
 * Rejects amounts that are not venue prices.
 *
 * Resort sites double as real-estate developers: Della's home page carries a
 * dozen "GDV ₹1,235 Cr" township announcements that are rupee amounts and
 * nothing to do with hiring the venue. A mention has to be either explicitly
 * per-plate/per-person/per-day, or sit next to a word that only appears in a
 * venue price list.
 */
function isVenuePrice(context: string, unit: PriceMention['unit'], amount: number): boolean {
  if (/crore|\bcr\b|lakh|gdv|township|per\s*sq|sq\.?\s*ft|acre|\bac\b/i.test(context)) {
    return false;
  }

  // A room rate, a day pass or a spa treatment is not a venue price. These words
  // only ever appear next to the amounts that made the first run publish
  // "₹728 per event" for a five-star hotel.
  if (
    /per\s*night|per\s*room|room\s*rate|day\s*pass|day\s*use|spa|massage|breakfast|buffet\s*only/i.test(
      context,
    )
  ) {
    return false;
  }

  if (unit === 'PER_PLATE' || unit === 'PER_PERSON') {
    // A per-plate menu in India sits between roughly ₹300 and ₹5,000.
    return amount >= 300 && amount <= 5000;
  }

  if (unit === 'PER_EVENT' || unit === 'PER_PACKAGE' || unit === 'PER_DAY') {
    // No venue hires out a hall for an event for less than this; smaller figures
    // are add-ons, deposits or room nights that happened to sit near the word
    // "package".
    return amount >= 25_000;
  }

  return false;
}

export function extractPrices(text: string): PriceMention[] {
  const mentions: PriceMention[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(PRICE_PATTERN)) {
    const amount = Number((match[1] ?? '').replace(/,/g, ''));
    // Below ₹500 a "price" is almost always a deposit, a per-head add-on or a
    // year in a copyright line; above ₹50,00,000 it is a property listing.
    if (!Number.isFinite(amount) || amount < 500 || amount > 5_000_000) continue;

    const start = Math.max(0, (match.index ?? 0) - 90);
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 90);
    const context = collapseWhitespace(text.slice(start, end));
    const unit = classifyUnit(context);
    if (!isVenuePrice(context, unit, amount)) continue;

    const key = `${amount}:${unit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    mentions.push({ amount, currency: 'INR', context, unit });
  }

  return mentions;
}

const IMAGE_PENALTY =
  /award|logo|banner|badge|icon|seo|schema|sprite|placeholder|favicon|payment|partner|press|client|testimonial|review|star|arrow|whatsapp|social|footer|header|menu-|nav-|loader|spinner|pixel|tracking|avatar|flag|visa|mastercard|amex|upi|gpay|township|residences|project|invest|career|blog|news/i;
/** The photographs a venue listing actually needs: the room it hires out. */
const IMAGE_STRONG_BONUS =
  /wedding|banquet|venue|hall|lawn|event|celebration|decor|mandap|reception|sangeet|ballroom|terrace|garden|stage|couple|bride|groom|gallery/i;
/** Supporting photography — useful, but not what the cover should be. */
const IMAGE_WEAK_BONUS = /resort|room|suite|pool|dining|restaurant|spa|exterior|facade/i;

/**
 * Ranks image candidates so the downloader spends its budget on photographs.
 *
 * A venue home page can carry 300 `<img>` tags, most of them award badges,
 * payment marks and 40px icons. Downloading all of them to find out is slow and
 * rude to the origin server, so the obvious non-photographs are dropped here and
 * the rest are ordered by how much they look like venue photography.
 */
export function rankImageCandidates(
  candidates: readonly { url: string; pageUrl: string }[],
  limit = 24,
): string[] {
  const scored = new Map<string, { url: string; score: number }>();

  for (const { url, pageUrl } of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }

    const path = parsed.pathname.toLowerCase();
    if (IMAGE_PENALTY.test(path)) continue;

    let score = 0;
    if (IMAGE_STRONG_BONUS.test(path)) score += 4;
    else if (IMAGE_WEAK_BONUS.test(path)) score += 1;
    if (IMAGE_STRONG_BONUS.test(pageUrl.toLowerCase())) score += 3;
    else if (IMAGE_WEAK_BONUS.test(pageUrl.toLowerCase())) score += 1;
    if (/\.(jpe?g|webp)$/.test(path)) score += 1;
    if (/\.png$/.test(path)) score -= 1;

    const width = Number(parsed.searchParams.get('w') ?? parsed.searchParams.get('width') ?? 0);
    if (width >= 1000) score += 2;
    else if (width > 0 && width < 600) score -= 3;

    if (/\d{3,}/.test(path.split('/').pop() ?? '')) score += 1;

    // One entry per file name: galleries often repeat the same photograph at
    // several crops, and three crops of one hall is not three photographs.
    const key = `${parsed.hostname}${path}`;
    const existing = scored.get(key);
    if (!existing || score > existing.score) scored.set(key, { url, score });
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.url);
}

/** True when the response is a JavaScript shell rather than rendered content. */
export function looksLikeShell(html: string): boolean {
  const text = stripHtml(html);
  if (text.length < 600) return true;
  return /enable javascript|javascript is disabled|please turn on javascript/i.test(text);
}
