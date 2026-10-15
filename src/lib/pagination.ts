import { z } from 'zod';

/**
 * Pagination contract shared by every list endpoint.
 *
 * Offset pagination is a deliberate choice: the UI needs a total count and page
 * numbers, and the result sets are bounded by the page-size cap. See ADR-7 in
 * docs/system-design.md.
 */
export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 12,
  maxPageSize: 48,
} as const;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULTS.page),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_DEFAULTS.maxPageSize)
    .default(PAGINATION_DEFAULTS.pageSize),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function toSkipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginated<T>(
  data: T[],
  totalItems: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalItems > 0,
    },
  };
}

/** Clamps a requested page to the last page that actually has results. */
export function clampPage(page: number, totalItems: number, pageSize: number): number {
  if (totalItems === 0) return 1;
  const totalPages = Math.ceil(totalItems / pageSize);
  return Math.min(Math.max(page, 1), totalPages);
}
