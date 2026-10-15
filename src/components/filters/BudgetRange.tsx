'use client';

import { NumericRangeField } from './NumericRangeField';

export interface BudgetRangeProps {
  /** Set on a category page where the budget axis has a different meaning. */
  legend?: string;
}

/**
 * Budget filter (`priceMin`/`priceMax`).
 *
 * Rupee amounts, Indian digit grouping, and no default — an empty budget means
 * "any", not "₹0", so a listing with an unpublished price is not silently
 * excluded unless the customer actually sets a bound.
 */
export function BudgetRange({ legend = 'Budget' }: BudgetRangeProps) {
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
    />
  );
}
