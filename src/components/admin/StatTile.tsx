import type { ReactNode } from 'react';
import { Text } from '@mantine/core';
import { cx } from '@/components/ui';
import classes from './StatTile.module.css';

export type StatTone = 'default' | 'brand' | 'success' | 'warning' | 'danger';

export interface StatTileProps {
  /** What the number counts. Always a full phrase, never an abbreviation. */
  label: string;
  value: ReactNode;
  /** The unit the value is measured in (`%`, `days`). Never part of `value`. */
  unit?: string;
  /** What the number includes, and what it does not. */
  hint?: ReactNode;
  tone?: StatTone;
}

/**
 * One operational number.
 *
 * No deltas and no sparklines: the service returns a single value, and drawing
 * a trend from a value that has no history would be inventing data. When a
 * metric is zero this prints "0" — an honest zero beats a hidden row.
 *
 * No decorative fill either. The value is the largest type on the page precisely
 * because a metric is the one place a larger step is justified; a gradient
 * behind it would add chroma without adding meaning, and the palette's colour
 * budget belongs to actions and statuses.
 *
 * The label sits *above* the number so a column of tiles scans as a column of
 * labels first, then values — the same order as a table header, which is what
 * the reader is already trained on by the tables below it.
 */
export function StatTile({ label, value, unit, hint, tone = 'default' }: StatTileProps) {
  return (
    <div className={classes.root}>
      <Text component="p" className={classes.label}>
        {label}
      </Text>
      <p className={classes.valueRow}>
        <Text component="span" className={cx(classes.value, classes[tone])}>
          {value}
        </Text>
        {unit ? (
          <Text component="span" className={classes.unit}>
            {unit}
          </Text>
        ) : null}
      </p>
      {hint ? (
        <Text component="p" className={classes.hint}>
          {hint}
        </Text>
      ) : null}
    </div>
  );
}
