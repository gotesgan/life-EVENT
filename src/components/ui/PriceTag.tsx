import { formatPriceRange, formatPriceUnit, type PriceUnitValue } from '@/lib/format';
import { cx } from './cx';
import classes from './PriceTag.module.css';

export type PriceTagSize = 'sm' | 'md' | 'lg';

export interface PriceTagProps {
  priceMin: number | null;
  priceMax: number | null;
  priceUnit?: PriceUnitValue | string | null;
  size?: PriceTagSize;
  /**
   * Replaces the default "Price on request" text when no price is published.
   * The research is explicit that the unknown-price case must be a designed
   * state carrying a reason, never a blank line.
   */
  onRequestLabel?: string;
  /**
   * Puts the unit on its own line under the amount.
   *
   * In a narrow card the single-line form is 220–280px wide once the range is
   * written out ("₹1,20,000 – ₹4,50,000 per event"), which is wider than the
   * column, so the old card clipped it to "₹4,50,000 per ev…". Stacking keeps
   * the whole number on the identifier line and moves the unit beneath it.
   */
  stack?: boolean;
  className?: string;
}

/**
 * Renders `formatPriceRange` — never a hand-rolled price string.
 *
 * The unit comes from `formatPriceUnit` and is split off the formatted range so
 * it can be set one step quieter than the amount; both halves still come from
 * the shared formatter, so this component cannot drift from the server's price
 * rendering.
 */
export function PriceTag({
  priceMin,
  priceMax,
  priceUnit,
  size = 'md',
  onRequestLabel = 'Price on request',
  stack = false,
  className,
}: PriceTagProps) {
  const value = formatPriceRange({ priceMin, priceMax, priceUnit: priceUnit ?? null });

  if (!value) {
    return (
      <span className={cx(classes.onRequest, classes[size], className)}>{onRequestLabel}</span>
    );
  }

  const unit = formatPriceUnit(priceUnit as PriceUnitValue | null);
  const hasUnitSuffix = Boolean(unit && value.endsWith(unit as string));
  const amount = hasUnitSuffix
    ? value.slice(0, value.length - (unit as string).length).trimEnd()
    : value;

  return (
    <span className={cx(classes.price, classes[size], stack && classes.stack, className)}>
      <span className={classes.amount}>{amount}</span>
      {hasUnitSuffix ? <span className={classes.unit}>{unit}</span> : null}
    </span>
  );
}
