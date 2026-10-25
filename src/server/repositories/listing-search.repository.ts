import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { formatAttributeValueCompact } from '@/server/domain/attribute-display';
import { formatCapacityRange, formatPriceRange } from '@/lib/format';
import type { ListingCard, ListingCardHighlight } from '@/server/dto/listing.dto';

/**
 * The only module that knows how a listing search is executed.
 *
 * Keeping the query here means swapping PostgreSQL for a dedicated search
 * engine later is a single-module change (ADR-8).
 */

/**
 * Card projection.
 *
 * Everything a result card needs is fetched in ONE query — cover media,
 * category, location, media count and the category's card attributes — so a
 * page of 48 results cannot become 48+ queries.
 */
export function buildListingCardSelect(cardAttributeIds: readonly string[]) {
  return {
    id: true,
    slug: true,
    name: true,
    tagline: true,
    priceMin: true,
    priceMax: true,
    priceUnit: true,
    capacityMin: true,
    capacityMax: true,
    verificationStatus: true,
    isFeatured: true,
    primaryCategory: { select: { name: true, slug: true } },
    primaryLocation: { select: { name: true, slug: true, type: true } },
    media: {
      where: { status: 'READY' as const },
      orderBy: [{ isCover: 'desc' as const }, { sortOrder: 'asc' as const }],
      take: 1,
      select: { publicUrl: true, altText: true, width: true, height: true },
    },
    _count: { select: { media: { where: { status: 'READY' as const } } } },
    // Always present so the select has a single shape. An empty `in` list
    // simply matches no rows, which keeps the payload type stable.
    attributeValues: {
      where: { attributeId: { in: [...cardAttributeIds] } },
      select: {
        valueText: true,
        valueNumber: true,
        valueBoolean: true,
        valueDate: true,
        optionIds: true,
        attribute: {
          select: {
            id: true,
            code: true,
            label: true,
            dataType: true,
            unit: true,
            options: { select: { id: true, value: true, label: true } },
          },
        },
        option: { select: { value: true, label: true } },
      },
    },
  } satisfies Prisma.BusinessListingSelect;
}

type ListingCardRow = Prisma.BusinessListingGetPayload<{
  select: ReturnType<typeof buildListingCardSelect>;
}>;

/**
 * Maps a search row to the public card shape.
 *
 * `cardAttributeIds` fixes the highlight order, so a venue always shows
 * capacity/venue type in the same positions regardless of database row order.
 */
export function toListingCard(
  row: ListingCardRow,
  cardAttributeIds: readonly string[],
): ListingCard {
  const highlights: ListingCardHighlight[] = [];

  const byAttributeId = new Map(
    (row.attributeValues ?? []).map((value) => [value.attribute.id, value]),
  );

  for (const attributeId of cardAttributeIds) {
    const value = byAttributeId.get(attributeId);
    if (!value) continue;

    const display = formatAttributeValueCompact(value.attribute, value);
    if (!display) continue;

    highlights.push({
      code: value.attribute.code,
      label: value.attribute.label,
      value: display,
    });
  }

  const cover = row.media[0]
    ? {
        url: row.media[0].publicUrl,
        alt: row.media[0].altText,
        width: row.media[0].width,
        height: row.media[0].height,
      }
    : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    category: row.primaryCategory
      ? { name: row.primaryCategory.name, slug: row.primaryCategory.slug }
      : null,
    location: row.primaryLocation
      ? {
          name: row.primaryLocation.name,
          slug: row.primaryLocation.slug,
          type: row.primaryLocation.type,
        }
      : null,
    priceLabel: formatPriceRange({
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      priceUnit: row.priceUnit,
    }),
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    priceUnit: row.priceUnit,
    capacityLabel: formatCapacityRange(row.capacityMin, row.capacityMax),
    isVerified: row.verificationStatus === 'VERIFIED',
    isFeatured: row.isFeatured,
    cover,
    galleryCount: row._count.media,
    highlights,
  };
}

export interface SearchExecution {
  where: Prisma.BusinessListingWhereInput;
  orderBy: Prisma.BusinessListingOrderByWithRelationInput[];
  page: number;
  pageSize: number;
  cardAttributeIds: readonly string[];
}

/**
 * Runs the count and the page inside one transaction, using the same `where`
 * object for both. That is what makes the displayed result count always agree
 * with the rows actually returned.
 */
export async function searchListingCards(execution: SearchExecution): Promise<{
  cards: ListingCard[];
  totalItems: number;
}> {
  const select = buildListingCardSelect(execution.cardAttributeIds);

  const [rows, totalItems] = await prisma.$transaction([
    prisma.businessListing.findMany({
      where: execution.where,
      orderBy: execution.orderBy,
      skip: (execution.page - 1) * execution.pageSize,
      take: execution.pageSize,
      select,
    }),
    prisma.businessListing.count({ where: execution.where }),
  ]);

  return {
    cards: rows.map((row) => toListingCard(row, execution.cardAttributeIds)),
    totalItems,
  };
}

/** Reads the attribute ids a category's cards should highlight. */
export async function getCardAttributeIdsForCategoryIds(
  categoryIds: readonly string[],
): Promise<string[]> {
  if (categoryIds.length === 0) return [];

  const bindings = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: [...categoryIds] }, showOnCard: true },
    orderBy: [{ sortOrder: 'asc' }],
    select: { attributeId: true, categoryId: true },
  });

  // Most specific category first so a subcategory's own choice wins.
  const seen = new Set<string>();
  const ordered: string[] = [];
  const reversed = [...bindings].reverse();
  for (const binding of reversed) {
    if (seen.has(binding.attributeId)) continue;
    seen.add(binding.attributeId);
    ordered.push(binding.attributeId);
  }

  return ordered.slice(0, 4);
}
