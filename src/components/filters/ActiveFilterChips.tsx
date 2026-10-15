'use client';

import { useRouter } from 'next/navigation';
import { FilterChip } from '@/components/ui/FilterChip';
import { clearAllFilters } from '@/lib/filter-state';
import type { SearchAppliedFilter } from '@/server/dto/listing.dto';
import { useFilterNavigation } from './useFilterNavigation';
import classes from './ActiveFilterChips.module.css';

export interface ActiveFilterChipsProps {
  /**
   * Built by the search service. Each entry already carries the exact href that
   * removes *only* that filter, so the UI never reconstructs filter state.
   */
  appliedFilters: readonly SearchAppliedFilter[];
  activeFilterCount: number;
  /** Keep the active category when clearing — clearing must not eject the user. */
  keepKeys?: readonly string[];
}

/**
 * The applied-filter chip rail: one removable chip per active filter, the
 * active count, and one "Clear all".
 *
 * Removing a chip is a single-key edit of the query object, so removing the
 * budget cannot silently drop the location. The chips are real buttons with
 * `aria-label="Remove filter: <label>"`, so the whole row is keyboard-operable
 * and unambiguous to a screen reader. The category is context rather than a
 * chip, so "Clear all" keeps it.
 */
export function ActiveFilterChips({
  appliedFilters,
  activeFilterCount,
  keepKeys = ['category'],
}: ActiveFilterChipsProps) {
  const router = useRouter();
  const nav = useFilterNavigation();

  if (appliedFilters.length === 0) return null;

  return (
    <div className={classes.row}>
      <span className={classes.count}>
        {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
      </span>

      {appliedFilters.map((filter) => (
        <FilterChip
          key={filter.code}
          label={`${filter.label}: ${filter.displayValue}`}
          onRemove={() => router.push(filter.removeHref)}
        />
      ))}

      <button
        type="button"
        className={classes.clearAll}
        onClick={() => nav.update((params) => clearAllFilters(params, { keep: keepKeys }))}
      >
        Clear all
      </button>
    </div>
  );
}
