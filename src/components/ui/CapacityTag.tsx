import { IconUsers } from '@tabler/icons-react';
import { formatCapacityRange } from '@/lib/format';
import { cx } from './cx';
import classes from './CapacityTag.module.css';

export type CapacityTagSize = 'sm' | 'md';

export interface CapacityTagProps {
  capacityMin: number | null;
  capacityMax: number | null;
  size?: CapacityTagSize;
  /** Adds a 1.5px-stroke `IconUsers` before the range. */
  withIcon?: boolean;
  className?: string;
}

/**
 * Renders `formatCapacityRange`.
 *
 * Returns `null` when both bounds are absent rather than printing "0 guests":
 * an unknown capacity is an absence, and the caller decides whether to say so.
 */
export function CapacityTag({
  capacityMin,
  capacityMax,
  size = 'md',
  withIcon = false,
  className,
}: CapacityTagProps) {
  const value = formatCapacityRange(capacityMin, capacityMax);
  if (!value) return null;

  return (
    <span className={cx(classes.root, classes[size], className)}>
      {withIcon ? <IconUsers aria-hidden className={classes.icon} size={14} stroke={1.5} /> : null}
      <span className={classes.value}>{value}</span>
    </span>
  );
}
