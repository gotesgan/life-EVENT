import type { ReactNode } from 'react';
import { cx } from '@/components/ui';
import classes from './AdminPage.module.css';

/**
 * Presentation helpers every admin table shares.
 *
 * These exist so the four tables (listings, enquiries, customers, audit) are
 * *structurally* the same instrument: the same density context, the same
 * header-to-row rhythm, the same way of stopping a long value from wrapping a
 * row. They render no chrome of their own and hold no state, so they are safe
 * from a Server Component and from a Client Component alike.
 *
 * The discipline they enforce, in one place:
 *
 * - `AdminTableRegion` applies the real `.surface--dense` class, so the rhythm
 *   tokens (`--app-card-padding`, `--app-section-gap`, dense card radius) come
 *   from `globals.css` rather than from four pages each guessing a margin.
 * - `RowCell` and `RowStack` reserve a fixed line box, so a two-line account
 *   cell and a one-line timestamp cell still align their baselines down a
 *   column.
 * - `title` is always passed by the caller: truncation without a way to read the
 *   full value is data loss, not density.
 */

export interface AdminTableRegionProps {
  children: ReactNode;
  /** Optional heading that names the region for assistive technology. */
  label?: string;
  className?: string;
}

/** The table's own region: dense context plus the filter-to-table gap. */
export function AdminTableRegion({ children, label, className }: AdminTableRegionProps) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className={cx('surface--dense', classes.tableRegion, classes.tableBlock, className)}
    >
      {children}
    </div>
  );
}

export interface RowStackProps {
  children: ReactNode;
  className?: string;
}

/** A cell with a primary value and one or two supporting lines. */
export function RowStack({ children, className }: RowStackProps) {
  return <div className={cx(classes.cellStack, className)}>{children}</div>;
}

export interface TruncatedProps {
  children: ReactNode;
  /** The full value. Without it a truncated cell is unreadable. */
  title: string;
  className?: string;
}

/** One line, ellipsised, with the full value available on hover. */
export function Truncated({ children, title, className }: TruncatedProps) {
  return (
    <span title={title} className={cx(classes.truncate, className)}>
      {children}
    </span>
  );
}
