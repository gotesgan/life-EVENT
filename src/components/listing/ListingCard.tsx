import Link from 'next/link';
import { IconArrowRight, IconLock } from '@tabler/icons-react';
import { PriceTag } from '@/components/ui/PriceTag';
import { listingRef } from '@/lib/public-listing-ref';
import type { ListingCard as ListingCardDto } from '@/server/dto/listing.dto';
import { EnquiryModal } from '@/components/enquiry/EnquiryModal';
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
 * The anatomy is a fixed stack, top to bottom: 3:2 media with its overlay chips,
 * a title box reserved for two lines, one identity line, one quiet line of
 * supporting copy, the anchor slot, and a hairline above a single action pinned
 * to the bottom. The reserved boxes are what keep the price on the same baseline
 * down a column of tiles — without them a long title pushes one card's number
 * below its neighbour's and the grid stops reading as a table.
 *
 * **Identity.** While a listing's name is withheld, the title is the anonymous
 * stand-in ("Banquet hall in Andheri East") and the identity line explains how
 * to unlock it. The real name is not rendered, not serialised into the RSC
 * payload, and not put in the URL — the link carries an opaque `ul_` reference
 * instead (see `src/lib/public-listing-ref.ts`). The whole card remains one
 * link; the action at the foot is the visible affordance for the same
 * destination.
 */
export function ListingCard({ listing, preloadImage = false }: ListingCardProps) {
  const href = `/vendors/${listingRef(listing.id)}`;
  const anchor = resolveListingAnchor(listing);
  const hidden = listing.isNameHidden === true;

  const identityLine = hidden
    ? 'Name shown after enquiry'
    : [listing.category?.name, listing.location?.name].filter(Boolean).join(' · ');

  // One quiet line of supporting copy, never a clamped list of chips: the card
  // is a scanning surface, and two highlights in a single line was what forced
  // the old card to truncate its own content row.
  const supportingLine = listing.tagline ?? listing.highlights[0]?.value ?? null;

  return (
    <article className={classes.card}>
      <div className={classes.mediaWrap}>
        <ListingMedia
          media={listing.cover}
          seed={listing.slug}
          preload={preloadImage}
          sizes="(max-width: 48em) 100vw, (max-width: 75em) 45vw, 360px"
        />

        {listing.isFeatured ? (
          <span className={classes.featuredSlot}>
            <span className={classes.ribbon}>Featured</span>
          </span>
        ) : null}

        <span className={classes.pickSlot}>
          <TopPickBadge isVerified={listing.isVerified} />
        </span>

        {listing.galleryCount > 1 ? (
          <span className={classes.photoCount}>{listing.galleryCount} photos</span>
        ) : null}
      </div>

      <div className={classes.body}>
        <h3 className={classes.title}>
          <Link className={classes.titleLink} href={href}>
            {hidden ? (
              <span className={classes.maskedTitle}>
                <IconLock className={classes.lockIcon} size="0.875rem" stroke={1.6} aria-hidden />
                {listing.name}
              </span>
            ) : (
              listing.name
            )}
          </Link>
        </h3>

        {identityLine ? <p className={classes.identity}>{identityLine}</p> : null}

        {supportingLine ? <p className={classes.supporting}>{supportingLine}</p> : null}

        <div className={classes.anchorRow}>
          {anchor.kind === 'price' ? (
            <PriceTag
              priceMin={listing.priceMin}
              priceMax={listing.priceMax}
              priceUnit={listing.priceUnit}
              size="md"
              stack
            />
          ) : anchor.kind === 'capacity' ? (
            <span className={classes.anchorValue}>{anchor.text}</span>
          ) : (
            <PriceTag priceMin={null} priceMax={null} size="md" onRequestLabel="Price on request" />
          )}
        </div>

        <div className={classes.footer}>
          <Link className={classes.action} href={href}>
            <span>View details</span>
            <IconArrowRight className={classes.actionIcon} size="1rem" stroke={1.8} aria-hidden />
          </Link>
          <EnquiryModal
            listingRef={listingRef(listing.id)}
            hidden={hidden}
            triggerLabel="Enquire"
            triggerVariant="secondary"
            triggerSize="sm"
            triggerClassName={classes.footerEnquire}
          />
        </div>
      </div>
    </article>
  );
}
