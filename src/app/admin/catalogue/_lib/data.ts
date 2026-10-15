import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Reads for the catalogue screens.
 *
 * The catalogue has no write service — the API routes query Prisma directly —
 * so the admin pages read the same tables with their own explicit `select`s.
 * Every query names its columns: a raw row would leak `createdAt`/`updatedAt`
 * and, more importantly, would make the page depend on columns it does not
 * render.
 *
 * Nothing here writes. Mutations go through `/api/admin/catalog/**`, which is
 * where `requireAdmin` and the audit trail live.
 */

export interface CategoryAdminRow {
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

export async function getCategoryAdminRow(id: string): Promise<CategoryAdminRow | null> {
  return prisma.category.findUnique({
    where: { id },
    select: {
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
    },
  });
}

export interface CategoryBindingRow {
  id: string;
  categoryId: string;
  attributeId: string;
  attributeCode: string;
  attributeLabel: string;
  dataType: string;
  optionsCount: number;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isVisibleOnProfile: boolean;
  isComparable: boolean;
  /**
   * Read from the table because the PATCH/POST binding routes do not project or
   * accept it yet. Rendering it disabled is honest; hiding it would make the
   * editor look complete when it is not.
   */
  showOnCard: boolean | null;
  filterControl: string | null;
  groupLabel: string | null;
  sortOrder: number;
}

export async function listCategoryBindings(categoryId: string): Promise<CategoryBindingRow[]> {
  const rows = await prisma.categoryAttribute.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: 'asc' }, { attribute: { sortOrder: 'asc' } }],
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
        select: {
          code: true,
          label: true,
          dataType: true,
          _count: { select: { options: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    attributeId: row.attributeId,
    attributeCode: row.attribute.code,
    attributeLabel: row.attribute.label,
    dataType: row.attribute.dataType,
    optionsCount: row.attribute._count.options,
    isRequired: row.isRequired,
    isFilterable: row.isFilterable,
    isSearchable: row.isSearchable,
    isVisibleOnProfile: row.isVisibleOnProfile,
    isComparable: row.isComparable,
    showOnCard: row.showOnCard,
    filterControl: row.filterControl,
    groupLabel: row.groupLabel,
    sortOrder: row.sortOrder,
  }));
}

export interface AttributeAdminRow {
  id: string;
  code: string;
  label: string;
  dataType: string;
  unit: string | null;
  helpText: string | null;
  placeholder: string | null;
  minNumber: number | null;
  maxNumber: number | null;
  maxLength: number | null;
  isGlobal: boolean;
  sortOrder: number;
  bindingCount: number;
  options: Array<{
    id: string;
    value: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
  }>;
}

export async function listAttributeRows(): Promise<AttributeAdminRow[]> {
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
      _count: { select: { categoryBindings: true } },
      options: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          value: true,
          label: true,
          sortOrder: true,
          isActive: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    dataType: row.dataType,
    unit: row.unit,
    helpText: row.helpText,
    placeholder: row.placeholder,
    minNumber: row.minNumber,
    maxNumber: row.maxNumber,
    maxLength: row.maxLength,
    isGlobal: row.isGlobal,
    sortOrder: row.sortOrder,
    bindingCount: row._count.categoryBindings,
    options: row.options,
  }));
}

export interface LocationAdminRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  path: string;
  parentId: string | null;
  parentName: string | null;
  latitude: number | null;
  longitude: number | null;
  heroImageUrl: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export async function listLocationRows(): Promise<LocationAdminRow[]> {
  const rows = await prisma.location.findMany({
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
      isActive: true,
      sortOrder: true,
      parent: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    path: row.path,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
    heroImageUrl: row.heroImageUrl,
    description: row.description,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }));
}

export interface EventTypeAdminRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  isActive: boolean;
  sortOrder: number;
}

export async function listEventTypeRows(): Promise<EventTypeAdminRow[]> {
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

export interface AmenityAdminRow {
  id: string;
  code: string;
  label: string;
  groupLabel: string | null;
  iconKey: string | null;
  isActive: boolean;
  sortOrder: number;
}

export async function listAmenityRows(): Promise<AmenityAdminRow[]> {
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
