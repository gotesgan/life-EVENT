import Link from 'next/link';
import { PriceTag } from '@/components/ui/PriceTag';
import type { ListingCard as ListingCardDto } from '@/server/dto/listing.dto';
import { AddToEnquiryButton, EnquirySubmitLink } from './EnquiryShortlist';
import { ListingMedia } from './ListingMedia';
import { TopPickBadge } from './TopPickBadge';
import classes from './ListingCard.module.css';

export interface ListingCardProps {
  listing: ListingCardDto;
  /** Passed to the image loader for the first row only. */
  preloadImage?: boolean;
}

/**
 * The scan anchor, resolved by the ladder in
 * `docs/marketplace-styling-guide.md` §2.2.
 *
 * A marketplace grid is scannable because the *same slot* on every tile holds
 * one comparable, ordinal value — the thing the eye sorts without reading.
 * Amazon and Flipkart use price and rating for that; this product has no
 * ratings (fabricated ratings are forbidden) and frequently no published price,
 * so the slot is filled by the first rung that a real record supports:
 *
 *   1. a published price (`priceMin`/`priceMax` from a real package);
 *   2. capacity (`capacityMin`/`capacityMax`);
 *   3. the designed "Price on request" state.
 *
 * Rungs 3–6 of the guide's ladder (service-area breadth, years in business,
 * measured response time, listed recency) need fields the card DTO does not
 * carry yet, so they cannot be rendered here without inventing a claim. When
 * they are added to `ListingCard`, they slot in between capacity and the
 * fallback and no surface has to change.
 *
 * The function is deliberately total: it never returns `₹0`, an empty string or
 * `N/A`. A zero or missing price falls through rather than rendering.
 */
export type ListingAnchor =
  { kind: 'price'; text: string } | { kind: 'capacity'; text: string } | { kind: 'onRequest' };

export function resolveListingAnchor(listing: ListingCardDto): ListingAnchor {
  const hasPublishedPrice =
    (typeof listing.priceMin === 'number' && listing.priceMin > 0) ||
    (typeof listing.priceMax === 'number' && listing.priceMax > 0);

  if (hasPublishedPrice && listing.priceLabel) {
    return { kind: 'price', text: listing.priceLabel };
  }

  if (listing.capacityLabel) {
    return { kind: 'capacity', text: listing.capacityLabel };
  }

  return { kind: 'onRequest' };
}

/**
 * The one listing card.
 *
 * The anatomy is fixed (guide §1.5): 3:2 media, a two-line title with its box
 * reserved, two one-line meta rows, the anchor slot, a hairline and a single
 * full-width action. Reserved heights are what keep the anchor row on a common
 * baseline down a column of tiles; without them a long title pushes one card's
 * number below its neighbour's and the grid stops reading as a table.
 *
 * The card is one link: the title carries a stretched `::after` that covers the
 * whole card, so a click anywhere (including the media) opens the profile. The
 * shortlist toggle and the enquiry action sit above it, each with its own
 * accessible name.
 *
 * The title stays an `<h3>`: the E2E suite reads a card's name from it.
 */
export function ListingCard({ listing, preloadImage = false }: ListingCardProps) {
  const href = `/vendors/${listing.slug}`;
  const anchor = resolveListingAnchor(listing);

  const metaLine = [listing.category?.name, listing.location?.name].filter(Boolean).join(' · ');

  return (
    <article className={classes.card}>
      <div className={classes.mediaWrap}>
        <ListingMedia
          media={listing.cover}
          seed={listing.slug}
          preload={preloadImage}
          sizes="(max-width: 48em) 100vw, (max-width: 75em) 45vw, 360px"
        />

        {listing.isFeatured ? <span className={classes.ribbon}>Featured</span> : null}

        {listing.galleryCount > 1 ? (
          <span className={classes.photoCount}>{listing.galleryCount} photos</span>
        ) : null}

        <span className={classes.shortlistSlot}>
          <AddToEnquiryButton slug={listing.slug} name={listing.name} compact />
        </span>
      </div>

      <div className={classes.body}>
        <h3 className={classes.title}>
          <Link className={classes.titleLink} href={href}>
            {listing.name}
          </Link>
        </h3>

        <div className={classes.metaRow}>
          {metaLine ? <span className={classes.metaText}>{metaLine}</span> : null}
          <span className={classes.badgeSlot}>
            <TopPickBadge isVerified={listing.isVerified} />
          </span>
        </div>

        <div className={classes.metaRow}>
          {listing.highlights.length > 0 ? (
            <ul className={classes.highlights}>
              {listing.highlights.slice(0, 2).map((highlight) => (
                <li key={highlight.code} className={classes.highlight}>
                  {/* The label is the accessible half of the pair: a chip reading
                      "Candid, Documentary" is clear, but "8 hours" is not. */}
                  <span className="visually-hidden">{highlight.label}: </span>
                  {highlight.value}
                </li>
              ))}
            </ul>
          ) : listing.tagline ? (
            <span className={classes.metaText}>{listing.tagline}</span>
          ) : null}
        </div>

        <div className={classes.anchorRow}>
          {anchor.kind === 'onRequest' ? (
            <PriceTag priceMin={null} priceMax={null} size="md" onRequestLabel="Price on request" />
          ) : (
            <span className={classes.anchorValue}>{anchor.text}</span>
          )}
        </div>

        <hr className={classes.divider} />

        <div className={classes.actions}>
          <EnquirySubmitLink
            slug={listing.slug}
            name={listing.name}
            className={classes.action}
            iconClassName={classes.actionIcon}
          />
        </div>
      </div>
    </article>
  );
}
