import Link from 'next/link';
import { truncate } from '@/lib/format';
import classes from './CategoryCard.module.css';

export interface CategoryCardProps {
  slug: string;
  name: string;
  /** The real `listingCount` from `listCategories()`. Never a rounded guess. */
  listingCount: number;
  shortDescription?: string | null;
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
  href,
}: CategoryCardProps) {
  return (
    <Link className={classes.card} href={href ?? `/categories/${slug}`}>
      <h3 className={classes.name}>{name}</h3>
      <p className={classes.count}>
        {listingCount === 0
          ? 'No listings yet'
          : `${listingCount} ${listingCount === 1 ? 'listing' : 'listings'}`}
      </p>
      {shortDescription ? (
        <p className={classes.description}>{truncate(shortDescription, 110)}</p>
      ) : null}
    </Link>
  );
}
