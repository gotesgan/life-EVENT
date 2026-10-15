import 'server-only';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/actor';

/**
 * Read-only catalogue projections for the admin screens.
 *
 * ## Why Prisma appears at all
 *
 * The brief is explicit that mutations must go through `/api/admin/catalog/**`
 * (they write audit rows) and that a missing route should be reported rather
 * than worked around. Those mutations do exactly that — every write in
 * `src/components/admin/catalogue/**` is an HTTP call to an existing route.
 *
 * Reads are a different problem. The public `catalog.service` projections are
 * built for the storefront: they hide inactive rows (`listEventTypes`,
 * `listAmenities`), omit `isActive`/`sortOrder` (`listLocations`), and expose
 * only *filterable* bindings (`getFilterDefinitionsForCategory`). None of them
 * can drive an editor, and the admin catalogue GET routes that do carry the
 * right projection are GET-only HTTP endpoints, which a Server Component cannot
 * call without an HTTP round-trip to itself.
 *
 * So this module is the single, read-only place where the back office reads the
 * catalogue directly. It uses explicit `select`s (never a raw row), calls
 * `requireAdmin()` on every entry point, and performs no writes — so it cannot
 * bypass an audited mutation. The routes it would rather use are listed in the
 * hand-off report; when they exist this module can be deleted.
 */

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  path: string;
  parentId: string | null;
  shortDescription: string | null;
  description: string | null;
  iconKey: string | null;
  heroImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AttributeOptionRow {
  id: string;
  attributeId: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AttributeRow {
  id: string;
  code: string;
  label: string;
  dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  unit: string | null;
  helpText: string | null;
  placeholder: string | null;
  minNumber: number | null;
  maxNumber: number | null;
  maxLength: number | null;
  isGlobal: boolean;
  sortOrder: number;
  options: AttributeOptionRow[];
}

export interface CategoryBindingRow {
  id: string;
  categoryId: string;
  attributeId: string;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isVisibleOnProfile: boolean;
  isComparable: boolean;
  showOnCard: boolean;
  filterControl: string | null;
  groupLabel: string | null;
  sortOrder: number;
  attributeCode: string;
  attributeLabel: string;
  attributeDataType: string;
}

export interface LocationRow {
  id: string;
  slug: string;
  name: string;
  type: 'COUNTRY' | 'STATE' | 'CITY' | 'LOCALITY';
  path: string;
  parentId: string | null;
  latitude: number | null;
  longitude: number | null;
  heroImageUrl: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface EventTypeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AmenityRow {
  id: string;
  code: string;
  label: string;
  groupLabel: string | null;
  iconKey: string | null;
  isActive: boolean;
  sortOrder: number;
}

const categorySelect = {
  id: true,
  slug: true,
  name: true,
  path: true,
  parentId: true,
  shortDescription: true,
  description: true,
  iconKey: true,
  heroImageUrl: true,
  metaTitle: true,
  metaDescription: true,
  isActive: true,
  sortOrder: true,
} as const;

const locationSelect = {
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
  isActive: true,
  sortOrder: true,
} as const;

export async function listCategoryRows(): Promise<CategoryRow[]> {
  await requireAdmin();
  return prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: categorySelect,
  });
}

export async function listAttributeRows(): Promise<AttributeRow[]> {
  await requireAdmin();
  const rows = await prisma.attributeDefinition.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      dataType: true,
      unit: true,
      helpText: true,
      placeholder: true,
      minNumber: true,
      maxNumber: true,
      maxLength: true,
      isGlobal: true,
      sortOrder: true,
      options: {
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        select: {
          id: true,
          attributeId: true,
          value: true,
          label: true,
          sortOrder: true,
          isActive: true,
        },
      },
    },
  });
  return rows as AttributeRow[];
}

/** `attributeId` → `optionId` → option `value`, used to prefill select fields. */
export async function attributeOptionValueIndex(): Promise<Map<string, Map<string, string>>> {
  await requireAdmin();
  const options = await prisma.attributeOption.findMany({
    select: { id: true, attributeId: true, value: true },
  });

  const index = new Map<string, Map<string, string>>();
  for (const option of options) {
    const forAttribute = index.get(option.attributeId) ?? new Map<string, string>();
    forAttribute.set(option.id, option.value);
    index.set(option.attributeId, forAttribute);
  }
  return index;
}

export async function listCategoryBindings(categoryId: string): Promise<CategoryBindingRow[]> {
  await requireAdmin();
  const rows = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: 'asc' }, { attribute: { label: 'asc' } }],
    select: {
      id: true,
      categoryId: true,
      attributeId: true,
      isRequired: true,
      isFilterable: true,
      isSearchable: true,
      isVisibleOnProfile: true,
      isComparable: true,
      showOnCard: true,
      filterControl: true,
      groupLabel: true,
      sortOrder: true,
      attribute: {
        select: { code: true, label: true, dataType: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    attributeId: row.attributeId,
    isRequired: row.isRequired,
    isFilterable: row.isFilterable,
    isSearchable: row.isSearchable,
    isVisibleOnProfile: row.isVisibleOnProfile,
    isComparable: row.isComparable,
    showOnCard: row.showOnCard,
    filterControl: row.filterControl,
    groupLabel: row.groupLabel,
    sortOrder: row.sortOrder,
    attributeCode: row.attribute.code,
    attributeLabel: row.attribute.label,
    attributeDataType: row.attribute.dataType,
  }));
}

export async function listLocationRows(): Promise<LocationRow[]> {
  await requireAdmin();
  return prisma.location.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: locationSelect,
  });
}

export async function listEventTypeRows(): Promise<EventTypeRow[]> {
  await requireAdmin();
  return prisma.eventType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      iconKey: true,
      isActive: true,
      sortOrder: true,
    },
  });
}

export async function listAmenityRows(): Promise<AmenityRow[]> {
  await requireAdmin();
  return prisma.amenity.findMany({
    orderBy: [{ groupLabel: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      code: true,
      label: true,
      groupLabel: true,
      iconKey: true,
      isActive: true,
      sortOrder: true,
    },
  });
}
