'use client';

import { NumericRangeField } from './NumericRangeField';

export interface GuestCapacityRangeProps {
  legend?: string;
  /** Catalogue capacity envelope, shown as the opening values of the two inputs. */
  defaultMin?: number | null;
  defaultMax?: number | null;
}

/**
 * Guest-count filter (`capacityMin`/`capacityMax`).
 *
 * Matches listings whose capacity range *overlaps* the requested one, so
 * "400–600 guests" finds a hall that seats 300–800. A listing with an unknown
 * capacity is excluded while this filter is active rather than being claimed to
 * fit — the server's overlap clause is deliberate about that.
 */
export function GuestCapacityRange({
  legend = 'Guests',
  defaultMin = null,
  defaultMax = null,
}: GuestCapacityRangeProps) {
  return (
    <NumericRangeField
      legend={legend}
      help="Venues and caterers publish capacity; other categories can ignore it."
      minKey="capacityMin"
      maxKey="capacityMax"
      suffix=" guests"
      thousandSeparator=","
      minLabel="At least"
      maxLabel="At most"
      defaultMin={defaultMin}
      defaultMax={defaultMax}
    />
  );
}
