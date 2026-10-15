import 'server-only';
import { ValidationError } from '@/lib/errors';
import { buildPaginated } from '@/lib/pagination';
import type { SearchQuery } from '@/lib/validation/search';
import {
  ATTRIBUTE_FILTER_PREFIX,
  extractAttributeFilterParams,
  type ListingSort,
} from '@/lib/validation/search';
import {
  buildListingOrderBy,
  buildListingWhere,
  parseFilterValues,
  type FilterDefinition,
  type ParsedFilter,
  type ListingSearchCriteria,
} from '@/server/domain/search-filters';
import {
  getCategoryDetail,
  resolveCategorySubtreeIds,
  resolveEventTypeIds,
  resolveLocationSubtreeIds,
} from '@/server/services/catalog.service';
import {
  getCardAttributeIdsForCategoryIds,
  searchListingCards,
} from '@/server/repositories/listing-search.repository';
import type {
  ListingSearchResult,
  SearchAppliedFilter,
  SearchFacetGroups,
} from '@/server/dto/listing.dto';
import { prisma } from '@/lib/db';

/**
 * Resolves multi-select option *values* to option *ids*.
 *
 * The URL carries readable option values, but `ListingAttributeValue.optionIds`
 * stores ids (that is what the relation and the GIN index use). Without this
 * translation a multi-select filter would compare a value against an id array
 * and silently return nothing — a bug that is invisible until someone filters.
 * A value missing from the catalogue is dropped rather than guessed; the
 * definition-driven validation already rejects unknown values, so a miss here
 * only happens if the catalogue changed mid-request.
 */
export async function resolveMultiSelectOptionIds(
  filters: readonly ParsedFilter[],
): Promise<ParsedFilter[]> {
  const multiSelect = filters.filter(
    (filter) => filter.kind === 'options' && filter.definition.dataType === 'MULTI_SELECT',
  );
  if (multiSelect.length === 0) return [...filters];

  const options = await prisma.attributeOption.findMany({
    where: { attributeId: { in: multiSelect.map((filter) => filter.definition.id) } },
    select: { id: true, attributeId: true, value: true },
  });

  const idByAttributeAndValue = new Map<string, string>();
  for (const option of options) {
    idByAttributeAndValue.set(`${option.attributeId}:${option.value}`, option.id);
  }

  return filters.map((filter) => {
    if (filter.kind !== 'options' || filter.definition.dataType !== 'MULTI_SELECT') return filter;

    const optionIds = filter.values
      .map((value) => idByAttributeAndValue.get(`${filter.definition.id}:${value}`))
      .filter((id): id is string => Boolean(id));

    return { ...filter, optionIds };
  });
}

export interface SearchRequest {
  query: SearchQuery;
  /** Raw query params, used to build per-filter removal links. */
  rawParams: Record<string, string | string[] | undefined>;
  /** Path the links should point at, e.g. `/vendors`. */
  basePath: string;
}

function toQueryString(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      if (item !== '') search.append(key, item);
    }
  }
  return search.toString();
}

function withPageReset(params: Record<string, string | string[] | undefined>) {
  const next = { ...params };
  delete next.page;
  return next;
}

/** Renders a parsed filter as the chip's human-readable value. */
function describeFilter(filter: ParsedFilter): string {
  const labelByValue = new Map(
    filter.definition.options.map((option) => [option.value, option.label]),
  );

  switch (filter.kind) {
    case 'options':
      return filter.values.map((value) => labelByValue.get(value) ?? value).join(', ');
    case 'range': {
      const unit = filter.definition.unit ? ` ${filter.definition.unit}` : '';
      if (filter.min !== null && filter.max !== null) {
        return `${filter.min}–${filter.max}${unit}`;
      }
      if (filter.min !== null) return `${filter.min}+${unit}`;
      return `Up to ${filter.max}${unit}`;
    }
    case 'boolean':
      return filter.value ? 'Yes' : 'No';
    case 'text':
      return filter.value;
    case 'dateRange': {
      const format = (date: Date) => date.toISOString().slice(0, 10);
      if (filter.from && filter.to) return `${format(filter.from)} to ${format(filter.to)}`;
      if (filter.from) return `From ${format(filter.from)}`;
      return `Until ${format(filter.to!)}`;
    }
    default:
      return '';
  }
}

/**
 * Public listing search.
 *
 * Responsibilities, in order: resolve the category/location/event-type context,
 * validate the category-specific filter values against the *declared* filter
 * definitions, build one `where` clause, and execute the count and page query
 * together. The UI never receives the whole dataset — filtering and pagination
 * happen in PostgreSQL.
 */
export async function searchPublicListings(request: SearchRequest): Promise<ListingSearchResult> {
  const { query, rawParams, basePath } = request;
  const attributeFilterParams = extractAttributeFilterParams(rawParams);
  const hasAttributeFilters = Object.keys(attributeFilterParams).length > 0;

  // Attribute filters are category-scoped: their meaning depends on the
  // category's declared definitions, so there is nothing to validate against
  // without one. Rejecting is better than silently ignoring them.
  if (hasAttributeFilters && !query.category) {
    throw new ValidationError(
      'Category-specific filters need a category. Choose a category or remove those filters.',
      { filters: Object.keys(attributeFilterParams) },
    );
  }

  let categoryIds: string[] | undefined;
  let filterDefinitions: FilterDefinition[] = [];
  let categoryContext: ListingSearchResult['context']['category'] = null;

  if (query.category) {
    const detail = await getCategoryDetail(query.category);
    categoryContext = {
      slug: detail.category.slug,
      name: detail.category.name,
      path: detail.category.path,
    };
    categoryIds = await resolveCategorySubtreeIds(detail.category.id);
    filterDefinitions = detail.filterDefinitions;
  }

  const parsedFilters = hasAttributeFilters
    ? await resolveMultiSelectOptionIds(parseFilterValues(attributeFilterParams, filterDefinitions))
    : [];

  const locationIds = query.location ? await resolveLocationSubtreeIds(query.location) : undefined;
  const eventTypeIds = query.eventType ? await resolveEventTypeIds(query.eventType) : undefined;

  // Include descendants of the category so a top-level category page shows
  // listings from every subcategory beneath it.
  const cardAttributeIds = categoryIds ? await getCardAttributeIdsForCategoryIds(categoryIds) : [];

  const criteria: ListingSearchCriteria = {
    categoryIds,
    locationIds,
    eventTypeIds,
    amenityCodes: query.amenity,
    q: query.q ?? null,
    verifiedOnly: query.verified ?? false,
    featuredOnly: query.featured ?? false,
    priceMin: query.priceMin ?? null,
    priceMax: query.priceMax ?? null,
    capacityMin: query.capacityMin ?? null,
    capacityMax: query.capacityMax ?? null,
    filters: parsedFilters,
  };

  const where = buildListingWhere(criteria);
  const orderBy = buildListingOrderBy(query.sort as ListingSort);

  const { cards, totalItems } = await searchListingCards({
    where,
    orderBy,
    page: query.page,
    pageSize: query.pageSize,
    cardAttributeIds,
  });

  const pagination = buildPaginated(cards, totalItems, query.page, query.pageSize).pagination;

  return {
    cards,
    pagination,
    appliedFilters: buildAppliedFilters({ query, parsedFilters, rawParams, basePath }),
    activeFilterCount: countActiveFilters(query, parsedFilters),
    context: {
      category: categoryContext,
      location: query.location ? await describeLocation(query.location) : null,
      query: query.q ?? null,
      sort: query.sort,
      verifiedOnly: query.verified ?? false,
    },
  };
}

async function describeLocation(slug: string) {
  const location = await prisma.location.findUnique({
    where: { slug },
    select: { slug: true, name: true, type: true },
  });
  return location ? { slug: location.slug, name: location.name, type: location.type } : null;
}
/**
 * Builds the removable chip data.
 *
 * Each chip carries the query string that results from removing exactly that
 * one filter, so the UI never has to reconstruct filter state and cannot
 * accidentally drop a neighbouring filter.
 */
function buildAppliedFilters(input: {
  query: SearchQuery;
  parsedFilters: ParsedFilter[];
  rawParams: Record<string, string | string[] | undefined>;
  basePath: string;
}): SearchAppliedFilter[] {
  const { query, parsedFilters, rawParams, basePath } = input;
  const chips: SearchAppliedFilter[] = [];

  const link = (params: Record<string, string | string[] | undefined>) => {
    const qs = toQueryString(withPageReset(params));
    return qs ? `${basePath}?${qs}` : basePath;
  };

  if (query.q) {
    const next = { ...rawParams };
    delete next.q;
    chips.push({
      code: 'q',
      label: 'Search',
      displayValue: query.q,
      removeHref: link(next),
    });
  }

  if (query.location) {
    const next = { ...rawParams };
    delete next.location;
    chips.push({
      code: 'location',
      label: 'Location',
      displayValue: query.location,
      removeHref: link(next),
    });
  }

  for (const slug of query.eventType ?? []) {
    const next = { ...rawParams };
    const remaining = (query.eventType ?? []).filter((item) => item !== slug);
    if (remaining.length > 0) next.eventType = remaining.join(',');
    else delete next.eventType;
    chips.push({
      code: `eventType:${slug}`,
      label: 'Event type',
      displayValue: slug,
      removeHref: link(next),
    });
  }

  if (query.verified) {
    const next = { ...rawParams };
    delete next.verified;
    chips.push({
      code: 'verified',
      label: 'Verified only',
      displayValue: 'Yes',
      removeHref: link(next),
    });
  }

  // `featured` narrows the result set like any other filter, so it must be
  // visible as a chip and counted. Without this the user saw a subset with no
  // indication of what was constraining it and no way to remove the constraint.
  if (query.featured) {
    const next = { ...rawParams };
    delete next.featured;
    chips.push({
      code: 'featured',
      label: 'Featured only',
      displayValue: 'Yes',
      removeHref: link(next),
    });
  }

  if (query.priceMin != null || query.priceMax != null) {
    const next = { ...rawParams };
    delete next.priceMin;
    delete next.priceMax;
    const from = query.priceMin != null ? `₹${query.priceMin}` : null;
    const to = query.priceMax != null ? `₹${query.priceMax}` : null;
    chips.push({
      code: 'price',
      label: 'Budget',
      displayValue: from && to ? `${from} – ${to}` : from ? `${from}+` : `Up to ${to}`,
      removeHref: link(next),
    });
  }

  if (query.capacityMin != null || query.capacityMax != null) {
    const next = { ...rawParams };
    delete next.capacityMin;
    delete next.capacityMax;
    const from = query.capacityMin != null ? `${query.capacityMin}` : null;
    const to = query.capacityMax != null ? `${query.capacityMax}` : null;
    chips.push({
      code: 'capacity',
      label: 'Guests',
      displayValue: from && to ? `${from}–${to}` : from ? `${from}+` : `Up to ${to}`,
      removeHref: link(next),
    });
  }

  for (const slug of query.amenity ?? []) {
    const next = { ...rawParams };
    const remaining = (query.amenity ?? []).filter((item) => item !== slug);
    if (remaining.length > 0) next.amenity = remaining.join(',');
    else delete next.amenity;
    chips.push({
      code: `amenity:${slug}`,
      label: 'Amenity',
      displayValue: slug,
      removeHref: link(next),
    });
  }

  for (const filter of parsedFilters) {
    const next = { ...rawParams };
    delete next[`${ATTRIBUTE_FILTER_PREFIX}${filter.definition.code}`];
    chips.push({
      code: filter.definition.code,
      label: filter.definition.label,
      displayValue: describeFilter(filter),
      removeHref: link(next),
    });
  }

  return chips;
}

export function countActiveFilters(query: SearchQuery, parsedFilters: ParsedFilter[]): number {
  let count = parsedFilters.length;
  if (query.q) count += 1;
  if (query.location) count += 1;
  if (query.verified) count += 1;
  if (query.featured) count += 1;
  if (query.priceMin != null || query.priceMax != null) count += 1;
  if (query.capacityMin != null || query.capacityMax != null) count += 1;
  count += query.eventType?.length ?? 0;
  count += query.amenity?.length ?? 0;
  return count;
}

/**
 * Facet options for the search sidebar: which categories, locations and event
 * types can be browsed. Deliberately does NOT return per-option result counts —
 * accurate counts require re-running the query once per facet value, which is
 * out of scope for the MVP and is documented as a next step.
 */
export async function getSearchFacets(): Promise<SearchFacetGroups> {
  const [categories, locations, eventTypes] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, path: true },
    }),
    prisma.location.findMany({
      where: { isActive: true, type: { in: ['CITY', 'LOCALITY'] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, type: true },
    }),
    prisma.eventType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true },
    }),
  ]);

  const counts = await prisma.listingCategory.groupBy({
    by: ['categoryId'],
    where: { listing: { publicationStatus: 'PUBLISHED', archivedAt: null } },
    _count: { _all: true },
  });
  const countByCategoryId = new Map(counts.map((row) => [row.categoryId, row._count._all]));

  const withIds = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, path: true },
  });

  const totalFor = (path: string): number => {
    let total = 0;
    for (const category of withIds) {
      if (category.path === path || category.path.startsWith(`${path}/`)) {
        total += countByCategoryId.get(category.id) ?? 0;
      }
    }
    return total;
  };

  return {
    categories: categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      listingCount: totalFor(category.path),
    })),
    locations,
    eventTypes,
  };
}
