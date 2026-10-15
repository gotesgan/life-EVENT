import type { Prisma } from '@/generated/prisma/client';
import { ValidationError } from '@/lib/errors';
import type { FilterControl, AttributeDataType } from '@/generated/prisma/enums';
import type { ListingSort } from '@/lib/validation/search';

export type AttributeDataTypeValue = (typeof AttributeDataType)[keyof typeof AttributeDataType];
export type FilterControlValue = (typeof FilterControl)[keyof typeof FilterControl];

/**
 * A filter as the frontend needs to render it. Produced from the database by
 * `CategoryService.getFilterDefinitions()` and returned by the public filter
 * metadata endpoint, so a new category or filter is an admin data operation and
 * never a frontend change.
 */
export interface FilterOptionDefinition {
  value: string;
  label: string;
  sortOrder: number;
}

export interface FilterDefinition {
  /** `AttributeDefinition.id` — used to build the query. */
  id: string;
  /** `AttributeDefinition.code` — the key used in `f.<code>` query params. */
  code: string;
  label: string;
  dataType: AttributeDataTypeValue;
  control: FilterControlValue;
  unit: string | null;
  helpText: string | null;
  groupLabel: string | null;
  options: FilterOptionDefinition[];
  bounds: { min: number; max: number } | null;
  sortOrder: number;
}

export type ParsedFilter =
  | {
      kind: 'options';
      definition: FilterDefinition;
      /** Option *values* exactly as they appear in the URL (e.g. `candid`). */
      values: string[];
      /**
       * Option *ids* resolved from `values`, required for multi-select
       * attributes.
       *
       * Multi-select values are stored in `ListingAttributeValue.optionIds`,
       * which holds option ids because that is what the relation and the GIN
       * index operate on, while the URL carries readable option values. The
       * search service resolves one to the other before the query is built.
       * Comparing option values against an id array would silently match
       * nothing, which is the defect this field exists to prevent.
       */
      optionIds?: string[];
    }
  | { kind: 'range'; definition: FilterDefinition; min: number | null; max: number | null }
  | { kind: 'boolean'; definition: FilterDefinition; value: boolean }
  | { kind: 'text'; definition: FilterDefinition; value: string }
  | { kind: 'dateRange'; definition: FilterDefinition; from: Date | null; to: Date | null };

/** Control derived from the data type unless an administrator overrode it. */
export function deriveFilterControl(
  dataType: AttributeDataTypeValue,
  override: FilterControlValue | null,
): FilterControlValue {
  if (override) return override;

  switch (dataType) {
    case 'NUMBER':
      return 'RANGE';
    case 'BOOLEAN':
      return 'BOOLEAN';
    case 'DATE':
      return 'DATE';
    case 'SINGLE_SELECT':
      return 'RADIO';
    case 'MULTI_SELECT':
      return 'CHECKBOX';
    case 'TEXT':
    default:
      return 'TEXT';
  }
}

const TRUE_TOKENS = new Set(['true', '1', 'yes']);
const FALSE_TOKENS = new Set(['false', '0', 'no']);

/**
 * Parses and validates one raw filter value against its definition.
 *
 * Two-stage validation is deliberate: the URL schema can only check that the
 * parameter is a well-formed string, because what it *means* depends on the
 * active category's filter definitions. Anything unknown or ill-typed is
 * rejected with a 400 rather than silently ignored, so a stale shared link
 * tells the user what is wrong instead of quietly showing wrong results.
 */
export function parseFilterValue(
  definition: FilterDefinition,
  rawValues: readonly string[],
): ParsedFilter | null {
  const joined = rawValues.join(',').trim();
  if (!joined) return null;

  switch (definition.dataType) {
    case 'SINGLE_SELECT':
    case 'MULTI_SELECT': {
      const values = Array.from(
        new Set(
          rawValues
            .flatMap((v) => v.split(','))
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      );

      if (values.length === 0) return null;

      if (values.length > 20) {
        throw new ValidationError(`Too many values for filter "${definition.label}"`, {
          filter: definition.code,
          maxValues: 20,
        });
      }

      if (definition.dataType === 'SINGLE_SELECT' && values.length > 1) {
        throw new ValidationError(`Filter "${definition.label}" accepts a single value`, {
          filter: definition.code,
          received: values,
        });
      }

      const allowed = new Set(definition.options.map((option) => option.value));
      const unknown = values.filter((value) => !allowed.has(value));
      if (unknown.length > 0) {
        throw new ValidationError(`Unknown value for filter "${definition.label}"`, {
          filter: definition.code,
          unknown,
          allowed: definition.options.map((option) => option.value),
        });
      }

      return { kind: 'options', definition, values };
    }

    case 'NUMBER': {
      const range = parseNumericRange(joined, definition.label, definition.code);
      return { kind: 'range', definition, ...range };
    }

    case 'BOOLEAN': {
      const tokens = new Set(
        rawValues
          .flatMap((v) => v.split(','))
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean),
      );

      const wantsTrue = [...tokens].some((t) => TRUE_TOKENS.has(t));
      const wantsFalse = [...tokens].some((t) => FALSE_TOKENS.has(t));

      if (!wantsTrue && !wantsFalse) {
        throw new ValidationError(`Filter "${definition.label}" must be true or false`, {
          filter: definition.code,
          received: [...tokens],
        });
      }
      // Selecting both values means "no constraint", not "impossible".
      if (wantsTrue && wantsFalse) return null;

      return { kind: 'boolean', definition, value: wantsTrue };
    }

    case 'DATE': {
      const range = parseDateRange(joined, definition.label, definition.code);
      return { kind: 'dateRange', definition, ...range };
    }

    case 'TEXT': {
      const value = joined.slice(0, 80);
      if (value.length < 2) {
        throw new ValidationError(`Filter "${definition.label}" needs at least 2 characters`, {
          filter: definition.code,
        });
      }
      return { kind: 'text', definition, value };
    }

    default:
      return null;
  }
}

function parseNumericRange(
  raw: string,
  label: string,
  code: string,
): { min: number | null; max: number | null } {
  if (!raw.includes('-')) {
    const exact = Number(raw);
    if (!Number.isFinite(exact) || exact < 0) {
      throw new ValidationError(`Filter "${label}" must be a number`, { filter: code });
    }
    // A bare number means "this value or more" — the common intent for capacity
    // and budget ("500+ guests", "₹5,00,000+").
    return { min: exact, max: null };
  }

  const [rawMin, rawMax] = splitRange(raw);
  const min = rawMin === '' ? null : Number(rawMin);
  const max = rawMax === '' ? null : Number(rawMax);

  if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) {
    throw new ValidationError(`Filter "${label}" must be a numeric range`, {
      filter: code,
      received: raw,
      expected: 'min-max, e.g. 100-500, 100- or -500',
    });
  }
  if (min !== null && min < 0) {
    throw new ValidationError(`Filter "${label}" cannot be negative`, { filter: code });
  }
  if (min !== null && max !== null && min > max) {
    throw new ValidationError(`Filter "${label}" has a minimum above its maximum`, {
      filter: code,
      min,
      max,
    });
  }
  if (min === null && max === null) return { min: null, max: null };

  return { min, max };
}

function splitRange(raw: string): [string, string] {
  const index = raw.indexOf('-');
  if (index === -1) return [raw, ''];
  return [raw.slice(0, index).trim(), raw.slice(index + 1).trim()];
}

function parseDateRange(
  raw: string,
  label: string,
  code: string,
): { from: Date | null; to: Date | null } {
  const [rawFrom = '', rawTo = ''] = raw.includes('..') ? raw.split('..') : [raw, ''];

  const parse = (value: string, side: 'from' | 'to'): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError(`Filter "${label}" must be an ISO date range`, {
        filter: code,
        side,
        received: value,
        expected: 'YYYY-MM-DD..YYYY-MM-DD',
      });
    }
    return date;
  };

  const from = parse(rawFrom, 'from');
  const to = parse(rawTo, 'to');

  if (from && to && from > to) {
    throw new ValidationError(`Filter "${label}" starts after it ends`, { filter: code });
  }

  return { from, to };
}

export function parseFilterValues(
  rawByCode: Record<string, string[]>,
  definitions: readonly FilterDefinition[],
): ParsedFilter[] {
  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));

  const unknown = Object.keys(rawByCode).filter((code) => !byCode.has(code));
  if (unknown.length > 0) {
    throw new ValidationError('Unknown filter for this category', {
      unknown,
      allowed: definitions.map((definition) => definition.code),
    });
  }

  const parsed: ParsedFilter[] = [];
  for (const [code, values] of Object.entries(rawByCode)) {
    const definition = byCode.get(code)!;
    const result = parseFilterValue(definition, values);
    if (result) parsed.push(result);
  }

  return parsed;
}

export interface ListingSearchCriteria {
  /** Category ids, already expanded to include descendants by the caller. */
  categoryIds?: readonly string[];
  /** Location ids, already expanded to include descendants by the caller. */
  locationIds?: readonly string[];
  eventTypeIds?: readonly string[];
  amenityCodes?: readonly string[];
  q?: string | null;
  verifiedOnly?: boolean;
  featuredOnly?: boolean;
  /** Listing price range must overlap the requested budget. */
  priceMin?: number | null;
  priceMax?: number | null;
  /** Venue capacity range must overlap the requested guest count. */
  capacityMin?: number | null;
  capacityMax?: number | null;
  filters?: readonly ParsedFilter[];
}

/** Lowercased, whitespace-collapsed form used for both indexing and querying. */
export function normaliseSearchText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Builds the single `where` clause used by both the count and the page query.
 *
 * Sharing one builder is what guarantees the displayed result count can never
 * disagree with the rows returned.
 *
 * Pure by design: no database access, so the entire filter matrix is unit
 * testable without a server or a database.
 */
export function buildListingWhere(
  criteria: ListingSearchCriteria,
): Prisma.BusinessListingWhereInput {
  const and: Prisma.BusinessListingWhereInput[] = [
    // Public queries only ever see published, non-archived listings.
    { publicationStatus: 'PUBLISHED' },
    { archivedAt: null },
  ];

  const categoryIds = toIdList(criteria.categoryIds);
  if (categoryIds) {
    and.push({ categories: { some: { categoryId: { in: categoryIds } } } });
  }

  const locationIds = toIdList(criteria.locationIds);
  if (locationIds) {
    // Match the listing's own location *or* anywhere it says it serves. A
    // photographer based in Pune who covers Mumbai must appear in a Mumbai
    // search, otherwise city filtering is wrong for most service categories.
    and.push({
      OR: [
        { primaryLocationId: { in: locationIds } },
        { serviceAreas: { some: { locationId: { in: locationIds } } } },
      ],
    });
  }

  const eventTypeIds = toIdList(criteria.eventTypeIds);
  if (eventTypeIds) {
    and.push({ eventTypes: { some: { eventTypeId: { in: eventTypeIds } } } });
  }

  const amenityCodes = toIdList(criteria.amenityCodes);
  if (amenityCodes) {
    and.push({ amenities: { some: { amenity: { code: { in: amenityCodes } } } } });
  }

  if (criteria.verifiedOnly) {
    and.push({ verificationStatus: 'VERIFIED' });
  }

  if (criteria.featuredOnly) {
    and.push({ isFeatured: true });
  }

  const q = criteria.q ? normaliseSearchText(criteria.q) : '';
  if (q.length >= 2) {
    // `searchText` is stored lowercased and is covered by a trigram GIN index,
    // so this LIKE is index-accelerated rather than a sequential scan.
    and.push({ searchText: { contains: q } });
  }

  const priceClause = buildRangeOverlapClause(
    'priceMin',
    'priceMax',
    criteria.priceMin ?? null,
    criteria.priceMax ?? null,
  );
  if (priceClause) and.push(priceClause);

  const capacityClause = buildRangeOverlapClause(
    'capacityMin',
    'capacityMax',
    criteria.capacityMin ?? null,
    criteria.capacityMax ?? null,
  );
  if (capacityClause) and.push(capacityClause);

  for (const filter of criteria.filters ?? []) {
    const clause = buildAttributeClause(filter);
    if (clause) and.push(clause);
  }

  return and.length === 1 ? and[0] : { AND: and };
}

/**
 * Overlap test for a listing whose own range is `(minField, maxField)`.
 *
 * A listing with an unknown range is excluded while a range filter is active:
 * claiming an unpriced business "fits your ₹3L budget" would be a fabricated
 * claim, and including it silently would make the filter untrustworthy.
 */
function buildRangeOverlapClause(
  minField: 'priceMin' | 'capacityMin',
  maxField: 'priceMax' | 'capacityMax',
  requestedMin: number | null,
  requestedMax: number | null,
): Prisma.BusinessListingWhereInput | null {
  if (requestedMin === null && requestedMax === null) return null;

  const conditions: Prisma.BusinessListingWhereInput[] = [];

  if (requestedMax !== null) {
    // The listing's cheapest point must not exceed the customer's ceiling.
    conditions.push({
      OR: [
        { [minField]: { lte: requestedMax } },
        { [minField]: null, [maxField]: { lte: requestedMax } },
      ],
    } as Prisma.BusinessListingWhereInput);
  }

  if (requestedMin !== null) {
    // The listing's top point must reach the customer's floor.
    conditions.push({
      OR: [
        { [maxField]: { gte: requestedMin } },
        { [maxField]: null, [minField]: { gte: requestedMin } },
      ],
    } as Prisma.BusinessListingWhereInput);
  }

  return { AND: conditions };
}

function buildAttributeClause(filter: ParsedFilter): Prisma.BusinessListingWhereInput | null {
  const attributeId = filter.definition.id;

  switch (filter.kind) {
    case 'options':
      if (filter.definition.dataType === 'MULTI_SELECT') {
        // An unresolvable option set matches nothing rather than dropping the
        // constraint: silently ignoring it would show every listing.
        return {
          attributeValues: {
            some: { attributeId, optionIds: { hasSome: filter.optionIds ?? [] } },
          },
        };
      }
      return {
        attributeValues: {
          some: { attributeId, option: { value: { in: filter.values } } },
        },
      };

    case 'range': {
      if (filter.min === null && filter.max === null) return null;
      return {
        attributeValues: {
          some: {
            attributeId,
            valueNumber: {
              ...(filter.min === null ? {} : { gte: filter.min }),
              ...(filter.max === null ? {} : { lte: filter.max }),
            },
          },
        },
      };
    }

    case 'boolean':
      return { attributeValues: { some: { attributeId, valueBoolean: filter.value } } };

    case 'text':
      return {
        attributeValues: {
          some: { attributeId, valueText: { contains: filter.value.toLowerCase() } },
        },
      };

    case 'dateRange': {
      if (!filter.from && !filter.to) return null;
      return {
        attributeValues: {
          some: {
            attributeId,
            valueDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          },
        },
      };
    }

    default:
      return null;
  }
}

/**
 * Whitelisted sort. Every branch maps to a literal order-by clause; no user
 * string ever reaches the query. `id` is always the final tie-break so that
 * pagination cannot repeat or skip rows between pages.
 */
export function buildListingOrderBy(
  sort: ListingSort,
): Prisma.BusinessListingOrderByWithRelationInput[] {
  switch (sort) {
    case 'price_asc':
      return [{ priceMin: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case 'price_desc':
      return [{ priceMin: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    case 'newest':
      return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    case 'name_asc':
      return [{ name: 'asc' }, { id: 'asc' }];
    case 'recommended':
    default:
      return [
        { isFeatured: 'desc' },
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ];
  }
}

function toIdList(values?: readonly string[]): string[] | null {
  if (!values || values.length === 0) return null;
  const unique = Array.from(new Set(values.filter(Boolean)));
  return unique.length > 0 ? unique : null;
}

/** True when a parsed filter carries no constraint and can be dropped. */
export function hasActiveConstraint(filter: ParsedFilter): boolean {
  switch (filter.kind) {
    case 'options':
      return filter.values.length > 0;
    case 'range':
      return filter.min !== null || filter.max !== null;
    case 'text':
      return filter.value.length > 0;
    case 'dateRange':
      return Boolean(filter.from || filter.to);
    case 'boolean':
      return true;
    default:
      return false;
  }
}
