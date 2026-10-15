import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { normaliseSearchText } from '@/server/domain/search-filters';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Search text
// ---------------------------------------------------------------------------

/**
 * Recomputes the denormalised `searchText` haystack for a listing.
 *
 * This column backs the trigram GIN index used by text search and sorting, so
 * it must be refreshed on every write that changes anything searchable. Doing it
 * in the same transaction as the write is what keeps the index honest.
 */
export async function computeSearchText(listingId: string, tx: Tx = prisma): Promise<string> {
  const listing = await tx.businessListing.findUniqueOrThrow({
    where: { id: listingId },
    select: {
      name: true,
      tagline: true,
      description: true,
      about: true,
      primaryCategory: { select: { name: true, path: true } },
      primaryLocation: { select: { name: true, path: true } },
      categories: { select: { category: { select: { name: true } } } },
      eventTypes: { select: { eventType: { select: { name: true } } } },
      serviceAreas: { select: { location: { select: { name: true } } } },
      services: { where: { isActive: true }, select: { name: true } },
      amenities: { select: { amenity: { select: { label: true } } } },
    },
  });

  const parts = [
    listing.name,
    listing.tagline,
    listing.description,
    listing.about,
    listing.primaryCategory?.name,
    listing.primaryCategory?.path,
    listing.primaryLocation?.name,
    listing.primaryLocation?.path,
    ...listing.categories.map((row) => row.category.name),
    ...listing.eventTypes.map((row) => row.eventType.name),
    ...listing.serviceAreas.map((row) => row.location.name),
    ...listing.services.map((row) => row.name),
    ...listing.amenities.map((row) => row.amenity.label),
  ];

  return normaliseSearchText(parts.filter(Boolean).join(' ')).slice(0, 4000);
}

export async function refreshListingSearchText(listingId: string, tx: Tx): Promise<void> {
  const searchText = await computeSearchText(listingId, tx);
  await tx.businessListing.update({ where: { id: listingId }, data: { searchText } });
}

// ---------------------------------------------------------------------------
// Catalogue renames
// ---------------------------------------------------------------------------

/**
 * Refreshes the denormalised search text of every listing that references a
 * renamed catalogue entity.
 *
 * `searchText` embeds names copied from categories, locations, event types,
 * service areas and amenities. Renaming one of those changed the catalogue but
 * left every listing's haystack holding the old word, so search kept matching a
 * name that no longer existed and stopped matching the new one. Nothing failed
 * loudly: the index simply disagreed with the source of truth until that listing
 * happened to be saved again.
 *
 * These helpers recompute in batches rather than one listing per transaction,
 * because a rename can touch many rows and the fan-out is not user-facing.
 * A rename is rare; correctness is worth the write.
 */
async function refreshSearchTextForListings(listingIds: readonly string[]): Promise<number> {
  const unique = [...new Set(listingIds)];
  if (unique.length === 0) return 0;

  const texts = await Promise.all(unique.map((id) => computeSearchText(id)));

  await prisma.$transaction(
    unique.map((id, index) =>
      prisma.businessListing.update({
        where: { id },
        data: { searchText: texts[index] },
      }),
    ),
  );

  return unique.length;
}

/** Listings that name this category as their primary, or reference it at all. */
export async function refreshSearchTextForCategory(categoryId: string): Promise<number> {
  const listings = await prisma.businessListing.findMany({
    where: {
      OR: [{ primaryCategoryId: categoryId }, { categories: { some: { categoryId } } }],
    },
    select: { id: true },
  });
  return refreshSearchTextForListings(listings.map((row) => row.id));
}

/** Listings that name this location as their primary, or serve it as an area. */
export async function refreshSearchTextForLocation(locationId: string): Promise<number> {
  const listings = await prisma.businessListing.findMany({
    where: {
      OR: [{ primaryLocationId: locationId }, { serviceAreas: { some: { locationId } } }],
    },
    select: { id: true },
  });
  return refreshSearchTextForListings(listings.map((row) => row.id));
}

/** Listings that declare this event type. */
export async function refreshSearchTextForEventType(eventTypeId: string): Promise<number> {
  const listings = await prisma.businessListing.findMany({
    where: { eventTypes: { some: { eventTypeId } } },
    select: { id: true },
  });
  return refreshSearchTextForListings(listings.map((row) => row.id));
}

/** Listings that offer this amenity. */
export async function refreshSearchTextForAmenity(amenityId: string): Promise<number> {
  const listings = await prisma.businessListing.findMany({
    where: { amenities: { some: { amenityId } } },
    select: { id: true },
  });
  return refreshSearchTextForListings(listings.map((row) => row.id));
}
