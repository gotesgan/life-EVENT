'use client';

import { Select } from '@mantine/core';
import { setSort } from '@/lib/filter-state';
import { LISTING_SORT_OPTIONS, SORT_LABELS } from '@/lib/validation/search';
import { useFilterNavigation } from './useFilterNavigation';

export interface SortSelectProps {
  /** Current value, already validated by the server. */
  value: string;
  idPrefix?: string;
}

/**
 * Sort control.
 *
 * The options and their labels come from `@/lib/validation/search` — the same
 * whitelist the server orders by — so the control can never offer a sort the
 * service would reject, and changing it returns to page 1 (the helper does that).
 */
export function SortSelect({ value, idPrefix = 'results' }: SortSelectProps) {
  const nav = useFilterNavigation();

  return (
    <Select
      id={`${idPrefix}-sort`}
      aria-label="Sort results"
      data={LISTING_SORT_OPTIONS.map((option) => ({
        value: option,
        label: SORT_LABELS[option],
      }))}
      value={value}
      onChange={(next) => {
        if (!next) return;
        nav.update((params) => setSort(params, next));
      }}
      allowDeselect={false}
      radius="md"
      w="12rem"
      maw="100%"
    />
  );
}
