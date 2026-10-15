import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { formatAttributeValue } from '@/server/domain/attribute-display';
import { deriveContactDisclosure } from '@/server/domain/contact';
import type { EnquiryStatusValue } from '@/server/domain/enquiry-status';
import { formatCapacityRange, formatPriceRange } from '@/lib/format';
import { disambiguateSlug, slugify } from '@/lib/slug';
import { normaliseSearchText } from '@/server/domain/search-filters';
import { toAuditActor } from '@/server/domain/audit-actor';
import { recordAudit } from '@/server/services/audit.service';
import type { ListingDetail, ListingAttributeGroupView } from '@/server/dto/listing.dto';
import type { ListingCreateInput, ListingUpdateInput } from '@/lib/validation/listing';
import type { AuditAction } from '@/lib/validation/audit';
import { refreshListingSearchText } from '@/server/services/listing-search-text';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Public read
// ---------------------------------------------------------------------------

export interface PublicListingOptions {
  /**
   * The viewer's lead status against this listing, if any. Controls whether
   * private contact channels are disclosed. `null`/undefined means no lead.
   */
  leadStatus?: EnquiryStatusValue | null;
  /** Administrators may preview an unpublished listing. */
  allowUnpublished?: boolean;
}

/**
 * Loads a listing profile for the public site.
 *
 * Unpublished and archived listings are invisible unless the caller explicitly
 * opts in as an administrator, so a guessed slug cannot reveal a draft.
 */
export async function getPublicListingBySlug(
  slug: string,
  options: PublicListingOptions = {},
): Promise<ListingDetail> {
  const listing = await prisma.businessListing.findUnique({
    where: { slug },
    include: {
      primaryCategory: { select: { name: true, slug: true } },
      primaryLocation: {
        select: {
          id: true,
          name: true,
          slug: true,
          path: true,
          type: true,
          latitude: true,
          longitude: true,
        },
      },
      categories: {
        select: { category: { select: { name: true, slug: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      eventTypes: {
        select: { eventType: { select: { name: true, slug: true } } },
      },
      serviceAreas: {
        select: { location: { select: { name: true, slug: true, type: true } } },
      },
      amenities: {
        select: {
          amenity: { select: { code: true, label: true, groupLabel: true, sortOrder: true } },
        },
      },
      media: {
        where: { status: 'READY' },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        select: { publicUrl: true, altText: true, width: true, height: true },
      },
      services: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      packages: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      venueSpaces: { orderBy: { sortOrder: 'asc' } },
      attributeValues: {
        select: {
          valueText: true,
          valueNumber: true,
          valueBoolean: true,
          valueDate: true,
          optionIds: true,
          option: { select: { value: true, label: true } },
          attribute: {
            select: {
              id: true,
              code: true,
              label: true,
              dataType: true,
              unit: true,
              sortOrder: true,
              options: { select: { id: true, value: true, label: true } },
            },
          },
        },
      },
    },
  });

  if (!listing) throw new NotFoundError('Business');

  const isPubliclyVisible =
    listing.publicationStatus === 'PUBLISHED' && listing.archivedAt === null;

  if (!isPubliclyVisible && !options.allowUnpublished) {
    throw new NotFoundError('Business');
  }

  const attributeGroups = buildAttributeGroups(listing.attributeValues);

  const contact = deriveContactDisclosure(
    {
      contactPhone: listing.contactPhone,
      contactEmail: listing.contactEmail,
      contactWhatsapp: listing.contactWhatsapp,
      websiteUrl: listing.websiteUrl,
      showPhone: listing.showPhone,
      showEmail: listing.showEmail,
      showWhatsapp: listing.showWhatsapp,
      showWebsite: listing.showWebsite,
    },
    options.leadStatus ?? null,
  );

  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    tagline: listing.tagline,
    description: listing.description,
    about: listing.about,
    publicationStatus: listing.publicationStatus,
    verificationStatus: listing.verificationStatus,
    isFeatured: listing.isFeatured,
    publishedAt: listing.publishedAt,
    updatedAt: listing.updatedAt,

    primaryCategory: listing.primaryCategory,
    categories: listing.categories.map((row) => row.category),
    location: listing.primaryLocation,
    addressLine1: listing.addressLine1,
    addressLine2: listing.addressLine2,
    postalCode: listing.postalCode,

    eventTypes: listing.eventTypes.map((row) => row.eventType),
    serviceAreas: listing.serviceAreas.map((row) => row.location),
    amenities: listing.amenities
      .map((row) => row.amenity)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
      .map(({ code, label, groupLabel }) => ({ code, label, groupLabel })),

    gallery: listing.media.map((media) => ({
      url: media.publicUrl,
      alt: media.altText,
      width: media.width,
      height: media.height,
    })),

    services: listing.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      priceLabel: formatPriceRange({
        priceMin: service.priceFrom,
        priceMax: service.priceTo,
        priceUnit: service.priceUnit,
      }),
      priceFrom: service.priceFrom,
      priceTo: service.priceTo,
      priceUnit: service.priceUnit,
      durationMinutes: service.durationMinutes,
      includes: service.includes,
    })),

    packages: listing.packages.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      price: pack.price,
      priceUnit: pack.priceUnit,
      priceLabel: formatPriceRange({
        priceMin: pack.price,
        priceMax: pack.price,
        priceUnit: pack.priceUnit,
      }),
      minGuests: pack.minGuests,
      maxGuests: pack.maxGuests,
      inclusions: pack.inclusions,
      exclusions: pack.exclusions,
    })),

    spaces: listing.venueSpaces.map((space) => ({
      id: space.id,
      name: space.name,
      description: space.description,
      capacitySeated: space.capacitySeated,
      capacityStanding: space.capacityStanding,
      areaSqft: space.areaSqft,
      isIndoor: space.isIndoor,
      isOutdoor: space.isOutdoor,
      layoutOptions: space.layoutOptions,
    })),

    attributeGroups,

    priceLabel: formatPriceRange({
      priceMin: listing.priceMin,
      priceMax: listing.priceMax,
      priceUnit: listing.priceUnit,
    }),
    priceMin: listing.priceMin,
    priceMax: listing.priceMax,
    priceUnit: listing.priceUnit,
    capacityLabel: formatCapacityRange(listing.capacityMin, listing.capacityMax),

    contact: {
      phone: contact.phone,
      email: contact.email,
      whatsapp: contact.whatsapp,
      website: contact.website,
      hasWithheldChannels: contact.hasWithheldChannels,
      message: contact.hasWithheldChannels
        ? 'Send an enquiry to see the full contact details for this business.'
        : null,
    },
  };
}

type AttributeValueRow = {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueDate: Date | null;
  optionIds: string[];
  option: { value: string; label: string } | null;
  attribute: {
    id: string;
    code: string;
    label: string;
    dataType: (typeof import('@/generated/prisma/enums').AttributeDataType)[keyof typeof import('@/generated/prisma/enums').AttributeDataType];
    unit: string | null;
    sortOrder: number;
    options: Array<{ value: string; label: string }>;
  };
};

/**
 * Resolves many listing slugs to just their public identity, in one query.
 *
 * The enquiry form needs only `{ slug, name }` to show which businesses a brief
 * will be sent to, but it was calling `getPublicListingBySlug` once per slug —
 * up to ten concurrent loads of ten relations each (media, services, packages,
 * spaces, attributes, amenities, categories, event types, service areas) to
 * produce two strings. This selects the two columns the caller actually renders.
 *
 * Slugs that are not publicly visible are omitted rather than throwing, so the
 * caller can report how many were dropped. The caller's order is preserved,
 * because the form lists the chosen businesses in the order the customer picked
 * them.
 */
export async function getPublicListingSummariesBySlugs(
  slugs: readonly string[],
): Promise<Array<{ slug: string; name: string }>> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return [];

  const rows = await prisma.businessListing.findMany({
    where: {
      slug: { in: unique },
      publicationStatus: 'PUBLISHED',
      archivedAt: null,
    },
    select: { slug: true, name: true },
  });

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return unique
    .map((slug) => bySlug.get(slug))
    .filter((row): row is { slug: string; name: string } => row !== undefined);
}

function buildAttributeGroups(rows: AttributeValueRow[]): ListingAttributeGroupView[] {
  const groups = new Map<string | null, ListingAttributeGroupView['attributes']>();

  const sorted = [...rows].sort(
    (a, b) =>
      a.attribute.sortOrder - b.attribute.sortOrder ||
      a.attribute.label.localeCompare(b.attribute.label),
  );

  for (const row of sorted) {
    const value = formatAttributeValue(row.attribute, row);
    if (!value) continue;

    // Group label is a presentation concern of the binding; without a join we
    // fall back to a single ungrouped list rather than inventing headings.
    const key: string | null = null;
    const bucket = groups.get(key) ?? [];
    bucket.push({ code: row.attribute.code, label: row.attribute.label, value });
    groups.set(key, bucket);
  }

  return [...groups.entries()].map(([groupLabel, attributes]) => ({ groupLabel, attributes }));
}

// ---------------------------------------------------------------------------
// Slug management
// ---------------------------------------------------------------------------

async function uniqueListingSlug(desired: string, tx: Tx, excludeId?: string): Promise<string> {
  const base = slugify(desired) || 'business';

  const existing = await tx.businessListing.findMany({
    where: {
      slug: { startsWith: base },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { slug: true },
  });

  return disambiguateSlug(base, new Set(existing.map((row) => row.slug)));
}

// ---------------------------------------------------------------------------
// Admin write
// ---------------------------------------------------------------------------

export interface AdminActorContext {
  userId: string;
  name: string;
  ipHash?: string | null;
  userAgent?: string | null;
}

/**
 * Validates that the requested primary category is one of the listing's
 * categories, and that each referenced category exists.
 */
async function assertCategoriesValid(
  tx: Tx,
  primaryCategoryId: string,
  categoryIds: readonly string[],
): Promise<string[]> {
  const all = Array.from(new Set([primaryCategoryId, ...categoryIds]));

  const found = await tx.category.findMany({
    where: { id: { in: all } },
    select: { id: true },
  });
  if (found.length !== all.length) {
    const foundIds = new Set(found.map((row) => row.id));
    throw new ValidationError('Some categories do not exist', {
      unknown: all.filter((id) => !foundIds.has(id)),
    });
  }

  return all;
}

async function assertReferencesExist(
  tx: Tx,
  input: {
    primaryLocationId: string;
    serviceAreaIds: readonly string[];
    eventTypeIds: readonly string[];
    amenityIds: readonly string[];
  },
): Promise<void> {
  const [location, areas, eventTypes, amenities] = await Promise.all([
    tx.location.count({ where: { id: input.primaryLocationId } }),
    tx.location.count({ where: { id: { in: [...input.serviceAreaIds] } } }),
    tx.eventType.count({ where: { id: { in: [...input.eventTypeIds] } } }),
    tx.amenity.count({ where: { id: { in: [...input.amenityIds] } } }),
  ]);

  const errors: Record<string, string> = {};
  if (location === 0) errors.primaryLocationId = 'That location does not exist';
  if (areas !== new Set(input.serviceAreaIds).size) {
    errors.serviceAreaIds = 'One or more service areas do not exist';
  }
  if (eventTypes !== new Set(input.eventTypeIds).size) {
    errors.eventTypeIds = 'One or more event types do not exist';
  }
  if (amenities !== new Set(input.amenityIds).size) {
    errors.amenityIds = 'One or more amenities do not exist';
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Some related records do not exist', errors);
  }
}

export async function adminCreateListing(input: ListingCreateInput, actor: AdminActorContext) {
  return prisma.$transaction(async (tx) => {
    await assertCategoriesValid(tx, input.primaryCategoryId, input.categoryIds);
    await assertReferencesExist(tx, {
      primaryLocationId: input.primaryLocationId,
      serviceAreaIds: input.serviceAreaIds,
      eventTypeIds: input.eventTypeIds,
      amenityIds: input.amenityIds,
    });

    const slug = await uniqueListingSlug(input.slug ?? input.name, tx);

    const listing = await tx.businessListing.create({
      data: {
        slug,
        name: input.name,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
        about: input.about ?? null,
        primaryCategoryId: input.primaryCategoryId,
        primaryLocationId: input.primaryLocationId,
        contactPersonName: input.contactPersonName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        contactWhatsapp: input.contactWhatsapp ?? null,
        websiteUrl: input.websiteUrl ?? null,
        showPhone: input.showPhone,
        showEmail: input.showEmail,
        showWhatsapp: input.showWhatsapp,
        showWebsite: input.showWebsite,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        postalCode: input.postalCode ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        priceMin: input.priceMin ?? null,
        priceMax: input.priceMax ?? null,
        priceUnit: input.priceUnit ?? null,
        capacityMin: input.capacityMin ?? null,
        capacityMax: input.capacityMax ?? null,
        createdById: actor.userId,
        // Always created as a draft; publishing is a separate, audited action.
        publicationStatus: 'DRAFT',
        categories: {
          create: Array.from(new Set([input.primaryCategoryId, ...input.categoryIds])).map(
            (categoryId) => ({
              categoryId,
              isPrimary: categoryId === input.primaryCategoryId,
            }),
          ),
        },
        eventTypes: { create: input.eventTypeIds.map((eventTypeId) => ({ eventTypeId })) },
        serviceAreas: {
          create: input.serviceAreaIds.map((locationId) => ({ locationId })),
        },
        amenities: { create: input.amenityIds.map((amenityId) => ({ amenityId })) },
        services: input.services ? { create: input.services.map(toServiceCreate) } : undefined,
        packages: input.packages ? { create: input.packages.map(toPackageCreate) } : undefined,
        venueSpaces: input.venueSpaces
          ? { create: input.venueSpaces.map(toSpaceCreate) }
          : undefined,
      },
      select: { id: true, slug: true, name: true },
    });

    await refreshListingSearchText(listing.id, tx);

    await recordAudit(
      {
        action: 'listing.created',
        entityType: 'BusinessListing',
        entityId: listing.id,
        summary: `Created listing "${listing.name}"`,
        context: toAuditActor(actor),
      },
      tx,
    );

    return listing;
  });
}

function toServiceCreate(service: NonNullable<ListingCreateInput['services']>[number]) {
  return {
    name: service.name,
    description: service.description ?? null,
    priceFrom: service.priceFrom ?? null,
    priceTo: service.priceTo ?? null,
    priceUnit: service.priceUnit ?? null,
    durationMinutes: service.durationMinutes ?? null,
    includes: service.includes,
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  };
}

function toPackageCreate(pack: NonNullable<ListingCreateInput['packages']>[number]) {
  return {
    name: pack.name,
    description: pack.description ?? null,
    price: pack.price ?? null,
    priceUnit: pack.priceUnit ?? null,
    minGuests: pack.minGuests ?? null,
    maxGuests: pack.maxGuests ?? null,
    inclusions: pack.inclusions,
    exclusions: pack.exclusions,
    isActive: pack.isActive,
    sortOrder: pack.sortOrder,
  };
}

function toSpaceCreate(space: NonNullable<ListingCreateInput['venueSpaces']>[number]) {
  return {
    name: space.name,
    description: space.description ?? null,
    capacitySeated: space.capacitySeated ?? null,
    capacityStanding: space.capacityStanding ?? null,
    areaSqft: space.areaSqft ?? null,
    isIndoor: space.isIndoor,
    isOutdoor: space.isOutdoor,
    layoutOptions: space.layoutOptions,
    sortOrder: space.sortOrder,
  };
}

/**
 * Updates a listing.
 *
 * Child collections (`services`, `packages`, `venueSpaces`) are replaced
 * wholesale when present, because the admin editor submits the complete set —
 * a partial merge would make removal impossible and reorder unpredictable.
 */
export async function adminUpdateListing(
  id: string,
  input: ListingUpdateInput,
  actor: AdminActorContext,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.businessListing.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        primaryCategoryId: true,
        primaryLocationId: true,
        isFeatured: true,
      },
    });
    if (!existing) throw new NotFoundError('Listing');

    if (input.primaryCategoryId || input.categoryIds) {
      await assertCategoriesValid(
        tx,
        input.primaryCategoryId ?? existing.primaryCategoryId,
        input.categoryIds ?? [],
      );
    }

    // Reference validation must run whenever *any* related collection is being
    // replaced, not only when the primary location changes — otherwise a request
    // that updates only service areas could attach a location that does not
    // exist and fail on the foreign key with an opaque error.
    if (input.primaryLocationId || input.serviceAreaIds || input.eventTypeIds || input.amenityIds) {
      await assertReferencesExist(tx, {
        primaryLocationId: input.primaryLocationId ?? existing.primaryLocationId,
        serviceAreaIds: input.serviceAreaIds ?? [],
        eventTypeIds: input.eventTypeIds ?? [],
        amenityIds: input.amenityIds ?? [],
      });
    }

    const slug =
      input.slug && input.slug !== existing.slug
        ? await uniqueListingSlug(input.slug, tx, id)
        : undefined;

    await tx.businessListing.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.about !== undefined ? { about: input.about ?? null } : {}),
        ...(input.primaryCategoryId ? { primaryCategoryId: input.primaryCategoryId } : {}),
        ...(input.primaryLocationId ? { primaryLocationId: input.primaryLocationId } : {}),
        ...(input.contactPersonName !== undefined
          ? { contactPersonName: input.contactPersonName ?? null }
          : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone ?? null } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail ?? null } : {}),
        ...(input.contactWhatsapp !== undefined
          ? { contactWhatsapp: input.contactWhatsapp ?? null }
          : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
        ...(input.showPhone !== undefined ? { showPhone: input.showPhone } : {}),
        ...(input.showEmail !== undefined ? { showEmail: input.showEmail } : {}),
        ...(input.showWhatsapp !== undefined ? { showWhatsapp: input.showWhatsapp } : {}),
        ...(input.showWebsite !== undefined ? { showWebsite: input.showWebsite } : {}),
        ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 ?? null } : {}),
        ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 ?? null } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode ?? null } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude ?? null } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude ?? null } : {}),
        ...(input.priceMin !== undefined ? { priceMin: input.priceMin ?? null } : {}),
        ...(input.priceMax !== undefined ? { priceMax: input.priceMax ?? null } : {}),
        ...(input.priceUnit !== undefined ? { priceUnit: input.priceUnit ?? null } : {}),
        ...(input.capacityMin !== undefined ? { capacityMin: input.capacityMin ?? null } : {}),
        ...(input.capacityMax !== undefined ? { capacityMax: input.capacityMax ?? null } : {}),
        ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      },
    });

    // Featured placement is a separate editorial act from editing the record, so
    // it gets its own audit entry rather than being buried in "fields updated".
    if (input.isFeatured !== undefined && input.isFeatured !== existing.isFeatured) {
      await recordAudit(
        {
          action: input.isFeatured ? 'listing.featured' : 'listing.unfeatured',
          entityType: 'BusinessListing',
          entityId: id,
          summary: `${input.isFeatured ? 'Featured' : 'Unfeatured'} listing "${existing.name}"`,
          context: toAuditActor(actor),
        },
        tx,
      );
    }

    if (input.primaryCategoryId || input.categoryIds) {
      // Falls back to the listing's existing primary category. The previous
      // `input.primaryCategoryId ?? input.primaryCategoryId` self-coalesce
      // evaluated to `undefined` when only `categoryIds` was sent, which
      // rebuilt the join with every row `isPrimary: false` and silently lost
      // the listing's primary category.
      const primaryCategoryId = input.primaryCategoryId ?? existing.primaryCategoryId;
      const categoryIds = Array.from(
        new Set([primaryCategoryId, ...(input.categoryIds ?? [])].filter(Boolean) as string[]),
      );
      await tx.listingCategory.deleteMany({ where: { listingId: id } });
      await tx.listingCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          listingId: id,
          categoryId,
          isPrimary: categoryId === primaryCategoryId,
        })),
      });
    }

    if (input.eventTypeIds) {
      await tx.listingEventType.deleteMany({ where: { listingId: id } });
      await tx.listingEventType.createMany({
        data: input.eventTypeIds.map((eventTypeId) => ({ listingId: id, eventTypeId })),
      });
    }

    if (input.serviceAreaIds) {
      await tx.listingServiceArea.deleteMany({ where: { listingId: id } });
      await tx.listingServiceArea.createMany({
        data: input.serviceAreaIds.map((locationId) => ({ listingId: id, locationId })),
      });
    }

    if (input.amenityIds) {
      await tx.listingAmenity.deleteMany({ where: { listingId: id } });
      await tx.listingAmenity.createMany({
        data: input.amenityIds.map((amenityId) => ({ listingId: id, amenityId })),
      });
    }

    if (input.services) {
      await tx.listingService.deleteMany({ where: { listingId: id } });
      await tx.listingService.createMany({
        data: input.services.map((service) => ({ ...toServiceCreate(service), listingId: id })),
      });
    }

    if (input.packages) {
      await tx.listingPackage.deleteMany({ where: { listingId: id } });
      await tx.listingPackage.createMany({
        data: input.packages.map((pack) => ({ ...toPackageCreate(pack), listingId: id })),
      });
    }

    if (input.venueSpaces) {
      await tx.venueSpace.deleteMany({ where: { listingId: id } });
      await tx.venueSpace.createMany({
        data: input.venueSpaces.map((space) => ({ ...toSpaceCreate(space), listingId: id })),
      });
    }

    await refreshListingSearchText(id, tx);

    await recordAudit(
      {
        action: 'listing.updated',
        entityType: 'BusinessListing',
        entityId: id,
        summary: `Updated listing "${input.name ?? existing.name}"`,
        metadata: { fields: Object.keys(input) },
        context: toAuditActor(actor),
      },
      tx,
    );

    return tx.businessListing.findUniqueOrThrow({
      where: { id },
      select: { id: true, slug: true, name: true, publicationStatus: true },
    });
  });
}

export type PublicationAction = 'publish' | 'unpublish' | 'archive' | 'restore';

/**
 * Publication state machine.
 *
 * Publishing requires at least one ready image and a description, because a
 * published listing with no photo or copy is a dead end for the customer and
 * undermines the directory's credibility.
 */
export async function adminSetPublicationStatus(
  id: string,
  action: PublicationAction,
  actor: AdminActorContext,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.businessListing.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        publicationStatus: true,
        description: true,
        _count: { select: { media: { where: { status: 'READY' } } } },
      },
    });
    if (!listing) throw new NotFoundError('Listing');

    if (action === 'publish') {
      if (listing.publicationStatus === 'PUBLISHED') {
        throw new ConflictError('That listing is already published');
      }
      if (listing._count.media === 0) {
        throw new ConflictError(
          'Add at least one image before publishing — a listing with no photo is not useful to customers',
        );
      }
      if (!listing.description?.trim()) {
        throw new ConflictError('Add a description before publishing this listing');
      }
    }

    const data: Prisma.BusinessListingUpdateInput = {};
    let auditAction: AuditAction = 'listing.updated';

    switch (action) {
      case 'publish':
        data.publicationStatus = 'PUBLISHED';
        data.publishedAt = new Date();
        data.archivedAt = null;
        auditAction = 'listing.published';
        break;
      case 'unpublish':
        data.publicationStatus = 'UNPUBLISHED';
        auditAction = 'listing.unpublished';
        break;
      case 'archive':
        data.publicationStatus = 'ARCHIVED';
        data.archivedAt = new Date();
        auditAction = 'listing.archived';
        break;
      case 'restore':
        data.publicationStatus = 'DRAFT';
        data.archivedAt = null;
        auditAction = 'listing.restored';
        break;
    }

    const updated = await tx.businessListing.update({
      where: { id },
      data,
      select: { id: true, slug: true, name: true, publicationStatus: true, publishedAt: true },
    });

    await recordAudit(
      {
        action: auditAction,
        entityType: 'BusinessListing',
        entityId: id,
        summary: `${action} listing "${listing.name}"`,
        metadata: reason ? { reason } : undefined,
        context: toAuditActor(actor),
      },
      tx,
    );

    return updated;
  });
}

export type VerificationAction = 'verify' | 'reject' | 'reset';

export async function adminSetVerificationStatus(
  id: string,
  action: VerificationAction,
  actor: AdminActorContext,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.businessListing.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!listing) throw new NotFoundError('Listing');

    const verificationStatus =
      action === 'verify' ? 'VERIFIED' : action === 'reject' ? 'REJECTED' : 'UNVERIFIED';

    const updated = await tx.businessListing.update({
      where: { id },
      data: { verificationStatus },
      select: { id: true, slug: true, name: true, verificationStatus: true },
    });

    await recordAudit(
      {
        action: action === 'verify' ? 'listing.verified' : 'listing.unverified',
        entityType: 'BusinessListing',
        entityId: id,
        summary: `Marked listing "${listing.name}" as ${verificationStatus}`,
        metadata: reason ? { reason } : undefined,
        context: toAuditActor(actor),
      },
      tx,
    );

    return updated;
  });
}

/** Admin list query used by the listing management table. */
export async function adminListListings(query: {
  page: number;
  pageSize: number;
  q?: string;
  publicationStatus?: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
  verificationStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  categoryId?: string;
  locationId?: string;
  isFeatured?: boolean;
}) {
  const where: Prisma.BusinessListingWhereInput = {
    ...(query.publicationStatus ? { publicationStatus: query.publicationStatus } : {}),
    ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
    ...(query.isFeatured !== undefined ? { isFeatured: query.isFeatured } : {}),
    ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
    ...(query.locationId ? { primaryLocationId: query.locationId } : {}),
    ...(query.q ? { searchText: { contains: normaliseSearchText(query.q) } } : {}),
  };

  const [rows, totalItems] = await prisma.$transaction([
    prisma.businessListing.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        publicationStatus: true,
        verificationStatus: true,
        isFeatured: true,
        priceMin: true,
        priceMax: true,
        priceUnit: true,
        updatedAt: true,
        publishedAt: true,
        primaryCategory: { select: { name: true, slug: true } },
        primaryLocation: { select: { name: true, slug: true } },
        _count: { select: { media: true, enquiryListings: true } },
        media: {
          where: { status: 'READY', isCover: true },
          take: 1,
          select: { publicUrl: true, altText: true },
        },
      },
    }),
    prisma.businessListing.count({ where }),
  ]);

  return { rows, totalItems };
}

/** Full listing payload for the admin editor. */
export async function adminGetListing(id: string) {
  const listing = await prisma.businessListing.findUnique({
    where: { id },
    include: {
      primaryCategory: { select: { id: true, name: true, slug: true } },
      primaryLocation: { select: { id: true, name: true, slug: true, type: true, path: true } },
      categories: { select: { categoryId: true, isPrimary: true } },
      eventTypes: { select: { eventTypeId: true } },
      serviceAreas: { select: { locationId: true } },
      amenities: { select: { amenityId: true } },
      services: { orderBy: { sortOrder: 'asc' } },
      packages: { orderBy: { sortOrder: 'asc' } },
      venueSpaces: { orderBy: { sortOrder: 'asc' } },
      media: { orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }] },
      attributeValues: {
        select: {
          attributeId: true,
          valueText: true,
          valueNumber: true,
          valueBoolean: true,
          valueDate: true,
          optionId: true,
          optionIds: true,
        },
      },
    },
  });

  if (!listing) throw new NotFoundError('Listing');
  return listing;
}
