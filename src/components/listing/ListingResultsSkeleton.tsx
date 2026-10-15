import { cx } from '@/components/ui/cx';
import classes from './ListingResultsSkeleton.module.css';

export interface ListingResultsSkeletonProps {
  /** Match the expected page size so the grid height does not jump. */
  count?: number;
  className?: string;
}

/**
 * The loading state for a browse grid.
 *
 * It mirrors the real `ListingCard` box model exactly — 3:2 media, a two-line
 * title box, two meta rows, the 26px anchor row, the hairline and the 40px
 * action — so the skeleton → content swap produces no cumulative layout shift
 * (guide §7.5). The skeleton is decorative; the container carries
 * `role="status"`, so a screen reader hears one "loading listings"
 * announcement rather than a grid of empty boxes.
 *
 * The shimmer is a token-coloured sweep at 1.2s linear, and it is removed
 * entirely under `prefers-reduced-motion`, where the bars become a static
 * `--app-surface-muted` fill with identical dimensions.
 */
export function ListingResultsSkeleton({ count = 6, className }: ListingResultsSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading listings"
      className={cx(classes.grid, className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={classes.card} aria-hidden>
          <span className={cx(classes.media, classes.shimmer)} />

          <div className={classes.body}>
            <div className={classes.titleBox}>
              <span className={cx(classes.bar, classes.titleBar, classes.shimmer)} />
              <span className={cx(classes.bar, classes.titleBarShort, classes.shimmer)} />
            </div>

            <span className={cx(classes.bar, classes.metaFirst, classes.shimmer)} />
            <span className={cx(classes.bar, classes.metaSecond, classes.shimmer)} />

            <span className={cx(classes.bar, classes.anchor, classes.shimmer)} />

            <span className={classes.divider} />
            <span className={cx(classes.bar, classes.action, classes.shimmer)} />
          </div>
        </div>
      ))}
    </div>
  );
}
