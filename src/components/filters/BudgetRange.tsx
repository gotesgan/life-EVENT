'use client';

import { NumericRangeField } from './NumericRangeField';

export interface BudgetRangeProps {
  /** Set on a category page where the budget axis has a different meaning. */
  legend?: string;
  /** Catalogue price envelope, shown as the opening values of the two inputs. */
  defaultMin?: number | null;
  defaultMax?: number | null;
}

/**
 * Budget filter (`priceMin`/`priceMax`).
 *
 * Rupee amounts, Indian digit grouping. The inputs open on the catalogue's
 * envelope so the scale is visible, but a bound equal to that envelope is not a
 * filter — an empty budget still means "any", and a listing with an unpublished
 * price is not silently excluded unless the customer actually narrows a bound.
 */
export function BudgetRange({
  legend = 'Budget',
  defaultMin = null,
  defaultMax = null,
}: BudgetRangeProps) {
  return (
    <NumericRangeField
      legend={legend}
      help="Per the price unit each business publishes."
      minKey="priceMin"
      maxKey="priceMax"
      prefix="₹"
      thousandSeparator=","
      minLabel="Minimum"
      maxLabel="Maximum"
      defaultMin={defaultMin}
      defaultMax={defaultMax}
    />
  );
}
