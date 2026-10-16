import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { notFound } from 'next/navigation';
import { IconMapPin } from '@tabler/icons-react';
import { SiteShell } from '@/components/layout/SiteShell';
import { AmenityList } from '@/components/listing/AmenityList';
import { AttributeList } from '@/components/listing/AttributeList';
import { EnquirySubmitButton } from '@/components/listing/EnquiryShortlist';
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
import { getAppUrl } from '@/lib/env';
import { NotFoundError } from '@/lib/errors';
import type { ListingDetail } from '@/server/dto/listing.dto';
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
    const title = listing.tagline ? `${listing.name} — ${listing.tagline}` : listing.name;
    const description =
      listing.description ??
      listing.about ??
      `${listing.name}${
        listing.primaryCategory ? `, a ${listing.primaryCategory.name.toLowerCase()} business` : ''
      }${listing.location ? ` in ${listing.location.name}` : ''}. See what the business has published and send an enquiry.`;

    const cover = listing.gallery[0];
    // Social crawlers cannot render the seeded SVG placeholders, so an SVG cover
    // is omitted rather than advertised as a broken preview image.
    const ogImage =
      cover && !cover.url.endsWith('.svg')
        ? { url: absoluteMediaUrl(cover.url), alt: cover.alt }
        : null;

    return {
      title,
      description,
      alternates: { canonical: `/vendors/${listing.slug}` },
      openGraph: {
        type: 'website',
        title,
        description,
        url: `${getAppUrl()}/vendors/${listing.slug}`,
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
  items.push({ id: 'contact', label: 'Contact' });
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

  const category = listing.primaryCategory;
  const enquiryHref = `/enquire?enquire=${encodeURIComponent(listing.slug)}`;
  const isVerified = listing.verificationStatus === 'VERIFIED';

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
                <span className={classes.mobileCta}>
                  {/*
                   * Shortlist-aware, like the primary CTA further down the page.
                   * The plain `enquiryHref` link would silently replace a basket
                   * the customer had already built on the browse page with this
                   * single business — the button looked identical but did
                   * something different.
                   */}
                  <EnquirySubmitButton slug={listing.slug} />
                </span>
              </div>
            }
          />

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
          <div id="contact" className={classes.railSticky}>
            <ListingContactCard
              contact={listing.contact}
              listingName={listing.name}
              enquiryHref={enquiryHref}
              footnote="Businesses typically reply within two working days."
            />
          </div>
        </aside>
      </div>

      {category ? (
        <div className={classes.related}>
          <Suspense fallback={<ListingGridSkeleton count={3} />}>
            <RelatedListings
              categorySlug={category.slug}
              categoryName={category.name}
              excludeSlug={listing.slug}
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
