import 'server-only';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { deriveFilterControl, type FilterDefinition } from '@/server/domain/search-filters';

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  path: string;
  parentId: string | null;
  shortDescription: string | null;
  iconKey: string | null;
  heroImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  listingCount: number;
  children: CategoryNode[];
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  path: string;
  parentId: string | null;
  shortDescription: string | null;
  iconKey: string | null;
  heroImageUrl: string | null;
  sortOrder: number;
  listingCount: number;
}

/**
 * Ids of a category plus every descendant.
 *
 * Uses the materialised `path` prefix rather than a recursive query: the column
 * is uniquely indexed, so this is a single indexed range scan regardless of how
 * deep the tree becomes.
 */
export async function resolveCategorySubtreeIds(slugOrId: string): Promise<string[]> {
  const category = await prisma.category.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    select: { id: true, path: true },
  });
  if (!category) throw new NotFoundError('Category');

  const descendants = await prisma.category.findMany({
    where: { path: { startsWith: `${category.path}/` }, isActive: true },
    select: { id: true },
  });

  return [category.id, ...descendants.map((row) => row.id)];
}

export async function resolveCategoryOrThrow(slugOrId: string) {
  const category = await prisma.category.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
  });
  if (!category) throw new NotFoundError('Category');
  return category;
}

/** Ancestor ids (excluding the category itself) derived from the path. */
export async function getCategoryAncestorIds(category: {
  id: string;
  path: string;
}): Promise<string[]> {
  const segments = category.path.split('/').filter(Boolean);
  if (segments.length <= 1) return [];

  const ancestorPaths = segments
    .slice(0, -1)
    .map((_, index) => segments.slice(0, index + 1).join('/'));

  const ancestors = await prisma.category.findMany({
    where: { path: { in: ancestorPaths } },
    select: { id: true, path: true },
  });

  // Returned shallowest-first. Callers use the index as a specificity rank
  // ("apply the most specific binding last"), so the order must be guaranteed
  // rather than left to the database's row order.
  return ancestors
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length)
    .map((row) => row.id);
}

/**
 * The filter set a category actually offers.
 *
 * Attributes bound to an ancestor category are inherited by its subcategories,
 * so an administrator can define capacity once on *Venues* and have
 * *Banquet halls*, *Hotels and resorts* and *Lawns* all offer it. A binding on
 * the more specific category overrides the inherited one for the same
 * attribute, which is how the same attribute can be filterable for one
 * subcategory and hidden for another.
 */
export async function getFilterDefinitionsForCategory(
  slugOrId: string,
): Promise<FilterDefinition[]> {
  const category = await resolveCategoryOrThrow(slugOrId);
  const ancestorIds = await getCategoryAncestorIds(category);
  const categoryIds = [...ancestorIds, category.id];

  const bindings = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: categoryIds }, isFilterable: true },
    include: {
      attribute: {
        include: { options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { attribute: { sortOrder: 'asc' } }],
  });

  // Specificity must be decided by ancestry depth, not by `sortOrder`.
  // Ordering the query by sortOrder and letting the last write win looks
  // equivalent but is not: a parent binding with a higher sortOrder than its
  // child's would overwrite the child, so the *less* specific configuration
  // would win. Rank each binding by how deep its category sits in the chain and
  // apply the most specific last.
  const specificity = new Map<string, number>();
  ancestorIds.forEach((id, index) => specificity.set(id, index));
  specificity.set(category.id, ancestorIds.length);

  const mostSpecificLast = [...bindings].sort((a, b) => {
    const byRank = (specificity.get(a.categoryId) ?? 0) - (specificity.get(b.categoryId) ?? 0);
    if (byRank !== 0) return byRank;
    return a.sortOrder - b.sortOrder;
  });

  const byCode = new Map<string, FilterDefinition>();

  for (const binding of mostSpecificLast) {
    const { attribute } = binding;
    // A binding on a more specific category overwrites the inherited one for
    // the same attribute code — that is how one attribute can be filterable for
    // a subcategory and hidden for its sibling.
    byCode.set(attribute.code, {
      id: attribute.id,
      code: attribute.code,
      label: attribute.label,
      dataType: attribute.dataType,
      control: deriveFilterControl(attribute.dataType, binding.filterControl),
      unit: attribute.unit,
      helpText: attribute.helpText,
      groupLabel: binding.groupLabel,
      options: attribute.options.map((option) => ({
        value: option.value,
        label: option.label,
        sortOrder: option.sortOrder,
      })),
      bounds:
        attribute.minNumber !== null || attribute.maxNumber !== null
          ? {
              min: attribute.minNumber ?? 0,
              max: attribute.maxNumber ?? 1_000_000_000,
            }
          : null,
      sortOrder: binding.sortOrder,
    });
  }

  return [...byCode.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
}

/** Category directory, optionally as a nested tree for the homepage/directory. */
export async function listCategories(options: { includeInactive?: boolean } = {}) {
  const where = options.includeInactive ? {} : { isActive: true };

  const categories = await prisma.category.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      path: true,
      parentId: true,
      shortDescription: true,
      iconKey: true,
      heroImageUrl: true,
      isActive: true,
      sortOrder: true,
    },
  });

  const counts = await prisma.listingCategory.groupBy({
    by: ['categoryId'],
    where: { listing: { publicationStatus: 'PUBLISHED', archivedAt: null } },
    _count: { _all: true },
  });
  const countByCategory = new Map(counts.map((row) => [row.categoryId, row._count._all]));

  // A published listing in a subcategory must also make its parent look
  // populated, otherwise the top-level directory reads as empty.
  const directCount = new Map<string, number>();
  for (const category of categories) {
    directCount.set(category.id, countByCategory.get(category.id) ?? 0);
  }

  const totalByCategory = new Map<string, number>();
  for (const category of categories) {
    let total = directCount.get(category.id) ?? 0;
    const prefix = `${category.path}/`;
    for (const other of categories) {
      if (other.path.startsWith(prefix)) total += directCount.get(other.id) ?? 0;
    }
    totalByCategory.set(category.id, total);
  }

  const byId = new Map<string, CategoryNode>();
  for (const category of categories) {
    byId.set(category.id, {
      ...category,
      listingCount: totalByCategory.get(category.id) ?? 0,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
}

export async function getCategoryDetail(slug: string) {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category || !category.isActive) throw new NotFoundError('Category');

  const [parent, childrenIds, filterDefinitions] = await Promise.all([
    category.parentId
      ? prisma.category.findUnique({
          where: { id: category.parentId },
          select: { slug: true, name: true },
        })
      : Promise.resolve(null),
    resolveCategorySubtreeIds(category.id),
    getFilterDefinitionsForCategory(category.id),
  ]);

  const children = await prisma.category.findMany({
    where: { parentId: category.id, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, shortDescription: true, iconKey: true },
  });

  const listingCount = await prisma.businessListing.count({
    where: {
      publicationStatus: 'PUBLISHED',
      archivedAt: null,
      categories: { some: { categoryId: { in: childrenIds } } },
    },
  });

  return { category, parent, children, listingCount, filterDefinitions };
}

export async function listEventTypes() {
  return prisma.eventType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, iconKey: true },
  });
}

export async function listAmenities() {
  return prisma.amenity.findMany({
    where: { isActive: true },
    orderBy: [{ groupLabel: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, code: true, label: true, groupLabel: true, iconKey: true },
  });
}

export interface LocationListOptions {
  type?: 'COUNTRY' | 'STATE' | 'CITY' | 'LOCALITY';
  parentId?: string;
  q?: string;
  activeOnly?: boolean;
}

export async function listLocations(options: LocationListOptions = {}) {
  const activeOnly = options.activeOnly ?? true;

  return prisma.location.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.parentId ? { parentId: options.parentId } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      path: true,
      parentId: true,
      latitude: true,
      longitude: true,
      heroImageUrl: true,
      description: true,
    },
  });
}

/** Ids of a location plus every descendant (a city includes its localities). */
export async function resolveLocationSubtreeIds(slugOrId: string): Promise<string[]> {
  const location = await prisma.location.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
    select: { id: true, path: true },
  });
  if (!location) throw new NotFoundError('Location');

  const descendants = await prisma.location.findMany({
    where: { path: { startsWith: `${location.path}/` }, isActive: true },
    select: { id: true },
  });

  return [location.id, ...descendants.map((row) => row.id)];
}

export async function resolveLocationOrThrow(slugOrId: string) {
  const location = await prisma.location.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
  });
  if (!location) throw new NotFoundError('Location');
  return location;
}

export async function resolveEventTypeIds(slugs: readonly string[]): Promise<string[]> {
  if (slugs.length === 0) return [];

  const rows = await prisma.eventType.findMany({
    where: { slug: { in: [...slugs] }, isActive: true },
    select: { id: true, slug: true },
  });

  const foundSlugs = new Set(rows.map((row) => row.slug));
  const missing = slugs.filter((slug) => !foundSlugs.has(slug));
  if (missing.length > 0) {
    throw new NotFoundError('Event type', `Unknown event type: ${missing.join(', ')}`);
  }

  return rows.map((row) => row.id);
}

/**
 * The published catalogue's price and capacity envelope.
 *
 * The filter rail shows these as the opening values of the two range inputs, so
 * a visitor sees the plausible span ("₹0 to ₹18,00,000") instead of two empty
 * boxes with no hint of the scale. They are display defaults only: a value equal
 * to the envelope writes no query parameter, so "the whole range" still means
 * "no filter" and an unpublished price is not silently excluded.
 */
export interface CatalogBounds {
  priceMin: number | null;
  priceMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
}

export async function getCatalogBounds(): Promise<CatalogBounds> {
  const where = { publicationStatus: 'PUBLISHED' as const, archivedAt: null };

  const [price, capacity] = await Promise.all([
    prisma.businessListing.aggregate({
      where,
      _min: { priceMin: true },
      _max: { priceMax: true },
    }),
    prisma.businessListing.aggregate({
      where,
      _min: { capacityMin: true },
      _max: { capacityMax: true },
    }),
  ]);

  return {
    priceMin: price._min.priceMin,
    priceMax: price._max.priceMax,
    capacityMin: capacity._min.capacityMin,
    capacityMax: capacity._max.capacityMax,
  };
}
