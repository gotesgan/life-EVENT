import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { notFound } from 'next/navigation';
import { IconMapPin } from '@tabler/icons-react';
import { ListingEnquiryForm } from '@/components/enquiry/ListingEnquiryForm';
import { SiteShell } from '@/components/layout/SiteShell';
import { AmenityList } from '@/components/listing/AmenityList';
import { AttributeList } from '@/components/listing/AttributeList';
import { ListingContactCard } from '@/components/listing/ListingContactCard';
import { ListingFacts, type ListingFact } from '@/components/listing/ListingFacts';
import { ListingGallery } from '@/components/listing/ListingGallery';
import { PackageList } from '@/components/listing/PackageList';
import { ProfileJumpNav, type JumpNavItem } from '@/components/listing/ProfileJumpNav';
import { RelatedListings } from '@/components/listing/RelatedListings';
import { ServiceList } from '@/components/listing/ServiceList';
import { SpaceList } from '@/components/listing/SpaceList';
import { TopPickBadge } from '@/components/listing/TopPickBadge';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { PriceTag } from '@/components/ui/PriceTag';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ListingDetailSkeleton, ListingGridSkeleton } from '@/components/ui/Skeletons';
import { Surface } from '@/components/ui/Surface';
import { getAppUrl } from '@/lib/env';
import { NotFoundError } from '@/lib/errors';
import {
  getRevealedSlugs,
  isListingRevealed,
  maskedListingName,
  publicListingDetail,
} from '@/lib/listing-privacy';
import { listingRef } from '@/lib/public-listing-ref';
import type { ListingDetail } from '@/server/dto/listing.dto';
import { listEventTypes } from '@/server/services/catalog.service';
import { getPublicListingBySlug } from '@/server/services/listing.service';
import classes from './page.module.css';

interface ListingPageProps {
  params: Promise<{ slug: string }>;
}

/** Absolute URL for an OG image; seeded media are root-relative paths. */
function absoluteMediaUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${getAppUrl()}${url}`;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const listing = await getPublicListingBySlug(slug);

    /*
     * Metadata is always written against the anonymous identity, even for a
     * visitor who has already enquired. A page title, an OG card or a canonical
     * URL is a permanent, crawlable artefact; writing the trading name into it
     * would leak the name to everyone the link is ever shared with, which is the
     * one thing the enquiry gate exists to prevent.
     */
    const anonymousName = maskedListingName(listing);
    const title = `${anonymousName} — prices, capacity and facilities`;
    const description = `${anonymousName}. ${
      listing.primaryCategory
        ? `A ${listing.primaryCategory.name.toLowerCase()} listing`
        : 'A listing'
    } on Life Events with published prices${
      listing.location ? ` in ${listing.location.name}` : ''
    }. Send an enquiry to see the business name and contact details.`;

    const cover = listing.gallery[0];
    // Social crawlers cannot render the seeded SVG placeholders, so an SVG cover
    // is omitted rather than advertised as a broken preview image.
    const ogImage =
      cover && !cover.url.endsWith('.svg')
        ? { url: absoluteMediaUrl(cover.url), alt: anonymousName }
        : null;

    const publicPath = `/vendors/${listingRef(listing.id)}`;

    return {
      title,
      description,
      alternates: { canonical: publicPath },
      openGraph: {
        type: 'website',
        title,
        description,
        url: `${getAppUrl()}${publicPath}`,
        images: ogImage ? [ogImage] : undefined,
      },
    };
  } catch {
    return {
      title: 'Business not found',
      robots: { index: false, follow: false },
    };
  }
}

/** Extras the profile can state without reading an attribute binding. */
function factExtras(listing: ListingDetail): ListingFact[] {
  const extras: ListingFact[] = [];
  if (listing.capacityLabel) extras.push({ label: 'Capacity', value: listing.capacityLabel });
  if (listing.eventTypes.length > 0) {
    extras.push({
      label: 'Events',
      value: listing.eventTypes.map((eventType) => eventType.name).join(', '),
    });
  }
  return extras;
}

function jumpItemsFor(listing: ListingDetail): JumpNavItem[] {
  const items: JumpNavItem[] = [{ id: 'photos', label: 'Photos' }];
  if (listing.description || listing.about) items.push({ id: 'about', label: 'About' });
  if (listing.services.length > 0) items.push({ id: 'services', label: 'Services' });
  if (listing.packages.length > 0) items.push({ id: 'packages', label: 'Packages' });
  if (listing.spaces.length > 0) items.push({ id: 'spaces', label: 'Spaces' });
  if (listing.amenities.length > 0) items.push({ id: 'facilities', label: 'Facilities' });
  if (listing.attributeGroups.some((group) => group.attributes.length > 0)) {
    items.push({ id: 'details', label: 'Details' });
  }
  items.push({ id: 'enquiry', label: 'Enquire' });
  return items;
}

async function ListingProfile({ slug }: { slug: string }) {
  let listing: ListingDetail;
  try {
    listing = await getPublicListingBySlug(slug);
  } catch (error) {
    // An unknown slug, a draft or an archived listing are all the same 404: a
    // guessed slug must not reveal that a draft exists.
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // The reveal cookie decides whether this request may see the trading name.
  // Everything downstream reads the masked projection, so the real name is
  // never rendered — and never serialised — for an unrevealed visitor.
  const revealed = await getRevealedSlugs();
  const identityHidden = !isListingRevealed(revealed, listing);
  // Captured before masking: the masked projection replaces `slug` with the
  // opaque public reference, and the related rail must still exclude this row.
  const realSlug = listing.slug;
  const eventTypes = await listEventTypes();
  listing = publicListingDetail(listing, revealed);

  const category = listing.primaryCategory;
  const isVerified = listing.verificationStatus === 'VERIFIED';
  const publicReference = listingRef(listing.id);

  return (
    <>
      <nav className={classes.breadcrumbs} aria-label="Breadcrumb">
        <ol className={classes.crumbList}>
          <li className={classes.crumb}>
            <Link className={classes.crumbLink} href="/">
              Home
            </Link>
          </li>
          {category ? (
            <li className={classes.crumb}>
              <Link
                className={classes.crumbLink}
                href={`/vendors?category=${encodeURIComponent(category.slug)}`}
              >
                {category.name}
              </Link>
            </li>
          ) : null}
          <li className={classes.crumb}>
            <span aria-current="page" className={classes.crumbCurrent}>
              {listing.name}
            </span>
          </li>
        </ol>
      </nav>

      <section
        id="photos"
        aria-label={`Photographs of ${listing.name}`}
        className={classes.gallery}
      >
        <ListingGallery gallery={listing.gallery} name={listing.name} />
      </section>

      <div className={classes.layout}>
        <div className={classes.main}>
          <PageHeader
            title={listing.name}
            eyebrow={
              category ? (
                <Link
                  className={classes.eyebrowLink}
                  href={`/vendors?category=${encodeURIComponent(category.slug)}`}
                >
                  {category.name}
                </Link>
              ) : null
            }
            description={
              listing.location ? (
                <Link
                  className={classes.locationLink}
                  href={`/vendors?location=${encodeURIComponent(listing.location.slug)}`}
                >
                  <IconMapPin size="0.875rem" stroke={1.5} aria-hidden /> {listing.location.name}
                </Link>
              ) : null
            }
            actions={
              <div className={classes.identityActions}>
                <TopPickBadge isVerified={isVerified} size="md" />
              </div>
            }
          />

          {/*
            There used to be a paragraph here explaining that the name was hidden and
            that everything else was published. It made the same point as the title
            (an anonymous label), the card's "Name shown after enquiry" line, the
            locked rail and the form — four explanations of one rule. The rail says
            it once, in two short sentences, and this space stays for the price.
          */}

          <div className={classes.priceRow}>
            <PriceTag
              priceMin={listing.priceMin}
              priceMax={listing.priceMax}
              priceUnit={listing.priceUnit}
              size="lg"
            />
            <p className={classes.priceNote}>
              {listing.priceLabel
                ? 'The price this business published. Anything not shown here has not been published.'
                : 'This business has not published a price, so we show no number rather than guessing.'}
            </p>
          </div>

          <ListingFacts groups={listing.attributeGroups} extras={factExtras(listing)} />

          <ProfileJumpNav items={jumpItemsFor(listing)} />

          {listing.description || listing.about ? (
            <section id="about" className={classes.section}>
              <SectionHeading title="About this business" />
              {listing.description ? <p className={classes.prose}>{listing.description}</p> : null}
              {listing.about ? <p className={classes.prose}>{listing.about}</p> : null}
            </section>
          ) : null}

          {listing.services.length > 0 ? (
            <section id="services" className={classes.section}>
              <SectionHeading
                title="Services"
                description="What this business sells, with the price it published for each service."
              />
              <ServiceList services={listing.services} />
            </section>
          ) : null}

          {listing.packages.length > 0 ? (
            <section id="packages" className={classes.section}>
              <SectionHeading
                title="Packages"
                description="Each package lists what it includes and, just as importantly, what it does not."
              />
              <PackageList packages={listing.packages} />
            </section>
          ) : null}

          {listing.spaces.length > 0 ? (
            <section id="spaces" className={classes.section}>
              <SectionHeading
                title="Spaces at this venue"
                description="Named halls and lawns, with the capacity each one actually holds."
              />
              <SpaceList spaces={listing.spaces} />
            </section>
          ) : null}

          {listing.amenities.length > 0 ? (
            <section id="facilities" className={classes.section}>
              <SectionHeading title="Facilities" />
              <AmenityList amenities={listing.amenities} />
            </section>
          ) : null}

          {listing.attributeGroups.some((group) => group.attributes.length > 0) ? (
            <section id="details" className={classes.section}>
              <SectionHeading
                title="Details"
                description="Everything this business has recorded. Blank fields are omitted rather than filled in."
              />
              <AttributeList groups={listing.attributeGroups} />
            </section>
          ) : null}
        </div>

        <aside className={classes.rail} aria-label={`Enquire about ${listing.name}`}>
          <div id="enquiry" className={classes.railSticky}>
            <ListingContactCard
              contact={listing.contact}
              listingName={listing.name}
              hidden={identityHidden}
              footnote="Businesses typically reply within two working days."
            />

            <Surface tone="raised" padding="md" elevated className={classes.enquiryCard}>
              <ListingEnquiryForm
                listingRef={publicReference}
                eventTypeOptions={eventTypes.map((eventType) => ({
                  value: eventType.slug,
                  label: eventType.name,
                }))}
                hidden={identityHidden}
              />
            </Surface>
          </div>
        </aside>
      </div>

      {category ? (
        <div className={classes.related}>
          <Suspense fallback={<ListingGridSkeleton count={3} />}>
            <RelatedListings
              categorySlug={category.slug}
              categoryName={category.name}
              excludeSlug={realSlug}
            />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}

export default async function VendorProfilePage({ params }: ListingPageProps) {
  const { slug } = await params;

  return (
    <SiteShell>
      <Container>
        <Suspense fallback={<ListingDetailSkeleton />}>
          <ListingProfile slug={slug} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
