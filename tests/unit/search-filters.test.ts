import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/errors';
import {
  buildListingOrderBy,
  buildListingWhere,
  hasActiveConstraint,
  normaliseSearchText,
  parseFilterValue,
  parseFilterValues,
  type FilterDefinition,
  type ListingSearchCriteria,
  type ParsedFilter,
} from '@/server/domain/search-filters';
import { LISTING_SORT_OPTIONS, type ListingSort } from '@/lib/validation/search';

function definition(
  overrides: Partial<FilterDefinition> & Pick<FilterDefinition, 'dataType'>,
): FilterDefinition {
  return {
    id: 'attribute-1',
    code: 'attribute',
    label: 'Attribute',
    control: 'TEXT',
    unit: null,
    helpText: null,
    groupLabel: null,
    options: [],
    bounds: null,
    sortOrder: 0,
    ...overrides,
  };
}

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the callback to throw, but it returned normally');
}

const selectOptions = [
  { value: 'candid', label: 'Candid', sortOrder: 0 },
  { value: 'documentary', label: 'Documentary', sortOrder: 1 },
  { value: 'traditional', label: 'Traditional', sortOrder: 2 },
];

const SINGLE_SELECT = definition({
  dataType: 'SINGLE_SELECT',
  id: 'single-1',
  code: 'single',
  label: 'Single Select',
  options: selectOptions,
});
const MULTI_SELECT = definition({
  dataType: 'MULTI_SELECT',
  id: 'multi-1',
  code: 'multi',
  label: 'Multi Select',
  options: selectOptions,
});
const NUMBER = definition({ dataType: 'NUMBER', id: 'number-1', code: 'number', label: 'Number' });
const BOOLEAN = definition({
  dataType: 'BOOLEAN',
  id: 'boolean-1',
  code: 'boolean',
  label: 'Boolean',
});
const DATE = definition({ dataType: 'DATE', id: 'date-1', code: 'date', label: 'Date' });
const TEXT = definition({ dataType: 'TEXT', id: 'text-1', code: 'text', label: 'Text' });

describe('parseFilterValue: select filters', () => {
  it('accepts a known single value', () => {
    expect(parseFilterValue(SINGLE_SELECT, ['candid'])).toEqual({
      kind: 'options',
      definition: SINGLE_SELECT,
      values: ['candid'],
    });
  });

  it('splits comma-separated values, trims them and de-duplicates', () => {
    const parsed = parseFilterValue(MULTI_SELECT, ['candid,documentary', ' candid , candid ']);

    expect(parsed).toEqual({
      kind: 'options',
      definition: MULTI_SELECT,
      values: ['candid', 'documentary'],
    });
  });

  it('rejects an unknown option and lists every allowed value', () => {
    const error = captureError(() => parseFilterValue(MULTI_SELECT, ['candid', 'vhs']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({
      filter: 'multi',
      unknown: ['vhs'],
      allowed: ['candid', 'documentary', 'traditional'],
    });
  });

  it('rejects more than 20 values before it even validates them', () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => `value-${index}`);
    const wide = definition({
      dataType: 'MULTI_SELECT',
      code: 'wide',
      options: tooMany.map((value, index) => ({ value, label: value, sortOrder: index })),
    });
    const error = captureError(() => parseFilterValue(wide, tooMany));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({ filter: 'wide', maxValues: 20 });
  });

  it('accepts exactly 20 values', () => {
    const values = Array.from({ length: 20 }, (_, index) => `value-${index}`);
    const wide = definition({
      dataType: 'MULTI_SELECT',
      code: 'wide',
      options: values.map((value, index) => ({ value, label: value, sortOrder: index })),
    });

    expect(parseFilterValue(wide, values)).toMatchObject({ kind: 'options', values });
  });

  it('rejects a second value for a SINGLE_SELECT', () => {
    const error = captureError(() => parseFilterValue(SINGLE_SELECT, ['candid', 'documentary']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({
      filter: 'single',
      received: ['candid', 'documentary'],
    });
  });

  it('returns null for blank or separator-only input', () => {
    expect(parseFilterValue(MULTI_SELECT, [])).toBeNull();
    expect(parseFilterValue(MULTI_SELECT, ['   '])).toBeNull();
    expect(parseFilterValue(MULTI_SELECT, [',,'])).toBeNull();
  });
});

describe('parseFilterValue: numeric ranges', () => {
  it('treats a bare number as "this value or more"', () => {
    expect(parseFilterValue(NUMBER, ['500'])).toEqual({
      kind: 'range',
      definition: NUMBER,
      min: 500,
      max: null,
    });
  });

  it('parses a closed range', () => {
    expect(parseFilterValue(NUMBER, ['100-500'])).toEqual({
      kind: 'range',
      definition: NUMBER,
      min: 100,
      max: 500,
    });
  });

  it('parses an open-ended upper range', () => {
    expect(parseFilterValue(NUMBER, ['100-'])).toEqual({
      kind: 'range',
      definition: NUMBER,
      min: 100,
      max: null,
    });
  });

  it('parses an open-ended lower range', () => {
    expect(parseFilterValue(NUMBER, ['-500'])).toEqual({
      kind: 'range',
      definition: NUMBER,
      min: null,
      max: 500,
    });
  });

  it('accepts zero and an equal min/max', () => {
    expect(parseFilterValue(NUMBER, ['0'])).toMatchObject({ min: 0, max: null });
    expect(parseFilterValue(NUMBER, ['0-0'])).toMatchObject({ min: 0, max: 0 });
    expect(parseFilterValue(NUMBER, ['250-250'])).toMatchObject({ min: 250, max: 250 });
  });

  it('rejects a minimum above the maximum', () => {
    const error = captureError(() => parseFilterValue(NUMBER, ['500-100']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toMatchObject({
      filter: 'number',
      min: 500,
      max: 100,
    });
  });

  it('rejects a negative maximum that would invert the range', () => {
    expect(() => parseFilterValue(NUMBER, ['100--50'])).toThrow(ValidationError);
  });

  it('rejects non-numeric input on both the bare and the range path', () => {
    expect(() => parseFilterValue(NUMBER, ['abc'])).toThrow(ValidationError);
    expect(() => parseFilterValue(NUMBER, ['abc-def'])).toThrow(ValidationError);
    expect(() => parseFilterValue(NUMBER, ['100-abc'])).toThrow(ValidationError);
  });

  it('treats a bare dash as no constraint at all', () => {
    expect(parseFilterValue(NUMBER, ['-'])).toMatchObject({ min: null, max: null });
  });

  // Regression guard for a boundary that is easy to "fix" into a bug: `-` is the
  // range separator, so a leading dash is the open-ended "up to" form. Reading it
  // as a negative number would silently change what every such filter means.
  it('reads a leading dash as the open-ended "up to" form, not a negative number', () => {
    // `-` is the range separator, so `-500` means "up to 500". Every filterable
    // NUMBER attribute in this domain (capacity, budget, hours, guest count) is
    // non-negative, so the two readings cannot actually collide — this is the
    // documented encoding, and it is asserted here so it cannot drift silently.
    expect(parseFilterValue(NUMBER, ['-500'])).toEqual({
      kind: 'range',
      definition: NUMBER,
      min: null,
      max: 500,
    });
    // A negative *bound* is still rejected when it appears inside a range.
    expect(() => parseFilterValue(NUMBER, ['-500--100'])).toThrow(ValidationError);
  });
});

describe('parseFilterValue: boolean filters', () => {
  it('accepts every truthy token', () => {
    for (const token of ['true', '1', 'yes', 'TRUE', 'Yes']) {
      expect(parseFilterValue(BOOLEAN, [token])).toEqual({
        kind: 'boolean',
        definition: BOOLEAN,
        value: true,
      });
    }
  });

  it('accepts every falsy token', () => {
    for (const token of ['false', '0', 'no', 'FALSE', 'No']) {
      expect(parseFilterValue(BOOLEAN, [token])).toEqual({
        kind: 'boolean',
        definition: BOOLEAN,
        value: false,
      });
    }
  });

  it('treats selecting both values as no constraint rather than an impossibility', () => {
    expect(parseFilterValue(BOOLEAN, ['true', 'false'])).toBeNull();
    expect(parseFilterValue(BOOLEAN, ['yes,no'])).toBeNull();
    expect(parseFilterValue(BOOLEAN, ['1,0'])).toBeNull();
  });

  it('rejects an unrecognised token and reports what it received', () => {
    const error = captureError(() => parseFilterValue(BOOLEAN, ['maybe']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({
      filter: 'boolean',
      received: ['maybe'],
    });
  });

  it('returns null for blank input', () => {
    expect(parseFilterValue(BOOLEAN, [''])).toBeNull();
    expect(parseFilterValue(BOOLEAN, [])).toBeNull();
  });
});

describe('parseFilterValue: date ranges', () => {
  it('parses a closed ISO range', () => {
    const parsed = parseFilterValue(DATE, ['2026-01-01..2026-03-01']);

    expect(parsed).toEqual({
      kind: 'dateRange',
      definition: DATE,
      from: new Date('2026-01-01'),
      to: new Date('2026-03-01'),
    });
  });

  it('parses an open-ended range on the from side', () => {
    const parsed = parseFilterValue(DATE, ['2026-01-01..']);

    expect(parsed).toMatchObject({ kind: 'dateRange', from: new Date('2026-01-01'), to: null });
  });

  it('parses an open-ended range on the to side', () => {
    const parsed = parseFilterValue(DATE, ['..2026-03-01']);

    expect(parsed).toMatchObject({ kind: 'dateRange', from: null, to: new Date('2026-03-01') });
  });

  it('treats a bare date as a from bound', () => {
    expect(parseFilterValue(DATE, ['2026-01-01'])).toMatchObject({
      kind: 'dateRange',
      from: new Date('2026-01-01'),
      to: null,
    });
  });

  it('rejects a range that starts after it ends', () => {
    const error = captureError(() => parseFilterValue(DATE, ['2026-03-01..2026-01-01']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toMatchObject({ filter: 'date' });
  });

  it('rejects an unparseable date and says which side failed', () => {
    const fromError = captureError(() => parseFilterValue(DATE, ['banana..2026-01-01']));
    expect(fromError).toBeInstanceOf(ValidationError);
    expect((fromError as ValidationError).details).toMatchObject({ side: 'from' });

    const toError = captureError(() => parseFilterValue(DATE, ['2026-01-01..banana']));
    expect(toError).toBeInstanceOf(ValidationError);
    expect((toError as ValidationError).details).toMatchObject({ side: 'to' });
  });

  it('returns null for blank input', () => {
    expect(parseFilterValue(DATE, [''])).toBeNull();
  });
});

describe('parseFilterValue: text filters', () => {
  it('accepts a value of at least two characters', () => {
    expect(parseFilterValue(TEXT, ['garden'])).toEqual({
      kind: 'text',
      definition: TEXT,
      value: 'garden',
    });
  });

  it('rejects a value shorter than two characters', () => {
    const error = captureError(() => parseFilterValue(TEXT, ['a']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({ filter: 'text' });
  });

  it('truncates an over-long value to 80 characters instead of rejecting it', () => {
    const parsed = parseFilterValue(TEXT, ['x'.repeat(200)]);

    expect(parsed).toMatchObject({ kind: 'text' });
    if (parsed?.kind !== 'text') throw new Error('expected a text filter');
    expect(parsed.value).toHaveLength(80);
  });

  it('returns null for blank input', () => {
    expect(parseFilterValue(TEXT, ['   '])).toBeNull();
  });
});

describe('parseFilterValues', () => {
  it('rejects an unknown filter code and lists the allowed codes', () => {
    const error = captureError(() =>
      parseFilterValues({ colour: ['red'] }, [SINGLE_SELECT, NUMBER]),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual({
      unknown: ['colour'],
      allowed: ['single', 'number'],
    });
  });

  it('parses a valid set of filters', () => {
    const parsed = parseFilterValues({ single: ['candid'], number: ['100-500'] }, [
      SINGLE_SELECT,
      NUMBER,
    ]);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ kind: 'options', values: ['candid'] });
    expect(parsed[1]).toMatchObject({ kind: 'range', min: 100, max: 500 });
  });

  it('omits a known filter whose value carries no constraint', () => {
    expect(parseFilterValues({ single: ['   '] }, [SINGLE_SELECT])).toEqual([]);
    expect(parseFilterValues({ boolean: ['true,false'] }, [BOOLEAN])).toEqual([]);
  });

  it('returns an empty list for no raw filters', () => {
    expect(parseFilterValues({}, [SINGLE_SELECT])).toEqual([]);
  });
});

describe('buildListingWhere: the publication guarantee', () => {
  it('always restricts to published, non-archived listings even with no criteria', () => {
    expect(buildListingWhere({})).toEqual({
      AND: [{ publicationStatus: 'PUBLISHED' }, { archivedAt: null }],
    });
  });

  it('cannot be bypassed by any combination of criteria', () => {
    const criteria: ListingSearchCriteria = {
      categoryIds: ['c1'],
      locationIds: ['l1'],
      eventTypeIds: ['e1'],
      amenityCodes: ['parking'],
      q: 'garden venue',
      verifiedOnly: true,
      featuredOnly: true,
      priceMin: 100,
      priceMax: 1000,
      capacityMin: 50,
      capacityMax: 500,
      filters: [],
    };

    const where = buildListingWhere(criteria);
    const clauses = where.AND as unknown[];
    expect(clauses).toContainEqual({ publicationStatus: 'PUBLISHED' });
    expect(clauses).toContainEqual({ archivedAt: null });
  });
});

describe('buildListingWhere: core facets', () => {
  it('adds a category clause in the subtree', () => {
    expect(buildListingWhere({ categoryIds: ['c1', 'c2'] })).toEqual({
      AND: [
        { publicationStatus: 'PUBLISHED' },
        { archivedAt: null },
        { categories: { some: { categoryId: { in: ['c1', 'c2'] } } } },
      ],
    });
  });

  it('de-duplicates ids and ignores blanks', () => {
    const where = buildListingWhere({ categoryIds: ['c1', 'c1', '', 'c2'] });
    expect(where.AND).toContainEqual({
      categories: { some: { categoryId: { in: ['c1', 'c2'] } } },
    });
  });

  it('adds no category clause for an empty id list', () => {
    expect(buildListingWhere({ categoryIds: [] })).toEqual(buildListingWhere({}));
  });

  it('matches a location as either the primary location or a service area', () => {
    const where = buildListingWhere({ locationIds: ['l1', 'l2'] });

    expect(where).toEqual({
      AND: [
        { publicationStatus: 'PUBLISHED' },
        { archivedAt: null },
        {
          OR: [
            { primaryLocationId: { in: ['l1', 'l2'] } },
            { serviceAreas: { some: { locationId: { in: ['l1', 'l2'] } } } },
          ],
        },
      ],
    });
  });

  it('adds event type and amenity clauses', () => {
    const where = buildListingWhere({ eventTypeIds: ['e1'], amenityCodes: ['parking'] });

    expect(where.AND).toContainEqual({ eventTypes: { some: { eventTypeId: { in: ['e1'] } } } });
    expect(where.AND).toContainEqual({
      amenities: { some: { amenity: { code: { in: ['parking'] } } } },
    });
  });

  it('adds verification and feature clauses only when requested', () => {
    expect(buildListingWhere({ verifiedOnly: true }).AND).toContainEqual({
      verificationStatus: 'VERIFIED',
    });
    expect(buildListingWhere({ featuredOnly: true }).AND).toContainEqual({ isFeatured: true });
    expect(buildListingWhere({ verifiedOnly: false, featuredOnly: false })).toEqual(
      buildListingWhere({}),
    );
  });
});

describe('buildListingWhere: text search', () => {
  it('adds no clause when the query is shorter than two characters', () => {
    expect(buildListingWhere({ q: '' })).toEqual(buildListingWhere({}));
    expect(buildListingWhere({ q: 'a' })).toEqual(buildListingWhere({}));
    expect(buildListingWhere({ q: '   ' })).toEqual(buildListingWhere({}));
    expect(buildListingWhere({ q: null })).toEqual(buildListingWhere({}));
  });

  it('lowercases, collapses whitespace and trims the applied query', () => {
    const where = buildListingWhere({ q: '  Rooftop   GARDEN  ' });

    expect(where.AND).toContainEqual({ searchText: { contains: 'rooftop garden' } });
  });

  it('applies a two-character query', () => {
    expect(buildListingWhere({ q: 'DJ' }).AND).toContainEqual({
      searchText: { contains: 'dj' },
    });
  });
});

describe('buildListingWhere: price and capacity overlap', () => {
  const priceClause = (criteria: ListingSearchCriteria) => {
    const where = buildListingWhere(criteria);
    return (where.AND as unknown[])[2];
  };

  it('adds no clause when neither bound is set', () => {
    expect(buildListingWhere({ priceMin: null, priceMax: null })).toEqual(buildListingWhere({}));
  });

  it('applies a max-only ceiling and excludes listings whose cheapest point is unknown but top-heavy', () => {
    expect(priceClause({ priceMax: 1000 })).toEqual({
      AND: [
        {
          OR: [{ priceMin: { lte: 1000 } }, { priceMin: null, priceMax: { lte: 1000 } }],
        },
      ],
    });
  });

  it('applies a min-only floor', () => {
    expect(priceClause({ priceMin: 500 })).toEqual({
      AND: [
        {
          OR: [{ priceMax: { gte: 500 } }, { priceMax: null, priceMin: { gte: 500 } }],
        },
      ],
    });
  });

  it('applies both bounds as an intersection of two overlap conditions', () => {
    expect(priceClause({ priceMin: 500, priceMax: 1000 })).toEqual({
      AND: [
        {
          OR: [{ priceMin: { lte: 1000 } }, { priceMin: null, priceMax: { lte: 1000 } }],
        },
        {
          OR: [{ priceMax: { gte: 500 } }, { priceMax: null, priceMin: { gte: 500 } }],
        },
      ],
    });
  });

  it('builds the capacity clause against the capacity columns', () => {
    expect(priceClause({ capacityMax: 200 })).toEqual({
      AND: [
        {
          OR: [{ capacityMin: { lte: 200 } }, { capacityMin: null, capacityMax: { lte: 200 } }],
        },
      ],
    });
    expect(priceClause({ capacityMin: 100 })).toEqual({
      AND: [
        {
          OR: [{ capacityMax: { gte: 100 } }, { capacityMax: null, capacityMin: { gte: 100 } }],
        },
      ],
    });
  });

  it('keeps price and capacity as independent clauses', () => {
    const where = buildListingWhere({ priceMax: 1000, capacityMin: 50 });
    const clauses = where.AND as unknown[];

    expect(clauses).toContainEqual({
      AND: [
        {
          OR: [{ priceMin: { lte: 1000 } }, { priceMin: null, priceMax: { lte: 1000 } }],
        },
      ],
    });
    expect(clauses).toContainEqual({
      AND: [
        {
          OR: [{ capacityMax: { gte: 50 } }, { capacityMax: null, capacityMin: { gte: 50 } }],
        },
      ],
    });
  });
});

describe('buildListingWhere: typed attribute clauses', () => {
  const clauseFor = (filter: ParsedFilter) => {
    const where = buildListingWhere({ filters: [filter] });
    return (where.AND as unknown[])[2];
  };

  it('builds a MULTI_SELECT clause against resolved option ids', () => {
    // Multi-select values are stored in `optionIds`, which holds option *ids*,
    // while the URL carries option *values*. The search service resolves values
    // to ids before the query is built, so the clause must use those ids —
    // comparing the raw values would silently match nothing.
    expect(
      clauseFor({
        kind: 'options',
        definition: MULTI_SELECT,
        values: ['candid', 'documentary'],
        optionIds: ['opt-1', 'opt-2'],
      }),
    ).toEqual({
      attributeValues: {
        some: { attributeId: 'multi-1', optionIds: { hasSome: ['opt-1', 'opt-2'] } },
      },
    });
  });

  it('matches nothing when a MULTI_SELECT filter has no resolvable option id', () => {
    // Dropping the constraint instead would show every listing, which is worse
    // than showing none for a filter the user explicitly applied.
    expect(clauseFor({ kind: 'options', definition: MULTI_SELECT, values: ['candid'] })).toEqual({
      attributeValues: { some: { attributeId: 'multi-1', optionIds: { hasSome: [] } } },
    });
  });

  it('builds a SINGLE_SELECT clause against the joined option value', () => {
    expect(clauseFor({ kind: 'options', definition: SINGLE_SELECT, values: ['candid'] })).toEqual({
      attributeValues: { some: { attributeId: 'single-1', option: { value: { in: ['candid'] } } } },
    });
  });

  it('builds a numeric range clause with whichever bounds are present', () => {
    expect(clauseFor({ kind: 'range', definition: NUMBER, min: 100, max: 500 })).toEqual({
      attributeValues: { some: { attributeId: 'number-1', valueNumber: { gte: 100, lte: 500 } } },
    });
    expect(clauseFor({ kind: 'range', definition: NUMBER, min: 100, max: null })).toEqual({
      attributeValues: { some: { attributeId: 'number-1', valueNumber: { gte: 100 } } },
    });
    expect(clauseFor({ kind: 'range', definition: NUMBER, min: null, max: 500 })).toEqual({
      attributeValues: { some: { attributeId: 'number-1', valueNumber: { lte: 500 } } },
    });
  });

  it('drops a range clause that carries no constraint', () => {
    expect(
      buildListingWhere({ filters: [{ kind: 'range', definition: NUMBER, min: null, max: null }] }),
    ).toEqual(buildListingWhere({}));
  });

  it('builds a boolean clause against valueBoolean', () => {
    expect(clauseFor({ kind: 'boolean', definition: BOOLEAN, value: true })).toEqual({
      attributeValues: { some: { attributeId: 'boolean-1', valueBoolean: true } },
    });
    expect(clauseFor({ kind: 'boolean', definition: BOOLEAN, value: false })).toEqual({
      attributeValues: { some: { attributeId: 'boolean-1', valueBoolean: false } },
    });
  });

  it('builds a text clause with a lowercased contains', () => {
    expect(clauseFor({ kind: 'text', definition: TEXT, value: 'GaRdEn' })).toEqual({
      attributeValues: { some: { attributeId: 'text-1', valueText: { contains: 'garden' } } },
    });
  });

  it('builds a date clause with whichever bounds are present', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-03-01');

    expect(clauseFor({ kind: 'dateRange', definition: DATE, from, to })).toEqual({
      attributeValues: { some: { attributeId: 'date-1', valueDate: { gte: from, lte: to } } },
    });
    expect(clauseFor({ kind: 'dateRange', definition: DATE, from, to: null })).toEqual({
      attributeValues: { some: { attributeId: 'date-1', valueDate: { gte: from } } },
    });
    expect(clauseFor({ kind: 'dateRange', definition: DATE, from: null, to })).toEqual({
      attributeValues: { some: { attributeId: 'date-1', valueDate: { lte: to } } },
    });
  });

  it('drops a date clause that carries no constraint', () => {
    expect(
      buildListingWhere({
        filters: [{ kind: 'dateRange', definition: DATE, from: null, to: null }],
      }),
    ).toEqual(buildListingWhere({}));
  });
});

describe('purity of the filter domain functions', () => {
  const criteria: ListingSearchCriteria = {
    categoryIds: ['c1'],
    locationIds: ['l1'],
    q: 'Rooftop GARDEN',
    priceMin: 100,
    priceMax: 1000,
    filters: [
      { kind: 'options', definition: MULTI_SELECT, values: ['candid'] },
      { kind: 'range', definition: NUMBER, min: 10, max: 20 },
    ],
  };

  it('parseFilterValue returns an equal result on every call and does not mutate its input', () => {
    const rawValues = [' candid , documentary '];
    const frozen = [...rawValues];

    const first = parseFilterValue(MULTI_SELECT, rawValues);
    const second = parseFilterValue(MULTI_SELECT, rawValues);
    const third = parseFilterValue(MULTI_SELECT, rawValues);

    expect(first).toEqual(second);
    expect(second).toEqual(third);
    expect(rawValues).toEqual(frozen);
  });

  it('parseFilterValues is repeatable', () => {
    const raw = { multi: ['candid'], number: ['10-20'] };
    expect(parseFilterValues(raw, [MULTI_SELECT, NUMBER])).toEqual(
      parseFilterValues(raw, [MULTI_SELECT, NUMBER]),
    );
  });

  it('buildListingWhere is repeatable', () => {
    expect(buildListingWhere(criteria)).toEqual(buildListingWhere(criteria));
    expect(JSON.stringify(buildListingWhere(criteria))).toBe(
      JSON.stringify(buildListingWhere(criteria)),
    );
  });

  it('buildListingOrderBy is repeatable', () => {
    for (const sort of LISTING_SORT_OPTIONS) {
      expect(buildListingOrderBy(sort)).toEqual(buildListingOrderBy(sort));
    }
  });
});

describe('buildListingOrderBy', () => {
  it('sorts price ascending with nulls last and an id tie-break', () => {
    expect(buildListingOrderBy('price_asc')).toEqual([
      { priceMin: { sort: 'asc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });

  it('sorts price descending with nulls last and an id tie-break', () => {
    expect(buildListingOrderBy('price_desc')).toEqual([
      { priceMin: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });

  it('sorts newest first with an id tie-break', () => {
    expect(buildListingOrderBy('newest')).toEqual([
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });

  it('sorts by name with an id tie-break', () => {
    expect(buildListingOrderBy('name_asc')).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });

  it('orders recommended as featured, then publishedAt, then id', () => {
    expect(buildListingOrderBy('recommended')).toEqual([
      { isFeatured: 'desc' },
      { publishedAt: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ]);
  });

  it('ends every allowed sort with the deterministic id tie-break', () => {
    for (const sort of LISTING_SORT_OPTIONS) {
      const clauses = buildListingOrderBy(sort);
      expect(clauses.at(-1)).toEqual({ id: 'asc' });
    }
  });

  it('falls back to recommended for an unknown sort value', () => {
    const hostile = 'price_asc; DROP TABLE business_listings' as unknown as ListingSort;
    expect(buildListingOrderBy(hostile)).toEqual(buildListingOrderBy('recommended'));
  });

  it('never emits a user-supplied string into the clause', () => {
    const hostile = 'name; DELETE' as unknown as ListingSort;
    const serialised = JSON.stringify(buildListingOrderBy(hostile));
    expect(serialised).not.toContain('DELETE');
    expect(serialised).toBe(JSON.stringify(buildListingOrderBy('recommended')));
  });
});

describe('hasActiveConstraint', () => {
  it('is true when a filter narrows the result set', () => {
    expect(
      hasActiveConstraint({ kind: 'options', definition: MULTI_SELECT, values: ['candid'] }),
    ).toBe(true);
    expect(hasActiveConstraint({ kind: 'range', definition: NUMBER, min: 1, max: null })).toBe(
      true,
    );
    expect(hasActiveConstraint({ kind: 'range', definition: NUMBER, min: null, max: 1 })).toBe(
      true,
    );
    expect(hasActiveConstraint({ kind: 'boolean', definition: BOOLEAN, value: false })).toBe(true);
    expect(hasActiveConstraint({ kind: 'text', definition: TEXT, value: 'garden' })).toBe(true);
    expect(
      hasActiveConstraint({ kind: 'dateRange', definition: DATE, from: new Date(), to: null }),
    ).toBe(true);
  });

  it('is false for a filter with no constraint', () => {
    expect(hasActiveConstraint({ kind: 'options', definition: MULTI_SELECT, values: [] })).toBe(
      false,
    );
    expect(hasActiveConstraint({ kind: 'range', definition: NUMBER, min: null, max: null })).toBe(
      false,
    );
    expect(hasActiveConstraint({ kind: 'dateRange', definition: DATE, from: null, to: null })).toBe(
      false,
    );
  });
});

describe('normaliseSearchText', () => {
  it('lowercases, collapses whitespace and trims', () => {
    expect(normaliseSearchText('  Rooftop   GARDEN\n\tVenue  ')).toBe('rooftop garden venue');
  });

  it('is idempotent', () => {
    const once = normaliseSearchText('  A   B ');
    expect(normaliseSearchText(once)).toBe(once);
  });
});
