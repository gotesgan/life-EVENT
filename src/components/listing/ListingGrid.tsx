import { cx } from '@/components/ui/cx';
import type { ListingCard as ListingCardDto } from '@/server/dto/listing.dto';
import { ListingCard } from './ListingCard';
import classes from './ListingGrid.module.css';

export interface ListingGridProps {
  listings: readonly ListingCardDto[];
  /** `list` is a single column — used in narrow rails and related listings. */
  variant?: 'grid' | 'list';
  /** Accessible name for the list, e.g. "Search results". */
  label?: string;
  className?: string;
}

/**
 * Responsive listing grid.
 *
 * A `<ul>` rather than a pile of `<div>`s: assistive technology can then
 * announce "list, 12 items" and move between results. The single 16:9 media
 * ratio is owned by `ListingMedia`, so no grid can mix ratios.
 */
export function ListingGrid({ listings, variant = 'grid', label, className }: ListingGridProps) {
  return (
    <ul
      aria-label={label}
      className={cx(variant === 'grid' ? classes.grid : classes.list, className)}
    >
      {listings.map((listing, index) => (
        <li key={listing.id}>
          <ListingCard listing={listing} preloadImage={index === 0} />
        </li>
      ))}
    </ul>
  );
}
