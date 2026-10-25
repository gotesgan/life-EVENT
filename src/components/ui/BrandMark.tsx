import Image from 'next/image';
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
 * The brand lockup: the supplied "LE" monogram and the wordmark.
 *
 * The monogram is the artwork the client provided (`public/brand/le-mark.png`),
 * keyed out of its checkerboard background so it sits on any surface — the gold
 * is the identity and it works on both the bone and the near-black scheme
 * without needing a second asset. The wordmark beside it is **set as text**, not
 * shipped as an image: it stays crisp at every density, inherits the ink/bone
 * text colour so it clears contrast in both schemes, and carries the accessible
 * name. The full supplied lockup (monogram + wordmark + "moments to cherish") is
 * used as artwork in the footer, at a size where its lettering is legible.
 *
 * When the wordmark is shown the image is `alt=""` (decorative; the text beside
 * it is the name). Alone, the image becomes the accessible name.
 */
export function BrandMark({ size = 'md', showWordmark = true, className }: BrandMarkProps) {
  return (
    <span className={cx(classes.root, classes[size], className)}>
      <Image
        className={classes.mark}
        src="/brand/le-mark.png"
        alt={showWordmark ? '' : 'Life Events'}
        width={256}
        height={256}
        sizes="48px"
      />

      {showWordmark ? <span className={classes.wordmark}>Life Events</span> : null}
    </span>
  );
}
