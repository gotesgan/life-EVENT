import Image from 'next/image';
import { AspectImage } from '@/components/ui/AspectImage';
import { MediaPlaceholder } from '@/components/ui/MediaPlaceholder';
import { cx } from '@/components/ui/cx';
import type { ListingCardMedia } from '@/server/dto/listing.dto';
import classes from './ListingMedia.module.css';

export interface ListingMediaProps {
  media: ListingCardMedia | null;
  /** Stable fallback seed — the listing slug, never a random value. */
  seed: string;
  /** `sizes` hint for `next/image`; defaults to a three-up grid. */
  sizes?: string;
  /** The one image above the fold on a profile page. */
  preload?: boolean;
  /** Rendered over the image, e.g. a status ribbon. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A listing image, always at the one 3:2 landscape ratio a browse grid is
 * allowed (guide §1.5).
 *
 * Myntra's 3:4 portrait is correct for apparel on a body; a banquet hall, a
 * mandap and a stage are landscape subjects and portrait media crops them badly.
 * The ratio is a property of the grid context, never of the listing, which is
 * why it lives here and not on the page.
 *
 * Composes `AspectImage` and `MediaPlaceholder` from the primitive library. The
 * one thing it adds is an SVG pass-through: the seeded listings serve abstract
 * SVG placeholders from `/public/media`, and `next/image` refuses to optimise
 * SVG unless `dangerouslyAllowSVG` is set in `next.config.ts` (outside this
 * workstream), returning a 400 instead of the image. `AspectImage` does not set
 * `unoptimized`, so SVG sources are rendered through the same frame with
 * `unoptimized` while raster uploads still go through `AspectImage` and the
 * optimiser.
 */
export function ListingMedia({
  media,
  seed,
  sizes = '(max-width: 48em) 100vw, (max-width: 75em) 45vw, 360px',
  preload = false,
  children,
  className,
}: ListingMediaProps) {
  const isSvg = Boolean(media?.url.endsWith('.svg'));

  return (
    <div className={cx(classes.wrap, className)}>
      {media && !isSvg ? (
        <AspectImage src={media.url} alt={media.alt} ratio="3/2" sizes={sizes} preload={preload} />
      ) : media ? (
        <div className={classes.frame}>
          <Image
            className={classes.image}
            src={media.url}
            alt={media.alt}
            fill
            sizes={sizes}
            preload={preload}
            unoptimized
          />
        </div>
      ) : (
        <MediaPlaceholder seed={seed} ratio="3/2" className={classes.frame} />
      )}
      {children}
    </div>
  );
}
