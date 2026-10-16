import { cx } from './cx';
import classes from './BrandMark.module.css';

export type BrandMarkSize = 'sm' | 'md' | 'lg';

export interface BrandMarkProps {
  size?: BrandMarkSize;
  /** Set `false` for the mark alone (favicons, tight headers, avatar slots). */
  showWordmark?: boolean;
  className?: string;
}

/**
 * The wordmark: a charcoal tile carrying an arch — the one form that reads as
 * "venue" without resorting to a building or a ring — topped with a brass
 * keystone dot drawn from the accent ramp.
 *
 * Everything is inline SVG plus tokens, so it needs no asset request, cannot
 * 404, and is correct in both schemes by construction: the tile uses
 * `--app-brand` and the arch uses `--app-brand-contrast`, which Mantine defines
 * as white in light and near-black slate in dark.
 *
 * When the wordmark is shown the SVG is `aria-hidden` and the text carries the
 * accessible name; without it the SVG becomes `role="img"` with a label.
 */
export function BrandMark({ size = 'md', showWordmark = true, className }: BrandMarkProps) {
  return (
    <span className={cx(classes.root, classes[size], className)}>
      <svg
        className={classes.mark}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        aria-hidden={showWordmark ? true : undefined}
        role={showWordmark ? undefined : 'img'}
        aria-label={showWordmark ? undefined : 'Live Envt'}
      >
        <rect x="0" y="0" width="32" height="32" rx="9" fill="var(--app-brand)" />
        <path
          d="M10.5 24.5V17.5a5.5 5.5 0 0 1 11 0v7"
          fill="none"
          stroke="var(--app-brand-contrast)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="7.6" r="2.1" fill="var(--app-accent)" />
      </svg>

      {showWordmark ? (
        <span className={classes.wordmark}>
          Live Envt
          <span aria-hidden className={classes.stop}>
            .
          </span>
        </span>
      ) : null}
    </span>
  );
}
