'use client';

import { IconX } from '@tabler/icons-react';
import { cx } from './cx';
import classes from './FilterChip.module.css';

export interface FilterChipProps {
  /** Human label of the applied filter, e.g. `Banquet hall`. */
  label: string;
  /** Optional result count or facet count shown after the label. */
  count?: number;
  onRemove: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A removable applied-filter chip.
 *
 * The remove affordance is a real `<button>`, so Enter and Space work natively
 * and the chip is reachable by keyboard — no `onKeyDown` re-implementation of
 * button semantics. Its accessible name is `Remove filter: <label>`, which keeps
 * a row of chips unambiguous to a screen reader ("Remove filter: Banquet hall",
 * not eleven identical "Remove" buttons).
 */
export function FilterChip({
  label,
  count,
  onRemove,
  disabled = false,
  className,
}: FilterChipProps) {
  return (
    <span className={cx(classes.chip, disabled && classes.disabled, className)}>
      <span className={classes.label}>{label}</span>
      {typeof count === 'number' ? (
        <span className={classes.count} aria-hidden>
          {count}
        </span>
      ) : null}
      <button
        type="button"
        className={classes.remove}
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove filter: ${label}`}
      >
        <IconX aria-hidden className={classes.icon} size={12} stroke={1.5} />
      </button>
    </span>
  );
}
