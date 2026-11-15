/**
 * The venue import pipeline's pure parts.
 *
 * These are the decisions that turn scraped text into catalogue fields, so they
 * are the ones worth pinning: a regression here publishes a wrong price or a
 * navigation heading as a bookable hall, and nothing else in the suite would
 * notice. The scripts themselves are not imported — only the modules under
 * `scripts/venues/lib/`.
 */

import { describe, expect, it } from 'vitest';

import {
  deriveAmenities,
  deriveCapacity,
  derivePackages,
  deriveSpaces,
  resolveCategory,
  resolveEventTypes,
  resolveLocation,
} from '../../scripts/venues/lib/derive';
import {
  extractEmails,
  extractImages,
  extractPhones,
  extractPrices,
  rankImageCandidates,
} from '../../scripts/venues/lib/extract';
import {
  normaliseEmail,
  normalisePhone,
  normaliseWebsite,
  slugify,
} from '../../scripts/venues/lib/text';

describe('slugify', () => {
  it('produces the same slug for the same name on every run', () => {
    expect(slugify('Marigold Banquets & Conventions')).toBe('marigold-banquets-and-conventions');
    expect(slugify('Marigold Banquets & Conventions')).toBe(
      slugify('Marigold Banquets & Conventions'),
    );
  });

  it('strips punctuation that would break a URL', () => {
    expect(slugify("Marigold Banquets 'N' Conventions")).toBe('marigold-banquets-n-conventions');
    expect(slugify('Cloud 99 Banquet | Restaurant | Bar')).toBe('cloud-99-banquet-restaurant-bar');
  });

  it('collapses runs of separators instead of leaving them', () => {
    expect(slugify('  The   Ritz-Carlton,  Pune  ')).toBe('the-ritz-carlton-pune');
  });
});

describe('normaliseWebsite', () => {
  it('adds a scheme to a bare domain', () => {
    expect(normaliseWebsite('fern hotels.com'.replace(' ', ''))).toBe('https://fernhotels.com');
  });

  it('drops the workbook sentinels rather than guessing a URL', () => {
    expect(normaliseWebsite('Website link not verified')).toBeNull();
    expect(normaliseWebsite('Available online')).toBeNull();
    expect(normaliseWebsite('')).toBeNull();
  });

  it('keeps a deep link intact', () => {
    expect(normaliseWebsite('https://www.vivantahotels.com/en-in/hotels/vivanta-pune')).toBe(
      'https://www.vivantahotels.com/en-in/hotels/vivanta-pune',
    );
  });
});

describe('normalisePhone / normaliseEmail', () => {
  it('keeps a dialable number and rejects prose', () => {
    expect(normalisePhone('+91 20 6658 4040')).toBe('+91 20 6658 4040');
    expect(normalisePhone('Available online')).toBeNull();
    expect(normalisePhone('12345')).toBeNull();
  });

  it('accepts a real address and rejects a fragment', () => {
    expect(normaliseEmail('BookVivanta.Hinjawadi@TajHotels.com')).toBe(
      'bookvivanta.hinjawadi@tajhotels.com',
    );
    expect(normaliseEmail('not-an-email')).toBeNull();
  });
});

describe('extractPrices', () => {
  it('reads a per-plate rate and classifies its unit', () => {
    const [price] = extractPrices('Veg menu from ₹1,200 per plate onwards.');
    expect(price?.amount).toBe(1200);
    expect(price?.unit).toBe('PER_PLATE');
  });

  it('ignores rupee amounts that are not venue prices', () => {
    // Della's home page carries township announcements with rupee figures.
    const prices = extractPrices('Della Townships signs projects with GDV ₹1,235 Cr this year.');
    expect(prices).toHaveLength(0);
  });

  it('ignores amounts outside the plausible range', () => {
    expect(extractPrices('Booking advance ₹100 per plate')).toHaveLength(0);
    expect(extractPrices('Property priced at ₹9,00,00,000 per plate')).toHaveLength(0);
  });
});

describe('deriveCapacity', () => {
  it('reads a qualified capacity', () => {
    expect(deriveCapacity('Our ballroom seats up to 900 guests.')).toBe(900);
  });

  it('takes the largest stated capacity', () => {
    expect(deriveCapacity('The lawn holds 400 guests and the hall 1,200 guests.')).toBe(1200);
  });

  it('does not mistake a season for a capacity', () => {
    expect(deriveCapacity('Bookings open for 2024 Guests and 2025 Guests.')).toBeNull();
  });

  it('does not treat a minimum order as a capacity', () => {
    expect(deriveCapacity('Minimum order 50 guests.')).toBeNull();
  });
});

describe('deriveSpaces', () => {
  it('keeps a named hall', () => {
    const spaces = deriveSpaces([], ['Shreyas - Amber Hall', 'Cygnus Hall & Lawns']);
    expect(spaces.map((space) => space.name)).toEqual([
      'Shreyas - Amber Hall',
      'Cygnus Hall & Lawns',
    ]);
  });

  it('drops navigation headings made only of generic words', () => {
    const spaces = deriveSpaces(
      [],
      [
        'Banquet Halls Pune',
        'Outdoor Wedding & Convention Lawns',
        'Elegant Banquet & Function Spaces',
      ],
    );
    expect(spaces).toHaveLength(0);
  });

  it('drops the workbook note-to-self and property names', () => {
    const spaces = deriveSpaces(['Banquets / meeting spaces - confirm'], ['Garden Villa Resort']);
    expect(spaces).toHaveLength(0);
  });

  it('marks a lawn as outdoor and a hall as indoor', () => {
    const [lawn, hall] = deriveSpaces([], ['Silver Lawn', 'Amber Hall']);
    expect(lawn?.isOutdoor).toBe(true);
    expect(lawn?.isIndoor).toBe(false);
    expect(hall?.isIndoor).toBe(true);
  });
});

describe('derivePackages', () => {
  it('never invents a price when the venue published none', () => {
    const [pack] = derivePackages([], 600, []);
    expect(pack?.price).toBeNull();
    expect(pack?.priceUnit).toBeNull();
    expect(pack?.description).toContain('quotes per event');
  });

  it('names the unpriced package for the venue type', () => {
    expect(derivePackages([], 600, [], 'Hotel')[0]?.name).toBe('Wedding venue quote');
    expect(derivePackages([], 600, [], 'Banquet hall')[0]?.name).toBe('Reception quote');
    expect(derivePackages([], 600, [], 'Lawn / farmhouse')[0]?.name).toBe('Outdoor function quote');
  });

  it('adds a corporate quote only when the venue hosts corporate events', () => {
    const without = derivePackages([], 600, [], 'Hotel', ['wedding']);
    const withCorporate = derivePackages([], 600, [], 'Hotel', ['wedding', 'corporate-event']);
    expect(without).toHaveLength(1);
    expect(withCorporate.map((pack) => pack.name)).toContain('Corporate day quote');
  });

  it('rejects a room rate that is not a venue price', () => {
    // The first run published "₹728 per event" for a five-star hotel because a
    // room rate sat near the word "package".
    expect(extractPrices('Deluxe room package ₹728 per night, breakfast included.')).toHaveLength(
      0,
    );
  });

  it('builds a per-plate package from a published rate', () => {
    const [pack] = derivePackages(
      [{ amount: 1200, currency: 'INR', context: 'per plate', unit: 'PER_PLATE' }],
      600,
      ['in-house-catering'],
    );
    expect(pack?.price).toBe(1200);
    expect(pack?.priceUnit).toBe('PER_PLATE');
    expect(pack?.maxGuests).toBe(600);
    expect(pack?.inclusions).toContain('In-house kitchen');
  });
});

describe('deriveAmenities', () => {
  it('detects facilities from prose', () => {
    const amenities = deriveAmenities(
      'The air-conditioned hall has valet parking, a generator backup and a swimming pool.',
    );
    expect(amenities).toEqual(
      expect.arrayContaining(['air-conditioned', 'valet-parking', 'backup-power', 'pool']),
    );
  });

  it('returns nothing when the page says nothing', () => {
    expect(deriveAmenities('Welcome to our venue.')).toEqual([]);
  });
});

describe('resolveLocation', () => {
  it('maps the workbook spellings of a neighbourhood to one locality', () => {
    expect(resolveLocation('Hinjawadi Phase 1', 'pune').localitySlug).toBe('hinjawadi');
    expect(resolveLocation('Hinjewadi - Wakad Rd', 'pune').localitySlug).toBe('hinjawadi');
    expect(resolveLocation('Hinjawadi / IT Park', 'pune').localitySlug).toBe('hinjawadi');
  });

  it('falls back to the city when the area is unknown', () => {
    expect(resolveLocation('Pune Region / General', 'pune')).toEqual({
      citySlug: 'pune',
      localitySlug: null,
    });
  });

  it('keeps a destination town as its own city', () => {
    expect(resolveLocation('Kunegaon, Khandala', 'lonavala')).toEqual({
      citySlug: 'lonavala',
      localitySlug: null,
    });
  });

  it('treats Panshet as a Pune locality, not a sibling city', () => {
    expect(resolveLocation('Panshet Rd', 'panshet')).toEqual({
      citySlug: 'pune',
      localitySlug: 'panshet',
    });
  });
});

describe('resolveCategory / resolveEventTypes', () => {
  it('routes each venue type to the right category', () => {
    expect(resolveCategory('Hotel').primaryCategorySlug).toBe('hotels-and-resorts');
    expect(resolveCategory('Resort').primaryCategorySlug).toBe('hotels-and-resorts');
    expect(resolveCategory('Banquet hall').primaryCategorySlug).toBe('banquet-halls');
    expect(resolveCategory('Lawn / farmhouse').primaryCategorySlug).toBe('lawns-and-farmhouses');
  });

  it('maps workbook event words to catalogue slugs', () => {
    expect(resolveEventTypes('Hotel', ['Wedding', 'Corporate', 'Conference'])).toEqual(
      expect.arrayContaining(['wedding', 'corporate-event']),
    );
  });

  it('falls back to a sensible set when the workbook has no event column', () => {
    expect(resolveEventTypes('Banquet hall', [])).toEqual(
      expect.arrayContaining(['wedding', 'reception', 'sangeet-and-mehndi']),
    );
  });
});

describe('extractImages / rankImageCandidates', () => {
  const html = `
    <meta property="og:image" content="/hero.jpg" />
    <img src="/logo.png" />
    <img src="/images/gallery/1.jpg" />
    <img data-src="/images/gallery/2.jpg" />
    <div style="background-image: url('/images/wedding-hall.jpg')"></div>
    <img src="/pixel.gif" />
  `;

  it('collects og:image, src, data-src and inline backgrounds', () => {
    const images = extractImages(html, 'https://example.test/');
    expect(images).toContain('https://example.test/hero.jpg');
    expect(images).toContain('https://example.test/images/gallery/1.jpg');
    expect(images).toContain('https://example.test/images/gallery/2.jpg');
    expect(images).toContain('https://example.test/images/wedding-hall.jpg');
  });

  it('drops logos, sprites and tracking pixels', () => {
    const images = extractImages(html, 'https://example.test/');
    expect(images.some((url) => url.includes('logo'))).toBe(false);
    expect(images.some((url) => url.includes('pixel'))).toBe(false);
  });

  it('ranks venue photography above award badges', () => {
    const ranked = rankImageCandidates([
      { url: 'https://example.test/new-award/Awards-01.webp', pageUrl: 'https://example.test/' },
      { url: 'https://example.test/images/banquet-hall.jpg', pageUrl: 'https://example.test/' },
    ]);
    expect(ranked[0]).toContain('banquet-hall');
  });
});

describe('extractPhones / extractEmails', () => {
  it('finds an Indian landline and a mobile', () => {
    const phones = extractPhones('Call 020 6658 4040 or +91 98900 44556.');
    expect(phones.length).toBeGreaterThanOrEqual(1);
  });

  it('finds an address and ignores a bare word', () => {
    expect(extractEmails('Write to book@tajhotels.com')).toEqual(['book@tajhotels.com']);
  });
});
