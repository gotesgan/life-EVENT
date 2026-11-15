/**
 * Step 5 of the venue import pipeline: `data/venues/listings.json` → database.
 *
 * Idempotent by slug, and shaped like `prisma/seed.ts`: the listing row is
 * upserted, then every child collection it owns is deleted and rewritten. That
 * makes a re-run after a re-scrape a repair rather than a duplicate, and it means
 * a listing removed from the JSON is left alone rather than silently deleted.
 *
 * The importer refuses to run against production unless the same escape hatch the
 * seed uses is set, because it writes real businesses' contact details and
 * photographs into the catalogue.
 *
 * Run: pnpm tsx scripts/venues/import.mts [--only=slug] [--draft] [--publish]
 */

import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import type { AttributeDataType, PriceUnit, PublicationStatus } from '@/generated/prisma/enums';
import { LOCATION_SEEDS } from '../../prisma/seed-data/locations';
import type { ImportedListing } from './lib/listing';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
  console.error(
    [
      'Refusing to import: NODE_ENV=production.',
      '',
      'This writes scraped venue data into the catalogue. Point it at a development',
      'database, or set ALLOW_SEED_IN_PRODUCTION=true if the target is disposable.',
    ].join('\n'),
  );
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL must be set (try `source .dev-env.sh`).');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const PUBLIC_ROOT = resolve(process.cwd(), 'public');

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseArgs(argv: readonly string[]): {
  only: Set<string> | null;
  draft: boolean;
  publish: boolean;
} {
  const only = argv.find((argument) => argument.startsWith('--only='))?.slice('--only='.length);
  return {
    only: only ? new Set(only.split(',').map((slug) => slug.trim())) : null,
    draft: argv.includes('--draft'),
    publish: argv.includes('--publish'),
  };
}

async function seedLocations(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const location of LOCATION_SEEDS) {
    const parentId = location.parentSlug ? (ids.get(location.parentSlug) ?? null) : null;
    const row = await prisma.location.upsert({
      where: { path: location.path },
      update: {
        slug: location.slug,
        name: location.name,
        type: location.type,
        parentId,
        latitude: location.latitude,
        longitude: location.longitude,
        description: location.description,
        isActive: true,
        sortOrder: location.sortOrder,
      },
      create: {
        slug: location.slug,
        name: location.name,
        type: location.type,
        path: location.path,
        parentId,
        latitude: location.latitude,
        longitude: location.longitude,
        description: location.description,
        sortOrder: location.sortOrder,
      },
    });
    ids.set(location.slug, row.id);
  }

  return ids;
}

interface AttributeRecord {
  id: string;
  dataType: AttributeDataType;
  optionsByValue: Map<string, string>;
}

async function loadAttributes(): Promise<Map<string, AttributeRecord>> {
  const definitions = await prisma.attributeDefinition.findMany({
    include: { options: true },
  });

  const records = new Map<string, AttributeRecord>();
  for (const definition of definitions) {
    records.set(definition.code, {
      id: definition.id,
      dataType: definition.dataType,
      optionsByValue: new Map(definition.options.map((option) => [option.value, option.id])),
    });
  }
  return records;
}

async function loadAmenities(): Promise<Map<string, string>> {
  const amenities = await prisma.amenity.findMany({ select: { id: true, code: true } });
  return new Map(amenities.map((amenity) => [amenity.code, amenity.id]));
}

async function loadCategories(): Promise<Map<string, { id: string; name: string }>> {
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  });
  return new Map(
    categories.map((category) => [category.slug, { id: category.id, name: category.name }]),
  );
}

async function loadEventTypes(): Promise<Map<string, { id: string; name: string }>> {
  const eventTypes = await prisma.eventType.findMany({
    select: { id: true, slug: true, name: true },
  });
  return new Map(
    eventTypes.map((eventType) => [eventType.slug, { id: eventType.id, name: eventType.name }]),
  );
}

interface Context {
  locations: Map<string, string>;
  categories: Map<string, { id: string; name: string }>;
  eventTypes: Map<string, { id: string; name: string }>;
  attributes: Map<string, AttributeRecord>;
  amenities: Map<string, string>;
}

function buildSearchText(
  listing: ImportedListing,
  context: Context,
  locationNames: readonly string[],
): string {
  const categoryNames = [listing.primaryCategorySlug, ...listing.secondaryCategorySlugs].map(
    (slug) => context.categories.get(slug)?.name ?? slug,
  );
  const eventTypeNames = listing.eventTypeSlugs.map(
    (slug) => context.eventTypes.get(slug)?.name ?? slug,
  );

  return collapseWhitespace(
    [
      listing.name,
      listing.tagline,
      listing.description,
      ...categoryNames,
      ...eventTypeNames,
      ...locationNames,
      ...listing.services.map((service) => service.name),
    ]
      .join(' ')
      .toLowerCase(),
  );
}

const LOCATION_BY_SLUG = new Map(LOCATION_SEEDS.map((location) => [location.slug, location]));

/** The location and its ancestors, nearest first — the same haystack the seed builds. */
function locationNames(slug: string): string[] {
  const names: string[] = [];
  let current = LOCATION_BY_SLUG.get(slug);
  while (current) {
    names.push(current.name);
    current = current.parentSlug ? LOCATION_BY_SLUG.get(current.parentSlug) : undefined;
  }
  return names;
}

function attributeRows(
  listing: ImportedListing,
  context: Context,
): {
  attributeId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  optionId: string | null;
  optionIds: string[];
}[] {
  const rows = [];

  for (const value of listing.attributes) {
    const record = context.attributes.get(value.code);
    if (!record) {
      console.warn(`  ! unknown attribute "${value.code}" on ${listing.slug} — skipped`);
      continue;
    }

    const base = {
      attributeId: record.id,
      valueText: null as string | null,
      valueNumber: null as number | null,
      valueBoolean: null as boolean | null,
      optionId: null as string | null,
      optionIds: [] as string[],
    };

    switch (record.dataType) {
      case 'NUMBER':
        if (typeof value.number !== 'number') continue;
        rows.push({ ...base, valueNumber: value.number });
        break;
      case 'BOOLEAN':
        if (typeof value.boolean !== 'boolean') continue;
        rows.push({ ...base, valueBoolean: value.boolean });
        break;
      case 'SINGLE_SELECT': {
        const optionId = value.optionValue
          ? record.optionsByValue.get(value.optionValue)
          : undefined;
        if (!optionId) continue;
        rows.push({ ...base, optionId });
        break;
      }
      case 'MULTI_SELECT': {
        const optionIds = (value.optionValues ?? [])
          .map((optionValue) => record.optionsByValue.get(optionValue))
          .filter((id): id is string => Boolean(id));
        if (optionIds.length === 0) continue;
        rows.push({ ...base, optionIds });
        break;
      }
      default:
        break;
    }
  }

  return rows;
}

async function importListing(listing: ImportedListing, context: Context): Promise<boolean> {
  const primaryCategory = context.categories.get(listing.primaryCategorySlug);
  if (!primaryCategory) {
    console.warn(`  ! ${listing.slug}: unknown category ${listing.primaryCategorySlug} — skipped`);
    return false;
  }

  const primaryLocationId = context.locations.get(listing.primaryLocationSlug);
  if (!primaryLocationId) {
    console.warn(`  ! ${listing.slug}: unknown location ${listing.primaryLocationSlug} — skipped`);
    return false;
  }

  const publicationStatus: PublicationStatus = listing.publicationStatus;

  const core = {
    name: listing.name,
    tagline: listing.tagline,
    description: listing.description,
    about: listing.about,
    primaryCategoryId: primaryCategory.id,
    primaryLocationId,
    publicationStatus,
    verificationStatus: listing.verificationStatus,
    isFeatured: listing.isFeatured,
    publishedAt: listing.publishedAt ? new Date(listing.publishedAt) : null,
    contactPersonName: listing.contactPersonName,
    contactPhone: listing.contactPhone,
    contactEmail: listing.contactEmail,
    contactWhatsapp: listing.contactWhatsapp,
    websiteUrl: listing.websiteUrl,
    showPhone: listing.showPhone,
    showEmail: listing.showEmail,
    showWhatsapp: listing.showWhatsapp,
    showWebsite: listing.showWebsite,
    addressLine1: listing.addressLine1,
    addressLine2: listing.addressLine2,
    postalCode: listing.postalCode,
    latitude: listing.latitude,
    longitude: listing.longitude,
    priceMin: listing.priceMin,
    priceMax: listing.priceMax,
    priceUnit: listing.priceUnit as PriceUnit | null,
    capacityMin: listing.capacityMin,
    capacityMax: listing.capacityMax,
    searchText: buildSearchText(listing, context, locationNames(listing.primaryLocationSlug)),
  };

  const row = await prisma.businessListing.upsert({
    where: { slug: listing.slug },
    update: core,
    create: { slug: listing.slug, ...core },
  });

  await prisma.listingAttributeValue.deleteMany({ where: { listingId: row.id } });
  await prisma.listingAmenity.deleteMany({ where: { listingId: row.id } });
  await prisma.listingCategory.deleteMany({ where: { listingId: row.id } });
  await prisma.listingEventType.deleteMany({ where: { listingId: row.id } });
  await prisma.listingServiceArea.deleteMany({ where: { listingId: row.id } });
  await prisma.listingService.deleteMany({ where: { listingId: row.id } });
  await prisma.listingPackage.deleteMany({ where: { listingId: row.id } });
  await prisma.venueSpace.deleteMany({ where: { listingId: row.id } });
  await prisma.listingMedia.deleteMany({ where: { listingId: row.id } });

  const values = attributeRows(listing, context);
  if (values.length > 0) {
    await prisma.listingAttributeValue.createMany({
      data: values.map((value) => ({ listingId: row.id, ...value })),
    });
  }

  const amenityIds = listing.amenityCodes
    .map((code) => context.amenities.get(code))
    .filter((id): id is string => Boolean(id));
  if (amenityIds.length > 0) {
    await prisma.listingAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ listingId: row.id, amenityId })),
    });
  }

  const categoryLinks = [
    { slug: listing.primaryCategorySlug, isPrimary: true },
    ...listing.secondaryCategorySlugs.map((slug) => ({ slug, isPrimary: false })),
  ]
    .map((link, index) => {
      const category = context.categories.get(link.slug);
      if (!category) return null;
      return {
        listingId: row.id,
        categoryId: category.id,
        isPrimary: link.isPrimary,
        sortOrder: index * 10,
      };
    })
    .filter((link): link is NonNullable<typeof link> => link !== null);
  await prisma.listingCategory.createMany({ data: categoryLinks });

  const eventTypeIds = listing.eventTypeSlugs
    .map((slug) => context.eventTypes.get(slug)?.id)
    .filter((id): id is string => Boolean(id));
  if (eventTypeIds.length > 0) {
    await prisma.listingEventType.createMany({
      data: eventTypeIds.map((eventTypeId) => ({ listingId: row.id, eventTypeId })),
    });
  }

  const serviceAreaIds = listing.serviceAreaSlugs
    .map((slug) => context.locations.get(slug))
    .filter((id): id is string => Boolean(id));
  if (serviceAreaIds.length > 0) {
    await prisma.listingServiceArea.createMany({
      data: serviceAreaIds.map((locationId) => ({ listingId: row.id, locationId })),
    });
  }

  await prisma.listingService.createMany({
    data: listing.services.map((service, index) => ({
      listingId: row.id,
      name: service.name,
      description: service.description,
      priceFrom: service.priceFrom,
      priceTo: service.priceTo,
      priceUnit: service.priceUnit as PriceUnit | null,
      durationMinutes: service.durationMinutes,
      includes: [...service.includes],
      sortOrder: index * 10,
    })),
  });

  await prisma.listingPackage.createMany({
    data: listing.packages.map((pack, index) => ({
      listingId: row.id,
      name: pack.name,
      description: pack.description,
      price: pack.price,
      priceUnit: pack.priceUnit as PriceUnit | null,
      minGuests: pack.minGuests,
      maxGuests: pack.maxGuests,
      inclusions: [...pack.inclusions],
      exclusions: [...pack.exclusions],
      sortOrder: index * 10,
    })),
  });

  if (listing.venueSpaces.length > 0) {
    await prisma.venueSpace.createMany({
      data: listing.venueSpaces.map((space, index) => ({
        listingId: row.id,
        name: space.name,
        description: space.description,
        capacitySeated: space.capacitySeated,
        capacityStanding: space.capacityStanding,
        areaSqft: space.areaSqft,
        isIndoor: space.isIndoor,
        isOutdoor: space.isOutdoor,
        layoutOptions: [...space.layoutOptions],
        sortOrder: index * 10,
      })),
    });
  }

  const mediaRows = [];
  for (const [index, photo] of listing.media.entries()) {
    // `publicUrl` is the browser path (`/media/venues/<digest>/<file>`); the file
    // on disk is the same path under `public/`.
    const filePath = join(PUBLIC_ROOT, photo.publicUrl.replace(/^\//, ''));
    let sizeBytes: number;
    try {
      ({ size: sizeBytes } = await stat(filePath));
    } catch {
      console.warn(`  ! ${listing.slug}: missing photograph ${photo.publicUrl} — skipped`);
      continue;
    }

    mediaRows.push({
      listingId: row.id,
      storageKey: photo.storageKey,
      publicUrl: photo.publicUrl,
      altText: photo.alt,
      kind: 'IMAGE' as const,
      status: 'READY' as const,
      mimeType: 'image/jpeg',
      sizeBytes,
      width: photo.width,
      height: photo.height,
      sortOrder: index * 10,
      isCover: index === 0,
    });
  }

  if (mediaRows.length > 0) await prisma.listingMedia.createMany({ data: mediaRows });

  return true;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const listings: ImportedListing[] = JSON.parse(
    await readFile(join(process.cwd(), 'data/venues/listings.json'), 'utf8'),
  );

  const selected = listings
    .filter((listing) => (args.only ? args.only.has(listing.slug) : true))
    .map((listing) => ({
      ...listing,
      publicationStatus: args.draft
        ? ('DRAFT' as const)
        : args.publish
          ? ('PUBLISHED' as const)
          : listing.publicationStatus,
      publishedAt: args.publish
        ? (listing.publishedAt ?? new Date().toISOString())
        : listing.publishedAt,
    }));

  console.log(`Importing ${selected.length} listings…`);

  const context: Context = {
    locations: await seedLocations(),
    categories: await loadCategories(),
    eventTypes: await loadEventTypes(),
    attributes: await loadAttributes(),
    amenities: await loadAmenities(),
  };

  let imported = 0;
  let published = 0;
  for (const [index, listing] of selected.entries()) {
    const ok = await importListing(listing, context);
    if (!ok) continue;
    imported += 1;
    if (listing.publicationStatus === 'PUBLISHED') published += 1;
    if ((index + 1) % 25 === 0 || index === selected.length - 1) {
      console.log(`  ${index + 1}/${selected.length} processed`);
    }
  }

  console.log(`\nImported ${imported} listings (${published} published).`);
}

await main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
