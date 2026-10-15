'use client';

import { Pagination } from '@mantine/core';
import { setPage } from '@/lib/filter-state';
import { useFilterNavigation } from './useFilterNavigation';

export interface ResultsPaginationProps {
  page: number;
  totalPages: number;
}

/**
 * Pagination that preserves every active filter.
 *
 * `setPage` edits the current query object rather than rebuilding it, so the
 * location, budget and category survive page changes; it also drops `page` when
 * returning to page 1, keeping the canonical URL clean.
 */
export function ResultsPagination({ page, totalPages }: ResultsPaginationProps) {
  const nav = useFilterNavigation();

  if (totalPages <= 1) return null;

  return (
    <Pagination
      value={page}
      total={totalPages}
      onChange={(next) => nav.update((params) => setPage(params, next))}
      siblings={1}
      boundaries={1}
      withEdges
      withControls
      size="sm"
      radius="md"
      getControlProps={(control) => ({ 'aria-label': `Go to ${control} page` })}
    />
  );
}
