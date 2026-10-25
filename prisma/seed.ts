/**
 * Deterministic, idempotent development seed.
 *
 * Orchestration only — the data lives in `prisma/seed-data/*`. Running this
 * twice must not create duplicates:
 *   * catalogue, geography, users, listings and enquiries are `upsert`ed on a
 *     natural key (path, slug, code, email, reference code);
 *   * child collections owned by a row (attribute values, media, services,
 *     packages, venue spaces, category/event-type/service-area links, enquiry
 *     listings, activities, notes) are deleted and rewritten;
 *   * listing photography is read from `public/media/seed/`, which
 *     `scripts/fetch-listing-photos.mts` populates and the repository commits.
 *
 * Passwords are written exactly the way Better Auth's Prisma adapter writes
 * them (a `credential` row on `Account`, hashed with Better Auth's default
 * scrypt hasher from `better-auth/crypto`). See prisma/seed-data/users.ts.
 */

import 'dotenv/config';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import type { AttributeDataType, EnquiryStatus } from '@/generated/prisma/enums';
import { deriveEnquiryStatus } from '@/server/domain/enquiry-status';
import {
  AMENITY_SEEDS,
  ATTRIBUTE_BINDINGS,
  ATTRIBUTE_DEFINITIONS,
  findAttributeDefinition,
} from './seed-data/attributes';
import { CATEGORY_SEEDS, EVENT_TYPE_SEEDS } from './seed-data/categories';
import { ENQUIRY_SEEDS } from './seed-data/enquiries';
import { LISTING_SEEDS, type ListingSeed } from './seed-data/listings';
import { findLocationSeed, LOCATION_SEEDS, locationAncestorNames } from './seed-data/locations';
import {
  LISTING_PHOTOS,
  PHOTO_HEIGHT,
  PHOTO_WIDTH,
  photoFileName,
  photoPublicUrl,
  photoStorageKey,
} from './seed-data/listing-photos';
import { USER_SEEDS } from './seed-data/users';

/**
 * Refuses to seed a production database.
 *
 * The seed writes a full fake catalogue and demo accounts, and it previously had
 * no guard at all: `pnpm setup` or `pnpm db:seed` run against a production
 * DATABASE_URL would have populated it. The test harnesses had their own guards;
 * the script itself did not, which is the case that matters because it is the one
 * an operator runs by hand.
 */
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== 'true') {
  console.error(
    [
      'Refusing to seed: NODE_ENV=production.',
      '',
      'This script writes demo listings, demo customers and a demo administrator.',
      'Point it at a development database, or set ALLOW_SEED_IN_PRODUCTION=true if',
      'you are certain the target database is disposable.',
    ].join('\n'),
  );
  process.exit(1);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

if (!connectionString) {
  throw new Error(
    'DIRECT_URL or DATABASE_URL must be set before running the seed (try `source .dev-env.sh`).',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const MEDIA_DIRECTORY = resolve(process.cwd(), 'public/media/seed');
// Must match PRIVACY_POLICY_VERSION in src/lib/validation/enquiry.ts, which is the
// version the live enquiry form submits. A mismatch would make seed consent
// provenance inconsistent with real submissions.
const CONSENT_POLICY_VERSION = '2026-02-01';
const SEED_USER_AGENT = 'LiveEnvtSeed/1.0 (not a real client)';

const AUDIT_ACTIONS = [
  'listing.published',
  'listing.verified',
  'listing.featured',
  'enquiry.status_changed',
  'listing.media_uploaded',
] as const;

type IdMap = Map<string, string>;

interface CategoryRecord {
  id: string;
  name: string;
}

interface OptionRecord {
  id: string;
  label: string;
}

interface AttributeRecord {
  id: string;
  dataType: AttributeDataType;
  optionsByValue: Map<string, OptionRecord>;
}

interface UserIds {
  admin: string;
  customers: Map<string, string>;
}

interface SeedSummary {
  users: number;
  locations: number;
  categories: number;
  eventTypes: number;
  attributeDefinitions: number;
  attributeOptions: number;
  categoryAttributes: number;
  amenities: number;
  listings: number;
  publishedListings: number;
  listingServices: number;
  listingPackages: number;
  venueSpaces: number;
  listingMedia: number;
  attributeValues: number;
  enquiries: number;
  enquiryListings: number;
  enquiryActivities: number;
  enquiryNotes: number;
  auditLogs: number;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A deterministic 64-hex stand-in for a salted IP hash — never a real hash. */
function fakeIpHash(seed: string): string {
  let state = fnv1a(seed) || 1;
  let out = '';
  for (let index = 0; index < 64; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out += (state & 0xf).toString(16);
  }
  return out;
}

/**
 * Digits-only phone form used for duplicate matching. Mirrors
 * `normalisePhone` in src/server/domain/contact.ts, which is `server-only` and
 * therefore cannot be imported by the seed.
 */
function normalisePhoneForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function minutesAfter(base: string, minutes: number): Date {
  return new Date(new Date(base).getTime() + minutes * 60_000);
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function seedLocations(): Promise<{ ids: IdMap; count: number }> {
  const ids: IdMap = new Map();

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

  return { ids, count: LOCATION_SEEDS.length };
}

async function seedEventTypes(): Promise<{ ids: IdMap; count: number }> {
  const ids: IdMap = new Map();

  for (const eventType of EVENT_TYPE_SEEDS) {
    const row = await prisma.eventType.upsert({
      where: { slug: eventType.slug },
      update: {
        name: eventType.name,
        description: eventType.description,
        iconKey: eventType.iconKey,
        sortOrder: eventType.sortOrder,
        isActive: true,
      },
      create: {
        slug: eventType.slug,
        name: eventType.name,
        description: eventType.description,
        iconKey: eventType.iconKey,
        sortOrder: eventType.sortOrder,
      },
    });
    ids.set(eventType.slug, row.id);
  }

  return { ids, count: EVENT_TYPE_SEEDS.length };
}

async function seedCategories(): Promise<{ records: Map<string, CategoryRecord>; count: number }> {
  const records = new Map<string, CategoryRecord>();

  for (const category of CATEGORY_SEEDS) {
    const parentId = category.parentSlug ? (records.get(category.parentSlug)?.id ?? null) : null;
    const row = await prisma.category.upsert({
      where: { path: category.path },
      update: {
        slug: category.slug,
        name: category.name,
        parentId,
        shortDescription: category.shortDescription,
        iconKey: category.iconKey,
        heroImageUrl: category.heroImageUrl,
        isActive: true,
        sortOrder: category.sortOrder,
      },
      create: {
        slug: category.slug,
        name: category.name,
        path: category.path,
        parentId,
        shortDescription: category.shortDescription,
        iconKey: category.iconKey,
        heroImageUrl: category.heroImageUrl,
        sortOrder: category.sortOrder,
      },
    });
    records.set(category.slug, { id: row.id, name: row.name });
  }

  return { records, count: CATEGORY_SEEDS.length };
}

async function seedAttributes(categories: Map<string, CategoryRecord>): Promise<{
  records: Map<string, AttributeRecord>;
  definitionCount: number;
  optionCount: number;
  bindingCount: number;
}> {
  const records = new Map<string, AttributeRecord>();
  let optionCount = 0;

  for (const definition of ATTRIBUTE_DEFINITIONS) {
    const row = await prisma.attributeDefinition.upsert({
      where: { code: definition.code },
      update: {
        label: definition.label,
        dataType: definition.dataType,
        unit: definition.unit,
        helpText: definition.helpText,
        minNumber: definition.minNumber,
        maxNumber: definition.maxNumber,
        isGlobal: true,
      },
      create: {
        code: definition.code,
        label: definition.label,
        dataType: definition.dataType,
        unit: definition.unit,
        helpText: definition.helpText,
        minNumber: definition.minNumber,
        maxNumber: definition.maxNumber,
        isGlobal: true,
      },
    });

    const optionsByValue = new Map<string, OptionRecord>();
    for (const option of definition.options) {
      const optionRow = await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: row.id, value: option.value } },
        update: { label: option.label, sortOrder: option.sortOrder, isActive: true },
        create: {
          attributeId: row.id,
          value: option.value,
          label: option.label,
          sortOrder: option.sortOrder,
        },
      });
      optionsByValue.set(option.value, { id: optionRow.id, label: optionRow.label });
      optionCount += 1;
    }

    records.set(definition.code, {
      id: row.id,
      dataType: definition.dataType,
      optionsByValue,
    });
  }

  let bindingCount = 0;
  for (const binding of ATTRIBUTE_BINDINGS) {
    const category = categories.get(binding.categorySlug);
    const attribute = records.get(binding.code);
    if (!category) throw new Error(`Unknown category: ${binding.categorySlug}`);
    if (!attribute) throw new Error(`Unknown attribute: ${binding.code}`);

    await prisma.categoryAttribute.upsert({
      where: {
        categoryId_attributeId: { categoryId: category.id, attributeId: attribute.id },
      },
      update: {
        isRequired: binding.isRequired,
        isFilterable: binding.isFilterable,
        isSearchable: binding.isSearchable,
        isVisibleOnProfile: binding.isVisibleOnProfile,
        isComparable: binding.isComparable,
        showOnCard: binding.showOnCard,
        filterControl: binding.filterControl,
        groupLabel: binding.groupLabel,
        sortOrder: binding.sortOrder,
      },
      create: {
        categoryId: category.id,
        attributeId: attribute.id,
        isRequired: binding.isRequired,
        isFilterable: binding.isFilterable,
        isSearchable: binding.isSearchable,
        isVisibleOnProfile: binding.isVisibleOnProfile,
        isComparable: binding.isComparable,
        showOnCard: binding.showOnCard,
        filterControl: binding.filterControl,
        groupLabel: binding.groupLabel,
        sortOrder: binding.sortOrder,
      },
    });
    bindingCount += 1;
  }

  return {
    records,
    definitionCount: ATTRIBUTE_DEFINITIONS.length,
    optionCount,
    bindingCount,
  };
}

async function seedAmenities(): Promise<{ ids: IdMap; count: number }> {
  const ids: IdMap = new Map();

  for (const amenity of AMENITY_SEEDS) {
    const row = await prisma.amenity.upsert({
      where: { code: amenity.code },
      update: {
        label: amenity.label,
        groupLabel: amenity.groupLabel,
        iconKey: amenity.iconKey,
        sortOrder: amenity.sortOrder,
        isActive: true,
      },
      create: {
        code: amenity.code,
        label: amenity.label,
        groupLabel: amenity.groupLabel,
        iconKey: amenity.iconKey,
        sortOrder: amenity.sortOrder,
      },
    });
    ids.set(amenity.code, row.id);
  }

  return { ids, count: AMENITY_SEEDS.length };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function seedUsers(locations: IdMap): Promise<UserIds> {
  const customers = new Map<string, string>();
  let adminId = '';

  for (const user of USER_SEEDS) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        status: 'ACTIVE',
        emailVerified: user.emailVerified,
        banned: false,
      },
      create: {
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        status: 'ACTIVE',
      },
    });

    if (user.role === 'ADMIN') adminId = row.id;
    else customers.set(user.key, row.id);

    if (user.profile) {
      const cityId = locations.get(user.profile.citySlug);
      if (!cityId) throw new Error(`Unknown profile city: ${user.profile.citySlug}`);

      await prisma.customerProfile.upsert({
        where: { userId: row.id },
        update: {
          phone: user.profile.phone,
          cityId,
          preferredContactMethod: user.profile.preferredContactMethod,
          marketingConsent: user.profile.marketingConsent,
        },
        create: {
          userId: row.id,
          phone: user.profile.phone,
          cityId,
          preferredContactMethod: user.profile.preferredContactMethod,
          marketingConsent: user.profile.marketingConsent,
        },
      });
    }

    // Better Auth writes the credential hash on the Account row, keyed by
    // (providerId, accountId). A fresh salt each run is expected: the row count
    // stays at one and the documented password always verifies.
    const { hashPassword } = await import('better-auth/crypto');
    const passwordHash = await hashPassword(user.password);

    await prisma.account.upsert({
      where: { providerId_accountId: { providerId: 'credential', accountId: row.id } },
      update: { userId: row.id, password: passwordHash },
      create: {
        userId: row.id,
        providerId: 'credential',
        accountId: row.id,
        password: passwordHash,
      },
    });
  }

  if (!adminId) throw new Error('Seed data must include one administrator');

  return { admin: adminId, customers };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

function buildSearchText(
  listing: ListingSeed,
  categoryNames: readonly string[],
  eventTypeNames: readonly string[],
  locationNames: readonly string[],
): string {
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

interface AttributeValueRow {
  listingId: string;
  attributeId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  optionId: string | null;
  optionIds: string[];
}

function buildAttributeRows(
  listingId: string,
  listing: ListingSeed,
  attributes: Map<string, AttributeRecord>,
): AttributeValueRow[] {
  return listing.attributes.map((value) => {
    const definition = findAttributeDefinition(value.code);
    const record = attributes.get(value.code);
    if (!record) throw new Error(`Unknown attribute ${value.code} on ${listing.slug}`);

    const base = {
      listingId,
      attributeId: record.id,
      valueText: null as string | null,
      valueNumber: null as number | null,
      valueBoolean: null as boolean | null,
      optionId: null as string | null,
      optionIds: [] as string[],
    };

    const resolveOption = (optionValue: string): OptionRecord => {
      const option = record.optionsByValue.get(optionValue);
      if (!option) {
        throw new Error(
          `Attribute ${value.code} has no option "${optionValue}" (listing ${listing.slug})`,
        );
      }
      return option;
    };

    switch (definition.dataType) {
      case 'NUMBER': {
        if (typeof value.number !== 'number') {
          throw new Error(`Attribute ${value.code} needs a number on ${listing.slug}`);
        }
        return { ...base, valueNumber: value.number };
      }
      case 'BOOLEAN': {
        if (typeof value.boolean !== 'boolean') {
          throw new Error(`Attribute ${value.code} needs a boolean on ${listing.slug}`);
        }
        return { ...base, valueBoolean: value.boolean };
      }
      case 'SINGLE_SELECT': {
        if (!value.optionValue) {
          throw new Error(`Attribute ${value.code} needs an option on ${listing.slug}`);
        }
        const option = resolveOption(value.optionValue);
        return { ...base, optionId: option.id, valueText: option.label };
      }
      case 'MULTI_SELECT': {
        const optionValues = value.optionValues ?? [];
        if (optionValues.length === 0) {
          throw new Error(`Attribute ${value.code} needs options on ${listing.slug}`);
        }
        const resolved = optionValues.map(resolveOption);
        return {
          ...base,
          optionIds: resolved.map((option) => option.id),
          valueText: resolved.map((option) => option.label).join(', '),
        };
      }
      default:
        throw new Error(
          `Attribute ${value.code} uses ${definition.dataType}, which the seed does not populate`,
        );
    }
  });
}

async function seedListings(context: {
  categories: Map<string, CategoryRecord>;
  locations: IdMap;
  eventTypes: IdMap;
  amenities: IdMap;
  attributes: Map<string, AttributeRecord>;
  adminId: string;
}): Promise<{ ids: IdMap; mediaCount: number; attributeValueCount: number }> {
  const ids: IdMap = new Map();
  let mediaCount = 0;
  let attributeValueCount = 0;

  for (const listing of LISTING_SEEDS) {
    const primaryCategory = context.categories.get(listing.primaryCategorySlug);
    if (!primaryCategory)
      throw new Error(`Unknown primary category: ${listing.primaryCategorySlug}`);

    const primaryLocationId = context.locations.get(listing.primaryLocationSlug);
    if (!primaryLocationId) {
      throw new Error(`Unknown primary location: ${listing.primaryLocationSlug}`);
    }

    const categoryNames = [listing.primaryCategorySlug, ...listing.secondaryCategorySlugs].map(
      (slug) => context.categories.get(slug)?.name ?? slug,
    );
    const eventTypeNames = listing.eventTypeSlugs.map((slug) => {
      const eventType = EVENT_TYPE_SEEDS.find((candidate) => candidate.slug === slug);
      return eventType?.name ?? slug;
    });
    const locationNames = [
      findLocationSeed(listing.primaryLocationSlug).name,
      ...locationAncestorNames(listing.primaryLocationSlug),
    ];
    const searchText = buildSearchText(listing, categoryNames, eventTypeNames, locationNames);

    const core = {
      name: listing.name,
      tagline: listing.tagline,
      description: listing.description,
      about: listing.about,
      primaryCategoryId: primaryCategory.id,
      primaryLocationId,
      publicationStatus: listing.publicationStatus,
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
      priceUnit: listing.priceUnit,
      capacityMin: listing.capacityMin,
      capacityMax: listing.capacityMax,
      searchText,
      createdById: listing.createdByAdmin ? context.adminId : null,
    };

    const row = await prisma.businessListing.upsert({
      where: { slug: listing.slug },
      update: core,
      create: { slug: listing.slug, ...core },
    });
    ids.set(listing.slug, row.id);

    // Rewrite every child collection this listing owns.
    await prisma.listingAttributeValue.deleteMany({ where: { listingId: row.id } });
    await prisma.listingAmenity.deleteMany({ where: { listingId: row.id } });
    await prisma.listingCategory.deleteMany({ where: { listingId: row.id } });
    await prisma.listingEventType.deleteMany({ where: { listingId: row.id } });
    await prisma.listingServiceArea.deleteMany({ where: { listingId: row.id } });
    await prisma.listingService.deleteMany({ where: { listingId: row.id } });
    await prisma.listingPackage.deleteMany({ where: { listingId: row.id } });
    await prisma.venueSpace.deleteMany({ where: { listingId: row.id } });
    await prisma.listingMedia.deleteMany({ where: { listingId: row.id } });

    const attributeRows = buildAttributeRows(row.id, listing, context.attributes);
    if (attributeRows.length > 0) {
      await prisma.listingAttributeValue.createMany({ data: attributeRows });
      attributeValueCount += attributeRows.length;
    }

    await prisma.listingAmenity.createMany({
      data: listing.amenityCodes.map((code) => {
        const amenityId = context.amenities.get(code);
        if (!amenityId) throw new Error(`Unknown amenity: ${code}`);
        return { listingId: row.id, amenityId };
      }),
    });

    const categoryLinks = [
      { slug: listing.primaryCategorySlug, isPrimary: true },
      ...listing.secondaryCategorySlugs.map((slug) => ({ slug, isPrimary: false })),
    ].map((link, index) => {
      const category = context.categories.get(link.slug);
      if (!category) throw new Error(`Unknown category link: ${link.slug}`);
      return {
        listingId: row.id,
        categoryId: category.id,
        isPrimary: link.isPrimary,
        sortOrder: index * 10,
      };
    });
    await prisma.listingCategory.createMany({ data: categoryLinks });

    if (listing.eventTypeSlugs.length > 0) {
      await prisma.listingEventType.createMany({
        data: listing.eventTypeSlugs.map((slug) => {
          const eventTypeId = context.eventTypes.get(slug);
          if (!eventTypeId) throw new Error(`Unknown event type: ${slug}`);
          return { listingId: row.id, eventTypeId };
        }),
      });
    }

    if (listing.serviceAreaSlugs.length > 0) {
      await prisma.listingServiceArea.createMany({
        data: listing.serviceAreaSlugs.map((slug) => {
          const locationId = context.locations.get(slug);
          if (!locationId) throw new Error(`Unknown service area: ${slug}`);
          return { listingId: row.id, locationId };
        }),
      });
    }

    await prisma.listingService.createMany({
      data: listing.services.map((service, index) => ({
        listingId: row.id,
        name: service.name,
        description: service.description,
        priceFrom: service.priceFrom,
        priceTo: service.priceTo,
        priceUnit: service.priceUnit,
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
        priceUnit: pack.priceUnit,
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

    const photos = LISTING_PHOTOS[listing.slug];
    if (!photos || photos.length === 0) {
      throw new Error(
        `No photography catalogued for "${listing.slug}". Add it to ` +
          'prisma/seed-data/listing-photos.ts, then run ' +
          '`pnpm tsx scripts/fetch-listing-photos.mts`.',
      );
    }

    const mediaRows: {
      listingId: string;
      storageKey: string;
      publicUrl: string;
      altText: string;
      kind: 'IMAGE';
      status: 'READY';
      mimeType: string;
      sizeBytes: number;
      width: number;
      height: number;
      sortOrder: number;
      isCover: boolean;
    }[] = [];

    for (const [index, photo] of photos.entries()) {
      const fileName = photoFileName(listing.slug, photo.variant);
      const filePath = join(MEDIA_DIRECTORY, fileName);

      let sizeBytes: number;
      try {
        ({ size: sizeBytes } = await stat(filePath));
      } catch {
        throw new Error(
          `Missing photo file public/media/seed/${fileName}. ` +
            'Run `pnpm tsx scripts/fetch-listing-photos.mts`.',
        );
      }

      mediaRows.push({
        listingId: row.id,
        storageKey: photoStorageKey(listing.slug, photo.variant),
        publicUrl: photoPublicUrl(listing.slug, photo.variant),
        altText: photo.alt,
        kind: 'IMAGE',
        status: 'READY',
        mimeType: 'image/jpeg',
        sizeBytes,
        width: PHOTO_WIDTH,
        height: PHOTO_HEIGHT,
        sortOrder: index * 10,
        isCover: photo.variant === 'cover',
      });
    }

    await prisma.listingMedia.createMany({ data: mediaRows });
    mediaCount += mediaRows.length;
  }

  return { ids, mediaCount, attributeValueCount };
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

async function seedEnquiries(context: {
  listings: IdMap;
  locations: IdMap;
  eventTypes: IdMap;
  users: UserIds;
}): Promise<{ count: number; listingCount: number; activityCount: number; noteCount: number }> {
  let listingCount = 0;
  let activityCount = 0;
  let noteCount = 0;

  for (const enquiry of ENQUIRY_SEEDS) {
    const customerUserId =
      enquiry.customer === null ? null : (context.users.customers.get(enquiry.customer) ?? null);

    const contactCityId = context.locations.get(enquiry.contactCitySlug);
    if (!contactCityId) throw new Error(`Unknown contact city: ${enquiry.contactCitySlug}`);

    const eventTypeId = enquiry.eventTypeSlug
      ? (context.eventTypes.get(enquiry.eventTypeSlug) ?? null)
      : null;

    // The stored overall status is always the derived one, never hand-written.
    const overallStatus: EnquiryStatus = deriveEnquiryStatus(
      enquiry.listings.map((child) => child.status),
    );

    const createdAt = new Date(enquiry.createdAt);
    const core = {
      customerUserId,
      contactName: enquiry.contactName,
      contactEmail: enquiry.contactEmail,
      contactPhone: enquiry.contactPhone,
      contactPhoneNormalised: normalisePhoneForMatch(enquiry.contactPhone),
      contactCityId,
      contactMethod: enquiry.contactMethod,
      eventTypeId,
      eventDate: enquiry.eventDate ? new Date(enquiry.eventDate) : null,
      eventDateFlexible: enquiry.eventDateFlexible,
      guestCount: enquiry.guestCount,
      budgetMin: enquiry.budgetMin,
      budgetMax: enquiry.budgetMax,
      requirements: enquiry.requirements,
      referralSource: enquiry.referralSource,
      status: overallStatus,
      isPotentialDuplicate: enquiry.isPotentialDuplicate,
      assignedAdminId: enquiry.assignedAdmin ? context.users.admin : null,
      consentPrivacy: true,
      consentPolicyVersion: CONSENT_POLICY_VERSION,
      consentedAt: createdAt,
      source: 'WEB' as const,
      submittedIpHash: fakeIpHash(enquiry.referenceCode),
      userAgent: SEED_USER_AGENT,
    };

    const row = await prisma.enquiry.upsert({
      where: { referenceCode: enquiry.referenceCode },
      update: core,
      create: { referenceCode: enquiry.referenceCode, ...core },
    });

    await prisma.enquiryActivity.deleteMany({ where: { enquiryId: row.id } });
    await prisma.enquiryNote.deleteMany({ where: { enquiryId: row.id } });
    await prisma.enquiryListing.deleteMany({ where: { enquiryId: row.id } });

    const listingIds = new Map<string, string>();
    for (const [index, child] of enquiry.listings.entries()) {
      const listingId = context.listings.get(child.listingSlug);
      if (!listingId) throw new Error(`Unknown enquiry listing: ${child.listingSlug}`);

      const childRow = await prisma.enquiryListing.create({
        data: {
          enquiryId: row.id,
          listingId,
          status: child.status,
          assignedAdminId: child.assignedAdmin ? context.users.admin : null,
          assignedAt: child.assignedAdmin ? minutesAfter(enquiry.createdAt, 20) : null,
          firstContactedAt:
            child.firstContactedMinutes === null
              ? null
              : minutesAfter(enquiry.createdAt, child.firstContactedMinutes),
          sharedWithProviderAt:
            child.sharedWithProviderMinutes === null
              ? null
              : minutesAfter(enquiry.createdAt, child.sharedWithProviderMinutes),
          convertedAt:
            child.convertedMinutes === null
              ? null
              : minutesAfter(enquiry.createdAt, child.convertedMinutes),
          lostAt:
            child.lostMinutes === null ? null : minutesAfter(enquiry.createdAt, child.lostMinutes),
          lostReason: child.lostReason,
          providerResponseNote: child.providerResponseNote,
          sortOrder: index * 10,
        },
      });
      listingIds.set(child.listingSlug, childRow.id);
      listingCount += 1;
    }

    const activityRows = enquiry.activities.map((activity) => {
      const enquiryListingId = activity.listingSlug
        ? (listingIds.get(activity.listingSlug) ?? null)
        : null;
      if (activity.listingSlug && !enquiryListingId) {
        throw new Error(`Activity references unknown listing ${activity.listingSlug}`);
      }

      const actorUserId =
        activity.actor === 'ADMIN'
          ? context.users.admin
          : activity.actor === 'CUSTOMER'
            ? customerUserId
            : null;

      return {
        enquiryId: row.id,
        enquiryListingId,
        type: activity.type,
        fromStatus: activity.fromStatus,
        toStatus: activity.toStatus,
        message: activity.message,
        isCustomerVisible: activity.isCustomerVisible,
        actorUserId,
        actorName:
          activity.actor === 'ADMIN'
            ? 'Platform Admin'
            : activity.actor === 'CUSTOMER'
              ? enquiry.contactName
              : 'System',
        createdAt: minutesAfter(enquiry.createdAt, activity.offsetMinutes),
      };
    });

    if (activityRows.length > 0) {
      await prisma.enquiryActivity.createMany({ data: activityRows });
      activityCount += activityRows.length;
    }

    const noteRows = enquiry.notes.map((note) => ({
      enquiryId: row.id,
      enquiryListingId: note.listingSlug ? (listingIds.get(note.listingSlug) ?? null) : null,
      authorUserId: context.users.admin,
      authorName: 'Platform Admin',
      body: note.body,
      createdAt: minutesAfter(enquiry.createdAt, note.offsetMinutes),
    }));

    if (noteRows.length > 0) {
      await prisma.enquiryNote.createMany({ data: noteRows });
      noteCount += noteRows.length;
    }
  }

  return {
    count: ENQUIRY_SEEDS.length,
    listingCount,
    activityCount,
    noteCount,
  };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function seedAuditLogs(context: { adminId: string; listings: IdMap }): Promise<number> {
  // AuditLog has no natural unique key, so the seed owns a fixed set of
  // (actor, action) pairs and rewrites exactly those rows.
  await prisma.auditLog.deleteMany({
    where: { actorUserId: context.adminId, action: { in: [...AUDIT_ACTIONS] } },
  });

  const featured = LISTING_SEEDS.filter((listing) => listing.isFeatured);
  const published = LISTING_SEEDS.filter(
    (listing) => listing.publicationStatus === 'PUBLISHED',
  ).slice(0, 4);

  const rows: {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    actorUserId: string;
    actorName: string;
    metadata: Record<string, string | number | boolean>;
    createdAt: Date;
  }[] = [];

  published.forEach((listing, index) => {
    const entityId = context.listings.get(listing.slug);
    if (!entityId) return;
    rows.push({
      action: 'listing.published',
      entityType: 'BusinessListing',
      entityId,
      summary: `Published listing "${listing.name}"`,
      actorUserId: context.adminId,
      actorName: 'Platform Admin',
      metadata: { slug: listing.slug, verificationStatus: listing.verificationStatus },
      createdAt: new Date(Date.UTC(2026, 4, 2 + index, 4, 30, 0)),
    });
    rows.push({
      action: 'listing.media_uploaded',
      entityType: 'BusinessListing',
      entityId,
      summary: `Uploaded cover photo for "${listing.name}"`,
      actorUserId: context.adminId,
      actorName: 'Platform Admin',
      metadata: { storageKey: `seed/${listing.slug}-cover.jpg` },
      createdAt: new Date(Date.UTC(2026, 4, 2 + index, 4, 45, 0)),
    });
  });

  featured.forEach((listing, index) => {
    const entityId = context.listings.get(listing.slug);
    if (!entityId) return;
    rows.push({
      action: 'listing.featured',
      entityType: 'BusinessListing',
      entityId,
      summary: `Featured listing "${listing.name}" on the home page`,
      actorUserId: context.adminId,
      actorName: 'Platform Admin',
      metadata: { slug: listing.slug, isFeatured: true },
      createdAt: new Date(Date.UTC(2026, 4, 6 + index, 6, 0, 0)),
    });
  });

  for (const [index, enquiry] of ENQUIRY_SEEDS.entries()) {
    if (enquiry.listings.every((child) => child.status === 'NEW')) continue;
    rows.push({
      action: 'enquiry.status_changed',
      entityType: 'Enquiry',
      entityId: enquiry.referenceCode,
      summary: `Updated lead progress for ${enquiry.referenceCode}`,
      actorUserId: context.adminId,
      actorName: 'Platform Admin',
      metadata: {
        referenceCode: enquiry.referenceCode,
        listings: enquiry.listings.length,
      },
      createdAt: new Date(Date.UTC(2026, 8, 20 + index, 7, 15, 0)),
    });
  }

  await prisma.auditLog.createMany({ data: rows });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function verifySeededData(): Promise<void> {
  const invalidPublished = await prisma.businessListing.count({
    where: { publicationStatus: 'PUBLISHED', publishedAt: null },
  });
  if (invalidPublished > 0) {
    throw new Error(`${invalidPublished} published listings have no publishedAt`);
  }

  const emptySearchText = await prisma.businessListing.count({
    where: { publicationStatus: 'PUBLISHED', searchText: '' },
  });
  if (emptySearchText > 0) {
    throw new Error(`${emptySearchText} published listings have an empty searchText`);
  }

  const listingsWithoutCover = await prisma.businessListing.count({
    where: { media: { none: { isCover: true } } },
  });
  if (listingsWithoutCover > 0) {
    throw new Error(`${listingsWithoutCover} listings have no cover media`);
  }

  const enquiries = await prisma.enquiry.findMany({
    select: { referenceCode: true, status: true, listings: { select: { status: true } } },
  });
  for (const enquiry of enquiries) {
    const derived = deriveEnquiryStatus(enquiry.listings.map((child) => child.status));
    if (derived !== enquiry.status) {
      throw new Error(
        `Enquiry ${enquiry.referenceCode} stores ${enquiry.status} but derives ${derived}`,
      );
    }
  }
}

async function printSummary(summary: SeedSummary): Promise<void> {
  const perTable: [string, string][] = [
    ['users', 'user'],
    ['accounts', 'account'],
    ['customer_profiles', 'customerProfile'],
    ['locations', 'location'],
    ['categories', 'category'],
    ['event_types', 'eventType'],
    ['attribute_definitions', 'attributeDefinition'],
    ['attribute_options', 'attributeOption'],
    ['category_attributes', 'categoryAttribute'],
    ['amenities', 'amenity'],
    ['business_listings', 'businessListing'],
    ['listing_categories', 'listingCategory'],
    ['listing_event_types', 'listingEventType'],
    ['listing_service_areas', 'listingServiceArea'],
    ['listing_media', 'listingMedia'],
    ['listing_services', 'listingService'],
    ['listing_packages', 'listingPackage'],
    ['venue_spaces', 'venueSpace'],
    ['listing_attribute_values', 'listingAttributeValue'],
    ['listing_amenities', 'listingAmenity'],
    ['enquiries', 'enquiry'],
    ['enquiry_listings', 'enquiryListing'],
    ['enquiry_activities', 'enquiryActivity'],
    ['enquiry_notes', 'enquiryNote'],
    ['audit_logs', 'auditLog'],
  ];

  const counts: Record<string, number> = {
    businessListing: await prisma.businessListing.count(),
    listingCategory: await prisma.listingCategory.count(),
    listingEventType: await prisma.listingEventType.count(),
    listingServiceArea: await prisma.listingServiceArea.count(),
    listingMedia: await prisma.listingMedia.count(),
    listingService: await prisma.listingService.count(),
    listingPackage: await prisma.listingPackage.count(),
    venueSpace: await prisma.venueSpace.count(),
    listingAttributeValue: await prisma.listingAttributeValue.count(),
    listingAmenity: await prisma.listingAmenity.count(),
    enquiry: await prisma.enquiry.count(),
    enquiryListing: await prisma.enquiryListing.count(),
    enquiryActivity: await prisma.enquiryActivity.count(),
    enquiryNote: await prisma.enquiryNote.count(),
    auditLog: await prisma.auditLog.count(),
    user: await prisma.user.count(),
    account: await prisma.account.count(),
    customerProfile: await prisma.customerProfile.count(),
    location: await prisma.location.count(),
    category: await prisma.category.count(),
    eventType: await prisma.eventType.count(),
    attributeDefinition: await prisma.attributeDefinition.count(),
    attributeOption: await prisma.attributeOption.count(),
    categoryAttribute: await prisma.categoryAttribute.count(),
    amenity: await prisma.amenity.count(),
    rateLimitBucket: await prisma.rateLimitBucket.count(),
    idempotencyKey: await prisma.idempotencyKey.count(),
  };

  console.log('');
  console.log('Seed complete.');
  console.log(`  writes this run: ${summary.listings} listings, ${summary.enquiries} enquiries`);
  console.log(
    `  published listings: ${summary.publishedListings}, listing photos: ${summary.listingMedia}`,
  );
  console.log('');
  for (const [table, key] of perTable) {
    console.log(`  ${table.padEnd(28)} ${String(counts[key] ?? 0).padStart(5)}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Seeding Live Envt development data…');

  const locations = await seedLocations();
  const eventTypes = await seedEventTypes();
  const categories = await seedCategories();
  const attributes = await seedAttributes(categories.records);
  const amenities = await seedAmenities();
  const users = await seedUsers(locations.ids);
  const listings = await seedListings({
    categories: categories.records,
    locations: locations.ids,
    eventTypes: eventTypes.ids,
    amenities: amenities.ids,
    attributes: attributes.records,
    adminId: users.admin,
  });
  const enquiries = await seedEnquiries({
    listings: listings.ids,
    locations: locations.ids,
    eventTypes: eventTypes.ids,
    users,
  });
  const auditLogCount = await seedAuditLogs({ adminId: users.admin, listings: listings.ids });

  await verifySeededData();

  await printSummary({
    users: USER_SEEDS.length,
    locations: locations.count,
    categories: categories.count,
    eventTypes: eventTypes.count,
    attributeDefinitions: attributes.definitionCount,
    attributeOptions: attributes.optionCount,
    categoryAttributes: attributes.bindingCount,
    amenities: amenities.count,
    listings: LISTING_SEEDS.length,
    publishedListings: LISTING_SEEDS.filter((listing) => listing.publicationStatus === 'PUBLISHED')
      .length,
    listingServices: LISTING_SEEDS.reduce((total, listing) => total + listing.services.length, 0),
    listingPackages: LISTING_SEEDS.reduce((total, listing) => total + listing.packages.length, 0),
    venueSpaces: LISTING_SEEDS.reduce((total, listing) => total + listing.venueSpaces.length, 0),
    listingMedia: listings.mediaCount,
    attributeValues: listings.attributeValueCount,
    enquiries: enquiries.count,
    enquiryListings: enquiries.listingCount,
    enquiryActivities: enquiries.activityCount,
    enquiryNotes: enquiries.noteCount,
    auditLogs: auditLogCount,
  });
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
