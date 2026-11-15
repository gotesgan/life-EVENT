/**
 * Facts → listing fields.
 *
 * The scraper records what a venue's website says; this module decides what the
 * catalogue stores. Every derivation is conservative on purpose: a marketplace
 * that invents a capacity or a price is worse than one that leaves the field
 * empty and shows "on request". Nothing here guesses a number that was not on
 * the page.
 */

import type { PriceMention } from './extract';
import { cleanProse, collapseWhitespace, truncate } from './text';

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

/**
 * Area text → Pune locality slug.
 *
 * The workbooks write the same neighbourhood a dozen ways ("Hinjawadi Phase 1",
 * "Hinjawadi / IT Park", "Hinjewadi - Wakad Rd"). Order matters: the first match
 * wins, so the most specific patterns come first.
 */
const PUNE_LOCALITY_PATTERNS: readonly { slug: string; pattern: RegExp }[] = [
  {
    slug: 'hinjawadi',
    pattern: /hinjawadi|hinjewadi|marunji|maan\s*rd|blue\s*ridge|laxmi\s*chowk|ghotawade/i,
  },
  { slug: 'wakad', pattern: /wakad|bhumkar|datta\s*mandir|beverly\s*hills|nashik\s*phata/i },
  { slug: 'baner', pattern: /baner|balewadi|mahalunge|sus\s*road|pashan\s*sus/i },
  { slug: 'aundh', pattern: /aundh|ravet/i },
  { slug: 'kothrud', pattern: /kothrud|karve\s*(road|corridor)|paud\s*rd|mukund\s*nagar/i },
  {
    slug: 'deccan-gymkhana',
    pattern:
      /deccan|apte\s*rd|bhandarkar|jm\s*road|jawaharlal\s*nehru|shivajinagar|model\s*colony|ganeshkhind|university\s*rd/i,
  },
  {
    slug: 'camp',
    pattern:
      /camp|moledina|convent\s*st|east\s*st|mg\s*road|prince\s*of\s*wales|officers\s*mess|richardson|chhatrapati\s*shivaji\s*marg|station\s*road|sanjog|tadiwala/i,
  },
  { slug: 'koregaon-park', pattern: /koregaon\s*park|mundhwa/i },
  { slug: 'viman-nagar', pattern: /viman\s*nagar|wiman\s*nagar|nagar\s*rd|sky\s*cruise|sakore/i },
  { slug: 'kharadi', pattern: /kharadi|mayfield|ishanya/i },
  { slug: 'yerwada', pattern: /yerwada|yerawada|airport\s*road|lohegaon|dhanori/i },
  { slug: 'bund-garden', pattern: /bund\s*garden|mangaldas|raja\s*bahadur\s*motilal/i },
  { slug: 'senapati-bapat-road', pattern: /senapati\s*bapat/i },
  { slug: 'hadapsar', pattern: /hadapsar|magarpatta|solapur\s*road|saswad/i },
  { slug: 'wanowrie', pattern: /wanowrie|nibm|salunke\s*vihar|sacred\s*world|vitthal\s*rao/i },
  { slug: 'kondhwa', pattern: /kondhwa|gangadham/i },
  {
    slug: 'sinhgad-road',
    pattern: /sinhgad\s*road|sinhgad\s*rd|parvati|aranyeshwar|swargate|saras\s*baug/i,
  },
  {
    slug: 'pimpri-chinchwad',
    pattern: /pimpri|chinchwad|akurdi|thergaon|rahatani|kokane|dattwadi|tilak\s*bridge|midc/i,
  },
  { slug: 'bavdhan', pattern: /bavdhan/i },
  { slug: 'pashan', pattern: /pashan|sagar\s*colony/i },
  { slug: 'dhole-patil-road', pattern: /dhole\s*patil/i },
  { slug: 'chakan', pattern: /chakan/i },
  { slug: 'wagholi', pattern: /wagholi/i },
  { slug: 'narhe', pattern: /narhe/i },
  { slug: 'bibvewadi', pattern: /bibvewadi/i },
  { slug: 'undri', pattern: /undri/i },
  { slug: 'alandi', pattern: /alandi|dighi/i },
  { slug: 'satara-road', pattern: /satara\s*road|shahi/i },
  { slug: 'katraj', pattern: /katraj|dehu/i },
  { slug: 'khed-shivapur', pattern: /khedshivapur|khed\s*shivapur/i },
];

export interface ResolvedLocation {
  citySlug: string;
  localitySlug: string | null;
}

export function resolveLocation(area: string, city: string): ResolvedLocation {
  // Panshet and Khadakwasla are villages inside Pune district, not towns of
  // their own, so they are localities of Pune rather than sibling cities.
  if (city === 'panshet' || city === 'khadakwasla') {
    return { citySlug: 'pune', localitySlug: city };
  }
  if (city !== 'pune') return { citySlug: city, localitySlug: null };

  for (const { slug, pattern } of PUNE_LOCALITY_PATTERNS) {
    if (pattern.test(area)) return { citySlug: 'pune', localitySlug: slug };
  }
  return { citySlug: 'pune', localitySlug: null };
}

// ---------------------------------------------------------------------------
// Categories and event types
// ---------------------------------------------------------------------------

export function resolveCategory(venueType: string): {
  primaryCategorySlug: string;
  secondaryCategorySlugs: string[];
} {
  const type = venueType.toLowerCase();
  if (/resort|hotel|heritage/.test(type)) {
    return { primaryCategorySlug: 'hotels-and-resorts', secondaryCategorySlugs: ['venues'] };
  }
  if (/lawn|farmhouse|garden/.test(type)) {
    return { primaryCategorySlug: 'lawns-and-farmhouses', secondaryCategorySlugs: ['venues'] };
  }
  return { primaryCategorySlug: 'banquet-halls', secondaryCategorySlugs: ['venues'] };
}

const EVENT_TYPE_ALIASES: readonly { slug: string; pattern: RegExp }[] = [
  { slug: 'wedding', pattern: /wedding/i },
  { slug: 'engagement', pattern: /engagement|ring\s*ceremony/i },
  { slug: 'reception', pattern: /reception/i },
  { slug: 'sangeet-and-mehndi', pattern: /sangeet|mehndi|mehendi/i },
  { slug: 'birthday', pattern: /birthday/i },
  { slug: 'anniversary', pattern: /anniversary/i },
  { slug: 'corporate-event', pattern: /corporate|conference|meeting|offsite|team\s*building/i },
  { slug: 'baby-shower', pattern: /baby\s*shower|naming\s*ceremony/i },
  { slug: 'housewarming', pattern: /housewarming|griha\s*pravesh/i },
];

export function resolveEventTypes(
  venueType: string,
  workbookEventTypes: readonly string[],
): string[] {
  const slugs = new Set<string>();

  for (const value of workbookEventTypes) {
    for (const { slug, pattern } of EVENT_TYPE_ALIASES) {
      if (pattern.test(value)) slugs.add(slug);
    }
  }

  if (slugs.size === 0) {
    const type = venueType.toLowerCase();
    if (/hotel|resort/.test(type)) {
      ['wedding', 'reception', 'engagement', 'corporate-event'].forEach((slug) => slugs.add(slug));
    } else if (/lawn|farmhouse/.test(type)) {
      ['wedding', 'reception', 'sangeet-and-mehndi', 'engagement'].forEach((slug) =>
        slugs.add(slug),
      );
    } else if (/restaurant/.test(type)) {
      ['birthday', 'anniversary', 'corporate-event'].forEach((slug) => slugs.add(slug));
    } else {
      ['wedding', 'reception', 'engagement', 'sangeet-and-mehndi', 'birthday'].forEach((slug) =>
        slugs.add(slug),
      );
    }
  }

  return [...slugs];
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

const AMENITY_PATTERNS: readonly { code: string; pattern: RegExp }[] = [
  { code: 'air-conditioned', pattern: /air[\s-]?condition|fully\s*a\/?c|\bac\s*hall/i },
  { code: 'valet-parking', pattern: /valet/i },
  {
    code: 'in-house-catering',
    pattern: /in[\s-]?house\s*catering|own\s*kitchen|in[\s-]?house\s*kitchen/i,
  },
  { code: 'bridal-suite', pattern: /bridal\s*(suite|room)|green\s*room/i },
  { code: 'pool', pattern: /swimming\s*pool|infinity\s*pool/i },
  { code: 'stage', pattern: /\bstage\b/i },
  { code: 'av-system', pattern: /\bav\b|projector|sound\s*system|led\s*wall/i },
  { code: 'wheelchair-access', pattern: /wheelchair|barrier[\s-]?free|accessible\s*entrance/i },
  { code: 'backup-power', pattern: /power\s*backup|generator|dg\s*set|inverter/i },
  { code: 'dance-floor', pattern: /dance\s*floor/i },
  { code: 'bar-service', pattern: /cocktail|bar\s*service|full\s*bar|mocktail/i },
  { code: 'pet-friendly', pattern: /pet[\s-]?friendly/i },
];

export function deriveAmenities(text: string): string[] {
  return AMENITY_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ code }) => code);
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

const CAPACITY_PATTERNS: readonly RegExp[] = [
  /(?:up\s*to|upto|capacity\s*of|seats?|seating\s*for|accommodat\w*|hosts?)\s*(?:of\s*)?([\d,]{2,5})\s*(?:guests|people|pax|persons|delegates|covers)/gi,
  /([\d,]{2,5})\s*(?:guests|pax|people|persons|delegates)\b/gi,
];

/** The largest plausible guest count stated on the page, or null. */
export function deriveCapacity(text: string): number | null {
  let best: number | null = null;
  for (const pattern of CAPACITY_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = Number((match[1] ?? '').replace(/,/g, ''));
      if (!Number.isFinite(value) || value < 50 || value > 5000) continue;

      // "2024 Guests" is a season heading, not a capacity. A year-shaped number
      // only counts when the surrounding words make it a quantity.
      if (value >= 1900 && value <= 2100) {
        const context = text.slice(Math.max(0, (match.index ?? 0) - 60), match.index ?? 0);
        if (
          !/\b(to|up\s*to|capacity|exceeding|over|around|accommodat\w*|seats?|hosts?)\b/i.test(
            context,
          )
        ) {
          continue;
        }
      }

      // A bare "50 guests" on a menu page is a minimum order, not a capacity.
      // Only a qualified phrase ("up to", "seats", "capacity of") can state a
      // small number; unqualified counts have to be large enough to be a hall.
      if (pattern === CAPACITY_PATTERNS[1] && value < 100) continue;

      if (best === null || value > best) best = value;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Venue spaces
// ---------------------------------------------------------------------------

const SPACE_NAME =
  /\b(hall|lawn|ballroom|banquet|terrace|garden|poolside|convention|auditorium|pavilion|mandap|deck|lawns|halls)\b/i;

const SPACE_NOISE =
  /^(our|the)\s+(venues?|halls?|spaces?|lawns?|banquet|facilities)$|book|enquire|contact|home|gallery|about|menu|read\s*more|view\s*all|see\s*all/i;

/** Blog headlines and marketing questions are not space names. */
const SPACE_HEADLINE =
  /\?|^(what|why|how|when|where|which|looking|discover|choose|get|find|book|explore|plan|top\s+\d|a\s+capacity|\d+\.)|\bin\s+pune\b|\bnear\b|\bfor\s+your\b|\bcapacity\s+of\b|\bpax\b|key\s+features|\btop\s+\d|\bvenues?\s*&|\bhalls?\s+in\b|\bin\s+india\b|\bin\s+hotel\b|^welcome\s+to\b|designed\s+for|every\s+occasion|spotlight|non[\s-]?ac\b|,\s*(hotel|pune|mumbai)\b/i;

/**
 * A space name that carries another city is a link to a different property in
 * the same group ("The Orchid Jamnagar – Coral Hall", "Kohinoor Hall - Dadar
 * East, Mumbai"), not a hall at this venue.
 */
const SPACE_OTHER_PLACE =
  /\b(mumbai|dadar|andheri|bhavnagar|bhubaneswar|jamnagar|delhi|gurugram|bengaluru|bangalore|hyderabad|chennai|kolkata|jaipur|udaipur|goa|nagpur|nashik|indore|surat|ahmedabad|lucknow|kochi|chandigarh|zirakpur)\b/i;

/** A property name is not a hall: "Garden Villa Resort" is the venue itself. */
const SPACE_PROPERTY = /\b(resort|hotel|villas?|banquets?\s+and\s+conventions?)\s*$/i;

export interface DerivedSpace {
  name: string;
  capacitySeated: number | null;
  isIndoor: boolean;
  isOutdoor: boolean;
}

/**
 * Hall and lawn names, from the workbook when it has real ones and from the
 * site's headings otherwise.
 *
 * The workbook's `venue_spaces` column is mostly a note to the researcher
 * ("Banquets / meeting spaces - confirm"), so anything containing "confirm" is
 * dropped rather than published as a space name.
 */
export function deriveSpaces(
  workbookSpaces: readonly string[],
  headings: readonly string[],
  venueName = '',
): DerivedSpace[] {
  const names = new Map<string, DerivedSpace>();
  const venueKey = venueName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const add = (raw: string): void => {
    const name = collapseWhitespace(raw).replace(/[.:;,\-–—]+$/, '');
    if (name.length < 4 || name.length > 60) return;
    // A heading that is just the property's own name is not one of its halls.
    if (
      venueKey &&
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim() === venueKey
    )
      return;
    if (/confirm|verify|tbc|tba/i.test(name)) return;
    if (SPACE_NOISE.test(name)) return;
    if (SPACE_HEADLINE.test(name)) return;
    if (SPACE_OTHER_PLACE.test(name)) return;
    if (SPACE_PROPERTY.test(name)) return;
    if (!SPACE_NAME.test(name)) return;
    const key = name.toLowerCase();
    if (names.has(key)) return;

    const capacity = /(\d{2,4})\s*(?:guests|pax|people|persons)/i.exec(name);
    const seated = capacity ? Number(capacity[1]) : null;
    const outdoor = /lawn|garden|terrace|poolside|deck|outdoor|open\s*air/i.test(name);

    names.set(key, {
      name,
      capacitySeated: seated && seated >= 50 && seated <= 5000 ? seated : null,
      isIndoor: !outdoor,
      isOutdoor: outdoor,
    });
  };

  for (const space of workbookSpaces) add(space);
  for (const heading of headings) add(heading);

  return [...names.values()].filter((space) => hasDistinctiveWord(space.name)).slice(0, 6);
}

/**
 * Words that describe *what kind* of space it is, not *which* space it is.
 * A name made only of these ("Banquet Halls Pune", "Outdoor Wedding & Convention
 * Lawns") is a navigation heading, not a hall anyone can book.
 */
const GENERIC_SPACE_WORDS = new Set([
  'banquet',
  'banquets',
  'hall',
  'halls',
  'lawn',
  'lawns',
  'space',
  'spaces',
  'venue',
  'venues',
  'wedding',
  'weddings',
  'outdoor',
  'indoor',
  'elegant',
  'grand',
  'function',
  'functions',
  'convention',
  'garden',
  'gardens',
  'terrace',
  'ballroom',
  'poolside',
  'deck',
  'pavilion',
  'mandap',
  'auditorium',
  'premium',
  'luxury',
  'best',
  'top',
  'perfect',
  'dream',
  'pune',
  'city',
  'the',
  'and',
  'for',
  'your',
  'our',
  'with',
  'in',
  'at',
  'of',
  'a',
  'an',
]);

function hasDistinctiveWord(name: string): boolean {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.some((word) => word.length >= 3 && !GENERIC_SPACE_WORDS.has(word));
}

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------

export interface DerivedPackage {
  name: string;
  description: string;
  price: number | null;
  priceUnit: 'PER_PLATE' | 'PER_PERSON' | 'PER_DAY' | 'PER_EVENT' | 'PER_PACKAGE' | null;
  minGuests: number | null;
  maxGuests: number | null;
  inclusions: string[];
  exclusions: string[];
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Packages from the prices a venue actually publishes.
 *
 * Indian venue sites rarely publish a full price list, so this produces at most
 * one package per price unit and always adds an unpriced "tailored quote" card
 * when nothing was found. An unpriced card is honest; an invented ₹ figure is
 * not.
 */
export function derivePackages(
  prices: readonly PriceMention[],
  capacity: number | null,
  amenities: readonly string[],
  venueType = 'Venue',
  eventTypes: readonly string[] = [],
): DerivedPackage[] {
  const packages: DerivedPackage[] = [];
  const byUnit = new Map<PriceMention['unit'], number[]>();

  for (const price of prices) {
    if (price.unit === 'UNKNOWN') continue;
    const amounts = byUnit.get(price.unit) ?? [];
    amounts.push(price.amount);
    byUnit.set(price.unit, amounts);
  }

  const inclusions = [
    amenities.includes('air-conditioned') ? 'Air-conditioned space' : null,
    amenities.includes('in-house-catering') ? 'In-house kitchen' : null,
    amenities.includes('valet-parking') ? 'Valet parking' : null,
    amenities.includes('backup-power') ? 'Generator backup' : null,
    amenities.includes('stage') ? 'Built-in stage' : null,
    amenities.includes('bridal-suite') ? 'Bridal suite' : null,
  ].filter((item): item is string => item !== null);

  const exclusions = ['Decor and florals', 'Photography and videography', 'Alcohol licence'];

  const plate = byUnit.get('PER_PLATE') ?? byUnit.get('PER_PERSON');
  if (plate && plate.length > 0) {
    const min = Math.min(...plate);
    const max = Math.max(...plate);
    packages.push({
      name: 'Per-plate menu',
      description:
        min === max
          ? `Published menu rate of ${formatRupees(min)} per plate.`
          : `Published menu rates from ${formatRupees(min)} to ${formatRupees(max)} per plate.`,
      price: min,
      priceUnit: 'PER_PLATE',
      minGuests: capacity ? Math.max(50, Math.round(capacity * 0.5)) : null,
      maxGuests: capacity,
      inclusions: ['Multi-cuisine menu', 'Service staff', ...inclusions],
      exclusions,
    });
  }

  const event = byUnit.get('PER_EVENT') ?? byUnit.get('PER_PACKAGE');
  if (event && event.length > 0) {
    const min = Math.min(...event);
    packages.push({
      name: 'Event package',
      description: `Published event rate from ${formatRupees(min)}.`,
      price: min,
      priceUnit: 'PER_EVENT',
      minGuests: null,
      maxGuests: capacity,
      inclusions: ['Exclusive venue access', ...inclusions],
      exclusions,
    });
  }

  const day = byUnit.get('PER_DAY');
  if (day && day.length > 0) {
    const min = Math.min(...day);
    packages.push({
      name: 'Day hire',
      description: `Published day rate from ${formatRupees(min)}.`,
      price: min,
      priceUnit: 'PER_DAY',
      minGuests: null,
      maxGuests: capacity,
      inclusions: ['Venue access for one day', ...inclusions],
      exclusions,
    });
  }

  if (packages.length > 0) return packages;

  // Nothing was published. Rather than invent a figure, describe what the venue
  // has confirmed it provides and say plainly that the price is a quote.
  const isResidential = /hotel|resort/i.test(venueType);
  const isOutdoor = /lawn|farmhouse|garden/i.test(venueType);
  const quoteNote =
    'This venue quotes per event rather than publishing a price list. Ask for a written estimate covering the space, catering and decor.';

  const primary: DerivedPackage = {
    name: isResidential
      ? 'Wedding venue quote'
      : isOutdoor
        ? 'Outdoor function quote'
        : 'Reception quote',
    description: quoteNote,
    price: null,
    priceUnit: null,
    minGuests: null,
    maxGuests: capacity,
    inclusions: [
      'Exclusive use of the booked space',
      ...(isResidential ? ['Room block for the wedding party'] : []),
      ...inclusions,
    ],
    exclusions,
  };
  packages.push(primary);

  if (eventTypes.includes('corporate-event')) {
    packages.push({
      name: 'Corporate day quote',
      description:
        'Conference and offsite bookings are quoted per day. Ask for AV, tea-break and delegate-parking costs in writing.',
      price: null,
      priceUnit: null,
      minGuests: null,
      maxGuests: capacity,
      inclusions: [
        'Meeting or banquet space for the day',
        amenities.includes('av-system') ? 'Projector and sound system' : 'Space for AV setup',
        amenities.includes('air-conditioned') ? 'Air-conditioned space' : 'Natural ventilation',
      ],
      exclusions: ['AV rental (confirm)', 'Accommodation', 'Airport transfers'],
    });
  }

  return packages;
}

// ---------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------

const PROSE_NOISE =
  /^click here|^find out|^learn more|cookie|©|all rights reserved|privacy policy|terms (of|and)|subscribe|newsletter|sign up|follow us|whatsapp|call us|email us|book now|read more|view all|download brochure|site by|powered by/i;

const PROSE_SIGNAL =
  /wedding|banquet|celebrat|guest|hall|lawn|event|venue|capacity|cuisine|decor|hospitality|experience|resort|suite|pool|conference|reception|sangeet|menu/i;

function sentenceSplit(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => collapseWhitespace(sentence))
    .filter(Boolean);
}

/** Keeps the first `count` sentences, capped at `limit` characters. */
function firstSentences(text: string, count: number, limit: number): string {
  const sentences = sentenceSplit(text).slice(0, count).join(' ');
  return truncate(sentences || text, limit);
}

export interface Prose {
  description: string;
  about: string;
}

const OTHER_CITIES = [
  'mumbai',
  'navi mumbai',
  'thane',
  'delhi',
  'new delhi',
  'gurugram',
  'gurgaon',
  'noida',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'chennai',
  'kolkata',
  'ahmedabad',
  'surat',
  'vadodara',
  'jaipur',
  'udaipur',
  'jodhpur',
  'goa',
  'zirakpur',
  'chandigarh',
  'indore',
  'nagpur',
  'nashik',
  'aurangabad',
  'kolhapur',
  'lucknow',
  'kochi',
  'coimbatore',
  'shimla',
  'manali',
  'rishikesh',
  'dehradun',
  'srinagar',
  'amritsar',
  'bhopal',
  'raipur',
  'visakhapatnam',
  // International places that appear when a workbook row points at a group site
  // rather than the property: uhotelsresorts.com/urivergatekarjat served a page
  // about a resort in Thailand.
  'thailand',
  'bali',
  'dubai',
  'maldives',
  'sri lanka',
  'singapore',
  'vietnam',
  'phuket',
  'koh samui',
  'koh chang',
  'mauritius',
  'seychelles',
  'egypt',
  'turkey',
  'greece',
  'spain',
  'italy',
  'indonesia',
  'malaysia',
  'oman',
  'qatar',
  'bahrain',
  'kuwait',
  'nepal',
  'bhutan',
  'cambodia',
  'philippines',
  'japan',
  'australia',
  'london',
  'united states',
] as const;

/**
 * A parked or hijacked domain serves gambling spam under a hotel's old name.
 * `hotelauroratowers.com` does exactly that, so the copy is never published.
 */
const SPAM_PROSE = /\b(rtp|gacor|togel|judi|maxwin|situs|bandar|casino|betting|poker|jackpot)\b/i;

export function looksLikeSpam(text: string): boolean {
  return SPAM_PROSE.test(text);
}

/** A page that talks about hiring the venue out beats one that sells rooms. */
function pageRelevance(pageUrl: string): number {
  const url = pageUrl.toLowerCase();
  if (/wedding/.test(url)) return 5;
  if (/banquet|venue|hall|lawn/.test(url)) return 4;
  if (/event|celebration|corporate|conference/.test(url)) return 3;
  if (/gallery|photo/.test(url)) return 1;
  if (/room|suite|offer|stay|dining|spa/.test(url)) return 0;
  return 2;
}

function isUsableProse(paragraph: string): boolean {
  if (paragraph.length < 90 || paragraph.length > 900) return false;
  if (PROSE_NOISE.test(paragraph)) return false;

  const words = paragraph.split(/\s+/);
  const upper = words.filter((word) => word.length > 3 && word === word.toUpperCase()).length;
  if (upper / words.length >= 0.4) return false;

  // A comma-separated inventory ("Havankund, Chaurang (1) + Paat (2), Taat (6)…")
  // is a packing list, not a description. Real prose has far fewer commas than
  // words and at least one full stop.
  const commas = (paragraph.match(/,/g) ?? []).length;
  if (commas > 4 && commas / words.length > 0.12) return false;
  if (!/[.!?]/.test(paragraph)) return false;

  return true;
}

/**
 * Picks the two most useful things a venue published about itself.
 *
 * Venue home pages are mostly navigation, cookie notices and offer banners, and
 * the page that describes hiring the venue is rarely the home page. Candidates
 * are therefore scored by the page they came from first, then by how much the
 * text reads like a venue description. The site's own `og:description` is used
 * for the card line when it is substantial, because that is the sentence the
 * venue chose to represent itself.
 */
export function composeProse(
  pages: readonly { url: string; description: string | null; paragraphs: readonly string[] }[],
  fallback: {
    name: string;
    venueType: string;
    area: string;
    cityName: string;
    eventTypes: readonly string[];
  },
): Prose {
  const expectedCity = fallback.cityName.toLowerCase();
  const candidates: { text: string; score: number }[] = [];

  for (const page of pages) {
    const relevance = pageRelevance(page.url);

    if (page.description) {
      const description = cleanProse(page.description);
      if (description.length >= 80 && description.length <= 400 && !PROSE_NOISE.test(description)) {
        // The nominated summary outranks any paragraph on the same page.
        let score = relevance + 6;
        const lower = description.toLowerCase();
        if (lower.includes(expectedCity)) score += 4;
        else if (OTHER_CITIES.some((city) => new RegExp(`\\b${city}\\b`).test(lower))) score -= 6;
        candidates.push({ text: description, score });
      }
    }

    for (const raw of page.paragraphs) {
      const text = cleanProse(raw);
      if (!isUsableProse(text)) continue;
      let score = relevance;
      if (PROSE_SIGNAL.test(text)) score += 3;
      score += Math.min(3, Math.floor(text.length / 220));
      if (/^(welcome|about us|our story)/i.test(text)) score += 1;

      // Group sites carry copy for every property in the group. Prefer the text
      // that names the city this listing is actually in.
      const lower = text.toLowerCase();
      if (lower.includes(expectedCity)) score += 4;
      else if (OTHER_CITIES.some((city) => new RegExp(`\\b${city}\\b`).test(lower))) score -= 6;

      candidates.push({ text, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const chosen: string[] = [];
  for (const { text } of candidates) {
    const key = text.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(text);
    if (chosen.length === 2) break;
  }

  if (chosen.length === 0) {
    const eventList = fallback.eventTypes.length > 0 ? fallback.eventTypes.join(', ') : 'events';
    const description =
      `${fallback.name} is a ${fallback.venueType.toLowerCase()} in ${fallback.area}, ` +
      `${fallback.cityName}, available for ${eventList}.`;
    return {
      description,
      about:
        'The venue has not published a description of its own. Enquire for the current ' +
        'capacity, menus and package terms.',
    };
  }

  const description = firstSentences(chosen[0] as string, 2, 320);
  const about = chosen[1]
    ? firstSentences(chosen[1], 3, 700)
    : firstSentences(chosen[0] as string, 4, 700);

  return { description, about };
}

/** A short card line: the first clause of the description, or a factual summary. */
export function composeTagline(
  description: string,
  fallback: { venueType: string; area: string; capacity: number | null },
): string {
  const first = sentenceSplit(description)[0] ?? description;
  const candidate = truncate(first, 90);
  if (candidate.length >= 30) return candidate;

  const capacity = fallback.capacity ? ` seating up to ${fallback.capacity}` : '';
  return `${fallback.venueType} in ${fallback.area}${capacity}`;
}

// ---------------------------------------------------------------------------
// Provenance sanity checks
// ---------------------------------------------------------------------------

/**
 * Cities that appear on Indian venue sites. Used only to notice that a workbook
 * row points at the wrong business: `theambiencehotel.com` is a Zirakpur hotel,
 * and publishing it as "Hotel Ambience, Model Colony, Pune" would be a false
 * claim about a real business.
 */

/**
 * Returns a city the page claims that is not the one the workbook says, or null.
 *
 * Only fires when the expected city is *absent* from the text. A Lonavala resort
 * that mentions Mumbai ("a 90-minute drive from Mumbai") is normal; a "Pune"
 * venue whose copy never mentions Pune and does mention Zirakpur is not.
 */
export function detectLocationConflict(text: string, expectedCityName: string): string | null {
  const haystack = text.toLowerCase();
  if (haystack.includes(expectedCityName.toLowerCase())) return null;

  for (const city of OTHER_CITIES) {
    if (new RegExp(`\\b${city}\\b`).test(haystack)) return city;
  }
  return null;
}
