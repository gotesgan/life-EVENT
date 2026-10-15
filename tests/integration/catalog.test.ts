import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import {
  getFilterDefinitionsForCategory,
  listCategories,
  resolveCategorySubtreeIds,
  resolveLocationSubtreeIds,
} from '@/server/services/catalog.service';
import { requireCategoryId, requireLocationId, uniqueSlug } from './helpers';

async function createScratchCategory(
  parent: { id: string; path: string } | null,
  options: { isActive?: boolean } = {},
) {
  const slug = uniqueSlug('scratch-cat');
  return prisma.category.create({
    data: {
      slug,
      path: parent ? `${parent.path}/${slug}` : slug,
      name: `Scratch Category ${slug}`,
      parentId: parent?.id ?? null,
      isActive: options.isActive ?? true,
    },
    select: { id: true, slug: true, path: true },
  });
}

async function createScratchAttribute() {
  const code = uniqueSlug('scratch-attr');
  return prisma.attributeDefinition.create({
    data: { code, label: `Scratch Attribute ${code}`, dataType: 'TEXT' },
    select: { id: true, code: true },
  });
}

async function bindAttribute(input: {
  categoryId: string;
  attributeId: string;
  isFilterable: boolean;
  sortOrder?: number;
  filterControl?: 'RADIO' | 'CHECKBOX' | 'RANGE' | 'TEXT';
}) {
  return prisma.categoryAttribute.create({
    data: {
      categoryId: input.categoryId,
      attributeId: input.attributeId,
      isFilterable: input.isFilterable,
      sortOrder: input.sortOrder ?? 0,
      filterControl: input.filterControl ?? null,
    },
  });
}

describe('resolveCategorySubtreeIds', () => {
  it('returns the category plus every descendant', async () => {
    const [venues, banquetHalls, hotels, lawns, photography] = await Promise.all([
      requireCategoryId('venues'),
      requireCategoryId('banquet-halls'),
      requireCategoryId('hotels-and-resorts'),
      requireCategoryId('lawns-and-farmhouses'),
      requireCategoryId('photography'),
    ]);

    const ids = await resolveCategorySubtreeIds('venues');

    expect(ids).toContain(venues);
    expect(ids).toContain(banquetHalls);
    expect(ids).toContain(hotels);
    expect(ids).toContain(lawns);
    expect(ids).not.toContain(photography);
  });

  it('returns just the category when it has no descendants', async () => {
    const makeupArtists = await requireCategoryId('makeup-artists');
    const ids = await resolveCategorySubtreeIds('makeup-artists');

    expect(ids).toEqual([makeupArtists]);
  });

  it('throws NotFoundError for an unknown category', async () => {
    await expect(resolveCategorySubtreeIds('does-not-exist')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('includes a child created under the subtree', async () => {
    const parent = await createScratchCategory(null);
    const child = await createScratchCategory(parent);

    const ids = await resolveCategorySubtreeIds(parent.slug);

    expect(ids).toContain(parent.id);
    expect(ids).toContain(child.id);
  });
});

describe('getFilterDefinitionsForCategory', () => {
  it("returns a category's own filterable attributes", async () => {
    const definitions = await getFilterDefinitionsForCategory('photography');
    const codes = definitions.map((definition) => definition.code);

    expect(codes).toContain('photography_style');
    expect(codes).toContain('coverage_hours');
  });

  it('includes filterable attributes inherited from an ancestor category', async () => {
    const definitions = await getFilterDefinitionsForCategory('wedding-planners');
    const codes = definitions.map((definition) => definition.code);

    // planning-and-decor (the parent) binds decor_style; wedding-planners does not.
    expect(codes).toContain('decor_style');
    // ...and its own bindings are present too.
    expect(codes).toContain('planner_experience_years');
    expect(codes).toContain('planning_scope');

    const ownBinding = await prisma.categoryAttribute.findFirst({
      where: {
        category: { slug: 'wedding-planners' },
        attribute: { code: 'decor_style' },
      },
      select: { id: true },
    });
    expect(ownBinding).toBeNull();
  });

  it('excludes attributes that are not filterable', async () => {
    const category = await createScratchCategory(null);
    const filterable = await createScratchAttribute();
    const hidden = await createScratchAttribute();

    await bindAttribute({
      categoryId: category.id,
      attributeId: filterable.id,
      isFilterable: true,
    });
    await bindAttribute({ categoryId: category.id, attributeId: hidden.id, isFilterable: false });

    const codes = (await getFilterDefinitionsForCategory(category.slug)).map((d) => d.code);

    expect(codes).toContain(filterable.code);
    expect(codes).not.toContain(hidden.code);
  });

  it('lets the child binding override the inherited parent binding for the same attribute', async () => {
    const parent = await createScratchCategory(null);
    const child = await createScratchCategory(parent);
    const attribute = await createScratchAttribute();

    await bindAttribute({
      categoryId: parent.id,
      attributeId: attribute.id,
      isFilterable: true,
      sortOrder: 0,
      filterControl: 'RADIO',
    });
    await bindAttribute({
      categoryId: child.id,
      attributeId: attribute.id,
      isFilterable: true,
      sortOrder: 10,
      filterControl: 'CHECKBOX',
    });

    const definitions = await getFilterDefinitionsForCategory(child.slug);
    const matching = definitions.filter((definition) => definition.code === attribute.code);

    expect(matching).toHaveLength(1);
    expect(matching[0]?.control).toBe('CHECKBOX');
  });

  // Regression guard: the override must not depend on the *order rows come back
  // from the database*. Ranking by `CategoryAttribute.sortOrder` alone let a
  // parent binding with a higher sort order beat its child, contradicting the
  // promise that "a binding on the more specific category overrides the inherited
  // one". Inheritance is now ranked by ancestry depth, so a child binding wins
  // even when its
  // parent's must still win. It does not: the parent is processed last and
  // overwrites the child. See report.
  it('lets the child win even when the parent binding sorts later', async () => {
    const parent = await createScratchCategory(null);
    const child = await createScratchCategory(parent);
    const attribute = await createScratchAttribute();

    await bindAttribute({
      categoryId: parent.id,
      attributeId: attribute.id,
      isFilterable: true,
      sortOrder: 10,
      filterControl: 'RADIO',
    });
    await bindAttribute({
      categoryId: child.id,
      attributeId: attribute.id,
      isFilterable: true,
      sortOrder: 0,
      filterControl: 'CHECKBOX',
    });

    const definitions = await getFilterDefinitionsForCategory(child.slug);
    expect(definitions.find((d) => d.code === attribute.code)?.control).toBe('CHECKBOX');
  });

  it('throws NotFoundError for an unknown category', async () => {
    await expect(getFilterDefinitionsForCategory('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('listCategories', () => {
  it('returns a nested tree with children attached to their parent', async () => {
    const roots = await listCategories();
    const venues = roots.find((category) => category.slug === 'venues');

    expect(venues).toBeDefined();
    const childSlugs = venues?.children.map((child) => child.slug) ?? [];
    expect(childSlugs).toContain('banquet-halls');
    expect(childSlugs).toContain('hotels-and-resorts');
    expect(childSlugs).toContain('lawns-and-farmhouses');
    // A subcategory must not also appear as a root.
    expect(roots.map((root) => root.slug)).not.toContain('banquet-halls');
  });

  it('rolls a subcategory listing count up into its parent', async () => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, path: true, slug: true },
    });
    const counts = await prisma.listingCategory.groupBy({
      by: ['categoryId'],
      where: { listing: { publicationStatus: 'PUBLISHED', archivedAt: null } },
      _count: { _all: true },
    });
    const countByCategory = new Map(counts.map((row) => [row.categoryId, row._count._all]));

    const inSubtree = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
    const expected = categories
      .filter((category) => inSubtree(category.path, 'venues'))
      .reduce((sum, category) => sum + (countByCategory.get(category.id) ?? 0), 0);

    const roots = await listCategories();
    const venues = roots.find((category) => category.slug === 'venues');

    expect(expected).toBeGreaterThan(0);
    expect(venues?.listingCount).toBe(expected);
  });

  it('excludes inactive categories by default and includes them on request', async () => {
    const inactive = await createScratchCategory(null, { isActive: false });

    const activeOnly = await listCategories();
    const withInactive = await listCategories({ includeInactive: true });

    expect(activeOnly.map((category) => category.slug)).not.toContain(inactive.slug);
    expect(withInactive.map((category) => category.slug)).toContain(inactive.slug);
  });
});

describe('resolveLocationSubtreeIds', () => {
  it('returns a city plus its localities', async () => {
    const [mumbai, andheriEast, bandraWest, juhu, powai, pune] = await Promise.all([
      requireLocationId('mumbai'),
      requireLocationId('andheri-east'),
      requireLocationId('bandra-west'),
      requireLocationId('juhu'),
      requireLocationId('powai'),
      requireLocationId('pune'),
    ]);

    const ids = await resolveLocationSubtreeIds('mumbai');

    expect(ids).toContain(mumbai);
    expect(ids).toContain(andheriEast);
    expect(ids).toContain(bandraWest);
    expect(ids).toContain(juhu);
    expect(ids).toContain(powai);
    expect(ids).not.toContain(pune);
  });

  it('throws NotFoundError for an unknown location', async () => {
    await expect(resolveLocationSubtreeIds('atlantis')).rejects.toBeInstanceOf(NotFoundError);
  });
});
