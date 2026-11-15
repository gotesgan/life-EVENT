/**
 * Step 4 of the venue import pipeline: source + scrape + media → listings.
 *
 * Produces `data/venues/listings.json`, which is the reviewable artefact: every
 * field the importer will write, plus the provenance of each fact. Nothing here
 * touches the database, so a bad derivation is fixed by editing this step and
 * re-running it — not by repairing rows.
 *
 * Run: pnpm tsx scripts/venues/build.mts [--only=slug] [--draft]
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SourceVenue } from './lib/source';
import type { ScrapeResult } from './lib/scrape';
import type {
  ImportedAttribute,
  ImportedListing,
  ImportedService,
  ImportedSpace,
  VenuePhoto,
} from './lib/listing';
import {
  composeProse,
  composeTagline,
  deriveAmenities,
  deriveCapacity,
  derivePackages,
  deriveSpaces,
  detectLocationConflict,
  looksLikeSpam,
  resolveCategory,
  resolveEventTypes,
  resolveLocation,
} from './lib/derive';
import { extractPrices } from './lib/extract';
import { collapseWhitespace, truncate } from './lib/text';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDirectory = join(root, '.cache/venues');
const outputPath = join(root, 'data/venues/listings.json');

const CITY_NAMES: Record<string, string> = {
  pune: 'Pune',
  lonavala: 'Lonavala',
  karjat: 'Karjat',
  mulshi: 'Mulshi',
  panshet: 'Panshet',
  khadakwasla: 'Khadakwasla',
};

/** Fixed epoch so `publishedAt` is identical on every run. */
const PUBLISHED_BASE_MS = Date.UTC(2026, 5, 1, 6, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

function venueTypeAttribute(venueType: string): string {
  const type = venueType.toLowerCase();
  if (/resort/.test(type)) return 'resort';
  if (/hotel/.test(type)) return 'hotel';
  if (/farmhouse/.test(type)) return 'farmhouse';
  if (/lawn|garden/.test(type)) return 'lawn';
  if (/convention/.test(type)) return 'convention-centre';
  if (/heritage/.test(type)) return 'heritage-property';
  return 'banquet-hall';
}

function buildAttributes(input: {
  venueType: string;
  capacity: number | null;
  spaces: ImportedSpace[];
  amenities: string[];
  text: string;
}): ImportedAttribute[] {
  const attributes: ImportedAttribute[] = [];

  if (input.capacity) attributes.push({ code: 'guest_capacity', number: input.capacity });

  attributes.push({ code: 'venue_type', optionValues: [venueTypeAttribute(input.venueType)] });

  const outdoor = input.spaces.some((space) => space.isOutdoor);
  const indoor = input.spaces.some((space) => space.isIndoor);
  attributes.push({
    code: 'indoor_outdoor',
    optionValues: [indoor && outdoor ? 'both' : outdoor ? 'outdoor' : 'indoor'],
  });

  if (/in[\s-]?house\s*catering|own\s*kitchen/i.test(input.text)) {
    attributes.push({ code: 'catering_policy', optionValue: 'in-house-only' });
  } else if (/empanelled|approved\s*caterer/i.test(input.text)) {
    attributes.push({ code: 'catering_policy', optionValue: 'empanelled-caterers' });
  } else if (/outside\s*caterer|external\s*caterer/i.test(input.text)) {
    attributes.push({ code: 'catering_policy', optionValue: 'outside-catering-allowed' });
  }

  if (/hotel|resort/i.test(input.venueType)) {
    attributes.push({ code: 'accommodation', boolean: true });
  }

  const parking =
    /(\d{2,4})\s*(?:car|vehicle)\s*parking|parking\s*(?:for|up\s*to)\s*(\d{2,4})/i.exec(input.text);
  const parkingCount = Number(parking?.[1] ?? parking?.[2] ?? 0);
  if (parkingCount >= 10 && parkingCount <= 2000) {
    attributes.push({ code: 'parking_capacity', number: parkingCount });
  }

  if (input.spaces.length > 0) {
    attributes.push({ code: 'number_of_spaces', number: input.spaces.length });
  }

  return attributes;
}

function buildServices(input: {
  venueType: string;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  capacity: number | null;
  amenities: string[];
}): ImportedService[] {
  const includes = [
    'Exclusive use of the booked space',
    input.amenities.includes('air-conditioned') ? 'Air conditioning' : null,
    input.amenities.includes('valet-parking') ? 'Valet parking' : null,
    input.amenities.includes('backup-power') ? 'Generator backup' : null,
  ].filter((item): item is string => item !== null);

  const services: ImportedService[] = [
    {
      name: `${input.venueType} hire`,
      description: input.capacity
        ? `Exclusive venue hire for up to ${input.capacity} guests.`
        : 'Exclusive venue hire; capacity to be confirmed with the venue.',
      priceFrom: input.priceMin,
      priceTo: input.priceMax,
      priceUnit: input.priceUnit,
      durationMinutes: 480,
      includes,
    },
  ];

  if (/hotel|resort/i.test(input.venueType)) {
    services.push({
      name: 'Residential wedding',
      description: 'Venue hire with guest rooms held for the wedding party.',
      priceFrom: null,
      priceTo: null,
      priceUnit: null,
      durationMinutes: 1440,
      includes: ['Room block for guests', 'Breakfast for resident guests', ...includes],
    });
  }

  return services;
}

function buildListing(
  venue: SourceVenue,
  scrape: ScrapeResult | null,
  photos: VenuePhoto[],
  index: number,
  draft: boolean,
): ImportedListing {
  // The address is often more specific than the area column ("Mumbai-Bangalore
  // Hwy" vs "Pune–Bangalore Highway, Balewadi"), so both feed the resolver.
  const location = resolveLocation(`${venue.area} ${venue.address ?? ''}`, venue.city);
  const category = resolveCategory(venue.venueType);
  const eventTypes = resolveEventTypes(venue.venueType, venue.eventTypes);

  const pages = scrape?.pages ?? [];
  const headings = pages.flatMap((page) => page.headings);
  const paragraphs = pages.flatMap((page) => page.paragraphs);
  const text = collapseWhitespace([...paragraphs, ...headings].join(' '));

  const capacity = deriveCapacity(text);
  const spaces = deriveSpaces(venue.venueSpaces, headings, venue.name).map((space) => ({
    name: space.name,
    description: '',
    capacitySeated: space.capacitySeated,
    capacityStanding: null,
    areaSqft: null,
    isIndoor: space.isIndoor,
    isOutdoor: space.isOutdoor,
    layoutOptions: [],
  }));
  const amenities = deriveAmenities(text);

  // Prices are re-derived from the cached page text rather than read from the
  // scrape's own list, so tightening the price filter is a rebuild instead of a
  // re-scrape of every site.
  const prices = extractPrices(text);

  const prose = composeProse(
    pages.map((page) => ({
      url: page.url,
      description: page.description,
      paragraphs: page.paragraphs,
    })),
    {
      name: venue.name,
      venueType: venue.venueType,
      area: venue.area,
      cityName: CITY_NAMES[venue.city] ?? 'Pune',
      eventTypes,
    },
  );

  const tagline = composeTagline(prose.description, {
    venueType: venue.venueType,
    area: venue.area,
    capacity,
  });

  const packages = derivePackages(prices, capacity, amenities, venue.venueType, eventTypes);
  const priced = packages.filter((pack) => pack.price !== null);
  const priceMin =
    priced.length > 0 ? Math.min(...priced.map((pack) => pack.price as number)) : null;
  const priceMax =
    priced.length > 0 ? Math.max(...priced.map((pack) => pack.price as number)) : null;
  const priceUnit = priced[0]?.priceUnit ?? null;

  const phone = venue.phone ?? scrape?.phones[0] ?? null;
  const email = venue.email ?? scrape?.emails[0] ?? null;

  // A listing without photographs or prose is not worth publishing: it would
  // render as an empty card in the browse grid.
  const publishable = photos.length >= 3 && paragraphs.length > 0;

  // A workbook row can point at the wrong business entirely. Publishing another
  // city's hotel under this name would be a false claim, so it stays a draft
  // with the reason recorded.
  const cityName = CITY_NAMES[venue.city] ?? 'Pune';
  const conflict = detectLocationConflict(`${prose.description} ${prose.about}`, cityName);
  const spam = looksLikeSpam(`${prose.description} ${prose.about} ${text}`);

  const publicationStatus = !draft && publishable && !conflict && !spam ? 'PUBLISHED' : 'DRAFT';

  return {
    slug: venue.slug,
    name: venue.name,
    tagline,
    description: prose.description,
    about: prose.about,
    primaryCategorySlug: category.primaryCategorySlug,
    secondaryCategorySlugs: category.secondaryCategorySlugs,
    primaryLocationSlug: location.localitySlug ?? location.citySlug,
    serviceAreaSlugs: [location.citySlug],
    eventTypeSlugs: eventTypes,
    publicationStatus,
    verificationStatus: 'UNVERIFIED',
    isFeatured: false,
    publishedAt:
      publicationStatus === 'PUBLISHED'
        ? new Date(PUBLISHED_BASE_MS + index * 3 * DAY_MS).toISOString()
        : null,
    contactPersonName: null,
    contactPhone: phone,
    contactEmail: email,
    contactWhatsapp: null,
    websiteUrl: venue.websiteUrl,
    showPhone: Boolean(phone),
    showEmail: Boolean(email),
    showWhatsapp: false,
    showWebsite: Boolean(venue.websiteUrl),
    addressLine1: venue.address ? truncate(venue.address, 180) : null,
    addressLine2: null,
    postalCode: venue.postalCode,
    latitude: null,
    longitude: null,
    priceMin,
    priceMax,
    priceUnit,
    capacityMin: null,
    capacityMax: capacity,
    amenityCodes: amenities,
    services: buildServices({
      venueType: venue.venueType,
      priceMin,
      priceMax,
      priceUnit,
      capacity,
      amenities,
    }),
    packages,
    venueSpaces: spaces,
    attributes: buildAttributes({ venueType: venue.venueType, capacity, spaces, amenities, text }),
    media: photos,
    provenance: {
      websiteUrl: venue.websiteUrl,
      finalUrl: scrape?.finalUrl ?? null,
      scrapeStatus: scrape?.status ?? 'no-website',
      scrapedAt: scrape?.scrapedAt ?? null,
      workbooks: venue.sources,
      notes: spam
        ? `${venue.notes ? `${venue.notes} ` : ''}Held as a draft: the domain now serves unrelated spam content.`
        : conflict
          ? `${venue.notes ? `${venue.notes} ` : ''}Held as a draft: the site describes a venue in ${conflict}, not ${cityName}.`
          : venue.notes,
    },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = argv.find((argument) => argument.startsWith('--only='))?.slice('--only='.length);
  const draft = argv.includes('--draft');

  const venues: SourceVenue[] = JSON.parse(
    await readFile(join(root, 'data/venues/source-venues.json'), 'utf8'),
  );
  const media: Record<string, VenuePhoto[]> = await readFile(
    join(root, 'data/venues/media.json'),
    'utf8',
  )
    .then((raw) => JSON.parse(raw) as Record<string, VenuePhoto[]>)
    .catch(() => ({}));

  const scrapes = new Map<string, ScrapeResult>();
  for (const file of await readdir(cacheDirectory).catch(() => [])) {
    if (!file.endsWith('.json')) continue;
    const scrape: ScrapeResult = JSON.parse(await readFile(join(cacheDirectory, file), 'utf8'));
    scrapes.set(scrape.slug, scrape);
  }

  const selected = only ? venues.filter((venue) => venue.slug === only) : venues;
  const listings = selected.map((venue, index) =>
    buildListing(venue, scrapes.get(venue.slug) ?? null, media[venue.slug] ?? [], index, draft),
  );

  // Merge with the previous file so a `--only` rebuild does not drop the rest.
  const previous: ImportedListing[] = await readFile(outputPath, 'utf8')
    .then((raw) => JSON.parse(raw) as ImportedListing[])
    .catch(() => []);
  const merged = new Map(previous.map((listing) => [listing.slug, listing]));
  for (const listing of listings) merged.set(listing.slug, listing);
  const output = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const published = output.filter((listing) => listing.publicationStatus === 'PUBLISHED').length;
  const withPhotos = output.filter((listing) => listing.media.length >= 3).length;
  const withPrices = output.filter((listing) => listing.priceMin !== null).length;
  const withCapacity = output.filter((listing) => listing.capacityMax !== null).length;

  console.log(`Wrote ${output.length} listings to data/venues/listings.json`);
  console.log(`  published: ${published}, draft: ${output.length - published}`);
  console.log(`  ≥3 photographs: ${withPhotos}`);
  console.log(`  with a published price: ${withPrices}`);
  console.log(`  with a stated capacity: ${withCapacity}`);
}

await main();
