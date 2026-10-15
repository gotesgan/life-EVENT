import Image from 'next/image';
import { cx } from './cx';
import { MediaPlaceholder, type MediaRatio } from './MediaPlaceholder';
import classes from './AspectImage.module.css';

export interface AspectImageProps {
  /** Remote/optimised URL, or `null` when the listing has no photograph yet. */
  src: string | null | undefined;
  /**
   * Required. A photograph of a venue or a vendor's work is content, so the alt
   * text describes it; pass `''` only if the same information is adjacent in
   * text, which for a listing card is rare.
   */
  alt: string;
  ratio?: MediaRatio;
  /**
   * `sizes` is required for correct `srcset` selection with `fill`. The default
   * describes a one-up mobile / three-up desktop grid; override it in any grid
   * that is not three columns wide.
   */
  sizes?: string;
  /** Next 16 renamed `priority` to `preload`. Use for at most one image per page. */
  preload?: boolean;
  /** Seeds the fallback motif when `src` is absent. Defaults to `alt`. */
  seed?: string;
  className?: string;
}

const RATIO_CLASS: Record<MediaRatio, string> = {
  '3/2': classes.r3x2,
  '4/3': classes.r4x3,
  '1/1': classes.r1x1,
  '16/9': classes.r16x9,
};

/**
 * Fixed-ratio media wrapper.
 *
 * The ratio is owned here, not by the page, which is what stops one grid mixing
 * 3:2 thumbnails with 4:3 ones — a defect the research found explicitly on
 * VenueLook. When `src` is missing the component does not render an empty box or
 * a broken image: it hands off to `MediaPlaceholder`, which reserves the same
 * box and draws a deterministic motif for the seed.
 */
export function AspectImage({
  src,
  alt,
  ratio = '3/2',
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
  preload = false,
  seed,
  className,
}: AspectImageProps) {
  const wrapperClass = cx(classes.root, RATIO_CLASS[ratio], className);

  if (!src) {
    return (
      <div className={wrapperClass}>
        <MediaPlaceholder
          seed={seed ?? alt ?? 'listing'}
          ratio={ratio}
          label={alt ? `No photograph available: ${alt}` : undefined}
          className={classes.placeholder}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Image className={classes.image} src={src} alt={alt} fill sizes={sizes} preload={preload} />
    </div>
  );
}
