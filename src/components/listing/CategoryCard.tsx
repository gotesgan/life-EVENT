import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { AspectImage } from '@/components/ui/AspectImage';
import { truncate } from '@/lib/format';
import classes from './CategoryCard.module.css';

export interface CategoryCardProps {
  slug: string;
  name: string;
  /** The real `listingCount` from `listCategories()`. Never a rounded guess. */
  listingCount: number;
  shortDescription?: string | null;
  /**
   * The category's tile photograph (`Category.heroImageUrl`).
   *
   * When it is absent the tile is not broken and not empty: `AspectImage` draws
   * the deterministic placeholder motif for this slug, so subcategories and any
   * photo-less category still read as a set of distinct objects.
   */
  imageUrl?: string | null;
  /**
   * Overrides the default `/categories/<slug>` destination. Used by location
   * pages to link a real category × city combination, which keeps the count and
   * the destination describing the same set of listings.
   */
  href?: string;
}

/**
 * A category tile.
 *
 * A photograph, then the category's name, its real count and one short
 * description. The image is **decorative** — the category name is the link's
 * accessible name and sits directly beneath it — so its alt is empty rather than
 * a second announcement of the same words.
 *
 * The count is the actual number of published listings in the category subtree,
 * computed by the catalogue service. The research found that sites routinely
 * publish two different customer/vendor counts on one page; the rule here is one
 * count, computed from real data, labelled for what it is.
 */
export function CategoryCard({
  slug,
  name,
  listingCount,
  shortDescription,
  imageUrl,
  href,
}: CategoryCardProps) {
  return (
    <Link className={classes.card} href={href ?? `/categories/${slug}`}>
      <AspectImage
        src={imageUrl}
        alt=""
        ratio="3/2"
        seed={slug}
        sizes="(min-width: 75em) 300px, (min-width: 48em) 33vw, 100vw"
        className={classes.media}
      />

      <div className={classes.body}>
        <h3 className={classes.name}>{name}</h3>
        <p className={classes.count}>
          {listingCount === 0
            ? 'No listings yet'
            : `${listingCount} ${listingCount === 1 ? 'listing' : 'listings'}`}
        </p>
        {shortDescription ? (
          <p className={classes.description}>{truncate(shortDescription, 110)}</p>
        ) : null}
        <IconArrowRight className={classes.arrow} size="1rem" stroke={1.6} aria-hidden />
      </div>
    </Link>
  );
}
