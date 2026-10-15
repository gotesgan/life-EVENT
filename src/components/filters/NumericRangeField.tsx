'use client';

import { useState } from 'react';
import { NumberInput } from '@mantine/core';

/** Mirrors `searchQuerySchema`'s numeric bound, so a value cannot be typed that the server will reject. */
const MAX_FILTER_VALUE = 100_000_000;
import { useDebouncedCallback } from '@mantine/hooks';
import { setSingleValue } from '@/lib/filter-state';
import { FilterFieldset } from './FilterControl';
import { useFilterNavigation } from './useFilterNavigation';
import classes from './FilterControl.module.css';

export interface NumericRangeFieldProps {
  legend: string;
  help?: string | null;
  /** The two independent query keys, e.g. `priceMin` / `priceMax`. */
  minKey: string;
  maxKey: string;
  prefix?: string;
  suffix?: string;
  thousandSeparator?: string;
  /** Local labels so the two inputs are distinguishable to a screen reader. */
  minLabel: string;
  maxLabel: string;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Two number inputs writing two independent query keys.
 *
 * Used for the universal budget and guest-count filters, which the URL carries
 * as `priceMin`/`priceMax` and `capacityMin`/`capacityMax` rather than the
 * combined `min-max` encoding that category attribute ranges use. Commits are
 * debounced and also flushed on blur, so a partially typed number never becomes
 * a filter — and because it is a `replace`, typing does not fill the history.
 */
export function NumericRangeField({
  legend,
  help,
  minKey,
  maxKey,
  prefix,
  suffix,
  thousandSeparator,
  minLabel,
  maxLabel,
}: NumericRangeFieldProps) {
  const nav = useFilterNavigation();
  const currentMin = parseNumber(nav.params[minKey]);
  const currentMax = parseNumber(nav.params[maxKey]);

  const externalMin = currentMin === null ? '' : String(currentMin);
  const externalMax = currentMax === null ? '' : String(currentMax);
  const [min, setMin] = useState(externalMin);
  const [max, setMax] = useState(externalMax);
  const [syncedFrom, setSyncedFrom] = useState(`${externalMin}|${externalMax}`);

  // Sync the input to the URL when it changes underneath us (back/forward, a
  // removed chip, or another control committing). React's documented pattern for
  // "adjusting state when a prop changes" compares against the previous value
  // during render; doing it in an effect would add a cascading render pass and
  // is rejected by the react-hooks rules.
  if (`${externalMin}|${externalMax}` !== syncedFrom) {
    setSyncedFrom(`${externalMin}|${externalMax}`);
    setMin(externalMin);
    setMax(externalMax);
  }

  const commit = useDebouncedCallback((nextMin: string, nextMax: string) => {
    nav.update(
      (params) => {
        const withMin = setSingleValue(params, minKey, nextMin.trim() || undefined);
        return setSingleValue(withMin, maxKey, nextMax.trim() || undefined);
      },
      { replace: true },
    );
  }, 500);

  return (
    <FilterFieldset legend={legend} help={help}>
      <div className={classes.range}>
        <NumberInput
          label={minLabel}
          value={min}
          prefix={prefix}
          suffix={suffix}
          thousandSeparator={thousandSeparator}
          min={0}
          onChange={(value) => {
            const next = value === '' ? '' : String(value);
            setMin(next);
            commit(next, max);
          }}
          onBlur={() => commit.flush()}
          // `clampBehavior="none"` previously allowed a fractional or
          // out-of-range value to be committed, which the server rejected with a
          // 400 that replaced the results page. The input now clamps while typing
          // and refuses decimals, so those values cannot be entered.
          clampBehavior="blur"
          allowDecimal={false}
          max={MAX_FILTER_VALUE}
          radius="md"
        />
        <NumberInput
          label={maxLabel}
          value={max}
          prefix={prefix}
          suffix={suffix}
          thousandSeparator={thousandSeparator}
          min={0}
          onChange={(value) => {
            const next = value === '' ? '' : String(value);
            setMax(next);
            commit(min, next);
          }}
          onBlur={() => commit.flush()}
          clampBehavior="blur"
          allowDecimal={false}
          max={MAX_FILTER_VALUE}
          radius="md"
        />
      </div>
    </FilterFieldset>
  );
}
