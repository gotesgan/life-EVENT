import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { listingRef } from '@/lib/public-listing-ref';
import type { ListingCard, ListingDetail } from '@/server/dto/listing.dto';

/**
 * Withheld venue identity.
 *
 * The product rule is deliberate: a listing's trading name is withheld until the
 * visitor has sent an enquiry for that listing. The browse grid therefore shows
 * an anonymous stand-in ("Banquet hall in Andheri East"), and the profile page
 * keeps every published fact — price, capacity, facilities, photographs — while
 * holding back the name and the contact channels.
 *
 * Two things make this honest rather than cosmetic:
 *
 * 1. **The real name never crosses to the browser.** Masking happens in the
 *    Server Component before the DTO is serialised, so the payload for an
 *    unrevealed visitor contains the stand-in and not the name. A CSS blur or a
 *    client-side conditional would leak it to anyone who opens the network tab.
 * 2. **Prose is scrubbed, not just the heading.** Seed and provider copy
 *    routinely names the business ("Gulmohar Banjara Banquets is a…"), so a
 *    masked profile replaces every occurrence with "this business" before it is
 *    rendered.
 *
 * The reveal itself is remembered in a signed, httpOnly cookie so a visitor who
 * has enquired does not have to re-enquire to see the name again. The signature
 * is what makes "remembered" different from "forgeable": without the HMAC a
 * visitor could simply write any slug into the cookie.
 */

export const REVEAL_COOKIE = 'liveenvt-revealed-listings';

/** Enough for a realistic enquiry history without approaching the 4 KB cookie cap. */
const MAX_REVEALED = 40;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Category slugs whose plural/compound name would read badly in an anonymous
 * title ("Hotels & Resorts in …" is a category, not an identity).
 *
 * Anything not listed falls back to `singularise()`, so a category added later
 * still produces a readable stand-in without a code change here.
 */
const CATEGORY_STAND_INS: Record<string, string> = {
  venues: 'Event venue',
  'banquet-halls': 'Banquet hall',
  'hotels-and-resorts': 'Hotel and resort',
  'lawns-and-farmhouses': 'Lawn and farmhouse',
  photographers: 'Photographer',
  videographers: 'Videographer',
  'wedding-planners': 'Wedding planner',
  'decorators-and-florists': 'Decorator and florist',
  caterers: 'Caterer',
  'live-food-stations': 'Live food station',
  'makeup-artists': 'Makeup artist',
  'hair-stylists': 'Hair stylist',
  djs: 'DJ',
  'live-bands': 'Live band',
  'invitation-designers': 'Invitation designer',
  'gift-hampers': 'Gift hamper',
  'furniture-rentals': 'Furniture rental',
  'luxury-car-rentals': 'Luxury car rental',
  'corporate-venues': 'Corporate venue',
  'conference-and-av': 'Conference and AV provider',
  'corporate-catering': 'Corporate caterer',
  'team-offsites': 'Offsite venue',
};

/** A noun a visitor can reason about, derived from whatever the catalogue says. */
function singularise(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')) {
    return lower.slice(0, -1);
  }
  return lower;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The anonymous identity a listing shows until it has been enquired about.
 *
 * Accepts either the card's `category` or the profile's `primaryCategory`, so a
 * card and its profile cannot disagree about what the anonymous label says.
 */
export function maskedListingName(listing: {
  category?: { name: string; slug: string } | null;
  primaryCategory?: { name: string; slug: string } | null;
  location?: { name: string } | null;
}): string {
  const source = listing.category ?? listing.primaryCategory ?? null;
  const category = source
    ? (CATEGORY_STAND_INS[source.slug] ?? singularise(source.name))
    : 'Event vendor';

  return listing.location
    ? `${capitalise(category)} in ${listing.location.name}`
    : capitalise(category);
}

/**
 * Replaces the trading name inside provider-authored copy.
 *
 * Only the full name is replaced. Trying to catch every shortened brand form
 * ("Gulmohar" for "Gulmohar Banjara Banquets") would need a confidence the data
 * does not support; the full name is the one string that is certain.
 */
export function scrubBusinessName(text: string | null, name: string): string | null {
  if (!text) return text;

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), (match, offset: number, whole: string) => {
    // "This business runs six halls…" reads as prose; "this business runs…" reads
    // as a find-and-replace artefact. Capitalise only where the name began a
    // sentence.
    const before = whole.slice(0, offset).trimEnd();
    const startsSentence = before === '' || /[.!?]$/.test(before);
    return startsSentence ? 'This business' : 'this business';
  });
}

/**
 * Words that describe a *kind* of business rather than identifying one.
 *
 * A brand word is whatever is left of the trading name after these are removed
 * ("Gulmohar" from "Gulmohar Banjara Banquets"), and that is what has to go from
 * the anonymous projection: named halls and packages ("Gulmohar Grand Hall")
 * would otherwise spell the withheld brand out.
 */
const GENERIC_NAME_WORDS = new Set([
  'the',
  'and',
  'of',
  'by',
  '&',
  'banquet',
  'banquets',
  'hall',
  'halls',
  'hotel',
  'hotels',
  'resort',
  'resorts',
  'lawn',
  'lawns',
  'farmhouse',
  'farmhouses',
  'garden',
  'gardens',
  'palace',
  'grand',
  'royal',
  'studio',
  'studios',
  'events',
  'event',
  'wedding',
  'weddings',
  'planner',
  'planners',
  'photography',
  'films',
  'film',
  'productions',
  'production',
  'services',
  'service',
  'catering',
  'caterers',
  'designs',
  'design',
  'decor',
  'decorators',
  'florists',
  'band',
  'bands',
  'djs',
  'dj',
  'makeup',
  'artist',
  'artists',
  'styling',
  'rentals',
  'rental',
  'kitchens',
  'kitchen',
  'live',
  'sound',
  'light',
  'lighting',
  'collective',
  'convention',
  'centre',
  'center',
  'inn',
  'spa',
  'estate',
  'offsite',
  'venues',
  'venue',
  'conference',
  'corporate',
  'house',
]);

/** The distinctive words in a trading name — its brand, not its category. */
function brandTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9&']/g, ''))
    .filter((word) => word.length >= 4 && !GENERIC_NAME_WORDS.has(word.toLowerCase()));
}

/**
 * Removes brand words from a short label ("Gulmohar Grand Hall" → "Grand Hall").
 *
 * Only used on names and alt text, where the sentence structure is simple
 * enough that removing a word leaves something readable. Prose gets the full
 * name replaced instead (see `scrubBusinessName`), because deleting a brand word
 * from the middle of a sentence tends to leave broken grammar.
 */
export function scrubBrandTokens(text: string | null, name: string): string | null {
  if (!text) return text;

  let result = text;
  for (const token of brandTokens(name)) {
    result = result.replace(new RegExp(`\\b${token}\\b`, 'gi'), '');
  }

  // Tidy what the deletions leave behind: doubled spaces, then stray separators.
  result = result
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,;:–—-]+/, '')
    .replace(/[\s,;:–—-]+$/, '')
    .trim();

  return result.length > 0 ? result : null;
}

function hmac(payload: string): string {
  return createHmac('sha256', getServerEnv().BETTER_AUTH_SECRET)
    .update(payload)
    .digest('base64url')
    .slice(0, 32);
}

/**
 * Serialises a reveal list into a signed cookie value.
 *
 * Slugs are already a closed character set (`[a-z0-9-]`), so `,` and `.` are
 * safe separators and the signature cannot be confused with the payload.
 */
export function sealRevealedSlugs(slugs: readonly string[]): string {
  const payload = Array.from(new Set(slugs.filter(Boolean)))
    .slice(-MAX_REVEALED)
    .join(',');
  return `${payload}.${hmac(payload)}`;
}

/** Verifies and unwraps a reveal cookie. A tampered cookie reveals nothing. */
export function readRevealedSlugs(raw: string | undefined): string[] {
  if (!raw) return [];

  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return [];

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = hmac(payload);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);

  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return [];
  return payload.split(',').filter(Boolean);
}

/**
 * The reveal list for the current request.
 *
 * Reads the cookie through `next/headers`, so it must be called from a Server
 * Component (inside a `<Suspense>` boundary, per `cacheComponents`) or a Route
 * Handler — never from a module that is imported by the client.
 */
export async function getRevealedSlugs(): Promise<ReadonlySet<string>> {
  const store = await cookies();
  return new Set(readRevealedSlugs(store.get(REVEAL_COOKIE)?.value));
}

/** Cookie configuration for setting the reveal list from a Route Handler. */
export function revealCookieOptions() {
  return {
    name: REVEAL_COOKIE,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  };
}

/**
 * True when the visitor has already enquired about this listing.
 *
 * The set holds whatever the enquiry form posted: an opaque `ul_` reference for
 * the site's own forms, or a slug for API clients. Both are accepted so the
 * reveal survives either entry point.
 */
export function isListingRevealed(
  revealed: ReadonlySet<string>,
  listing: { id: string; slug: string },
): boolean {
  return revealed.has(listing.slug) || revealed.has(listingRef(listing.id));
}

/**
 * Masks a listing card for an unrevealed visitor.
 *
 * Everything except identity survives: the photograph, the category/locality
 * label, the published price and the capacity are exactly the facts used to
 * decide whether to open the profile at all.
 */
export function publicListingCard(card: ListingCard, revealed: ReadonlySet<string>): ListingCard {
  if (isListingRevealed(revealed, card)) return card;

  // The slug is derived from the trading name, so it is replaced too — otherwise
  // the name would leak through the JSON payload, a devtools copy or any client
  // that renders the DTO rather than the card component.
  return {
    ...card,
    slug: listingRef(card.id),
    name: maskedListingName(card),
    tagline: scrubBusinessName(card.tagline, card.name),
    isNameHidden: true,
  };
}

/** Masks every card in a result set. */
export function publicListingCards(
  cards: readonly ListingCard[],
  revealed: ReadonlySet<string>,
): ListingCard[] {
  return cards.map((card) => publicListingCard(card, revealed));
}

/**
 * Masks a full profile: anonymous name, scrubbed prose and withheld channels.
 *
 * The contact block is replaced rather than blanked, so the card still has an
 * explanation on it instead of rendering as an empty panel.
 */
export function publicListingDetail(
  listing: ListingDetail,
  revealed: ReadonlySet<string>,
): ListingDetail {
  if (isListingRevealed(revealed, listing)) return listing;

  const scrub = (text: string | null) => scrubBusinessName(text, listing.name);
  // Names and alt text also lose the brand words, because those fields often
  // repeat the brand outside the full trading name ("Gulmohar Grand Hall").
  const scrubLabel = (text: string | null) =>
    scrubBrandTokens(scrubBusinessName(text, listing.name), listing.name);

  return {
    ...listing,
    // See `publicListingCard`: the slug spells the name out, so the masked
    // projection carries the opaque reference instead.
    slug: listingRef(listing.id),
    name: maskedListingName(listing),
    isNameHidden: true,
    tagline: scrubLabel(listing.tagline),
    description: scrub(listing.description),
    about: scrub(listing.about),
    gallery: listing.gallery.map((image) => ({
      ...image,
      alt: scrubLabel(image.alt) ?? '',
    })),
    services: listing.services.map((service) => ({
      ...service,
      name: scrubLabel(service.name) ?? service.name,
      description: scrub(service.description),
    })),
    packages: listing.packages.map((pack) => ({
      ...pack,
      name: scrubLabel(pack.name) ?? pack.name,
      description: scrub(pack.description),
    })),
    spaces: listing.spaces.map((space) => ({
      ...space,
      name: scrubLabel(space.name) ?? space.name,
      description: scrub(space.description),
    })),
    contact: {
      phone: null,
      email: null,
      whatsapp: null,
      website: null,
      hasWithheldChannels: true,
      message:
        'The name and contact details are shared with businesses you enquire with. Send an enquiry to unlock them.',
    },
  };
}
