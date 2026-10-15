import { describe, expect, it } from 'vitest';
import {
  PAGINATION_DEFAULTS,
  buildPaginated,
  clampPage,
  paginationSchema,
  toSkipTake,
} from '@/lib/pagination';

describe('buildPaginated', () => {
  it('reports the first page of many', () => {
    const result = buildPaginated(['a', 'b'], 5, 1, 2);

    expect(result.data).toEqual(['a', 'b']);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('reports a middle page as having both neighbours', () => {
    const result = buildPaginated(['c', 'd'], 5, 2, 2);

    expect(result.pagination.hasNextPage).toBe(true);
    expect(result.pagination.hasPreviousPage).toBe(true);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('reports the last page as having no next page', () => {
    const result = buildPaginated(['e'], 5, 3, 2);

    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.hasPreviousPage).toBe(true);
  });

  it('reports zero results as zero pages with no neighbours', () => {
    const result = buildPaginated([], 0, 1, 12);

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('does not claim a previous page on the first page even with results', () => {
    expect(buildPaginated([], 0, 1, 12).pagination.hasPreviousPage).toBe(false);
    expect(buildPaginated([], 24, 1, 12).pagination.hasPreviousPage).toBe(false);
  });

  it('handles an exact multiple without inventing a trailing empty page', () => {
    const pagination = buildPaginated(['a', 'b'], 4, 2, 2).pagination;
    expect(pagination.totalPages).toBe(2);
    expect(pagination.hasNextPage).toBe(false);
  });
});

describe('toSkipTake', () => {
  it('skips whole pages and takes the page size', () => {
    expect(toSkipTake(1, 12)).toEqual({ skip: 0, take: 12 });
    expect(toSkipTake(3, 12)).toEqual({ skip: 24, take: 12 });
    expect(toSkipTake(2, 2)).toEqual({ skip: 2, take: 2 });
  });
});

describe('clampPage', () => {
  it('clamps a page beyond the last one to the last page', () => {
    expect(clampPage(9, 5, 2)).toBe(3);
  });

  it('clamps a page below one up to the first page', () => {
    expect(clampPage(0, 5, 2)).toBe(1);
    expect(clampPage(-4, 5, 2)).toBe(1);
  });

  it('leaves a page inside the range untouched', () => {
    expect(clampPage(2, 5, 2)).toBe(2);
  });

  it('returns page 1 when there are no results at all', () => {
    expect(clampPage(7, 0, 12)).toBe(1);
  });
});

describe('paginationSchema', () => {
  it('applies the documented defaults', () => {
    expect(paginationSchema.parse({})).toEqual({
      page: PAGINATION_DEFAULTS.page,
      pageSize: PAGINATION_DEFAULTS.pageSize,
    });
  });

  it('coerces string query parameters', () => {
    expect(paginationSchema.parse({ page: '2', pageSize: '24' })).toEqual({
      page: 2,
      pageSize: 24,
    });
  });

  it('rejects a page size above the hard cap', () => {
    expect(() =>
      paginationSchema.parse({ pageSize: PAGINATION_DEFAULTS.maxPageSize + 1 }),
    ).toThrow();
  });

  it('accepts the cap exactly', () => {
    expect(paginationSchema.parse({ pageSize: PAGINATION_DEFAULTS.maxPageSize }).pageSize).toBe(
      PAGINATION_DEFAULTS.maxPageSize,
    );
  });

  it('rejects zero, negative and fractional pages', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: -1 })).toThrow();
    expect(() => paginationSchema.parse({ pageSize: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: 1.5 })).toThrow();
  });
});
