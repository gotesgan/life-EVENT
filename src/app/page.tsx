import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { Button, Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { HeroSearchBar } from '@/components/filters/HeroSearchBar';
import { HomeHero } from '@/components/layout/HomeHero';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { CategoryCard } from '@/components/listing/CategoryCard';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { ListingResultsSkeleton } from '@/components/listing/ListingResultsSkeleton';
import { LocationLinks } from '@/components/listing/LocationLinks';
import { Container } from '@/components/ui/Container';
import { EmptyState } from '@/components/ui/EmptyState';
import { Surface } from '@/components/ui/Surface';
import { searchQuerySchema } from '@/lib/validation/search';
import { listCategories, listLocations } from '@/server/services/catalog.service';
import { getSiteSettings } from '@/server/services/settings.service';
import { searchPublicListings } from '@/server/services/search.service';
import { getRevealedSlugs, publicListingCards } from '@/lib/listing-privacy';

export const metadata: Metadata = {
  title: 'Wedding and event vendors, with published prices',
  description:
    'Compare published prices and send an enquiry to the businesses you choose. Names unlock when you enquire.',
  alternates: { canonical: '/' },
};

/*
 * The hero clip.
 *
 * A hosted 12-second loop (Cloudflare R2). Only its first nine seconds were cut
 * to loop seamlessly, so the player loops at 0:09 rather than at the file's end
 * — see `HomeHeroMedia` for how the playhead is moved back. To change the video,
 * change the URL; there is no local file to replace.
 */
const HERO_VIDEO_URL = 'https://pub-4669c5f1fbd346d6994920d5422e4d3f.r2.dev/video/hero-loop.mp4';
const HERO_VIDEO_SEGMENT_END_SECONDS = 9;

/**
 * The copy that never changes with settings, kept in one place so the streaming
 * hero and its prerendered fallback cannot drift.
 */
const HERO_COPY = {
  title: 'Your wedding, your way.',
  lede: 'Compare published prices, then enquire with the business you want.',
  facts: ['Published prices and inclusions', 'Names unlock when you enquire'],
  imageUrl: '/media/seed/home-hero-cover.jpg',
  imageAlt: 'A couple celebrating beneath a floral arch as confetti falls',
  popularSearches: [
    { label: 'Banquet halls', href: '/vendors?category=venues' },
    { label: 'Photographers', href: '/vendors?category=photographers' },
    { label: 'Makeup artists', href: '/vendors?category=makeup-artists' },
    { label: 'Decorators', href: '/vendors?category=decorators-and-florists' },
  ],
} as const;

/**
 * The hero video comes from admin settings, so it streams rather than being part
 * of the static shell. The fallback below renders the same frame with the shipped
 * defaults, so there is no empty band while the value arrives.
 */
async function HomeHeroLive() {
  await connection();
  const site = await getSiteSettings();

  return (
    <HomeHero
      {...HERO_COPY}
      videoUrl={site.heroVideoUrl || HERO_VIDEO_URL}
      videoSegmentEndSeconds={site.heroVideoSegmentEndSeconds}
    >
      <Suspense fallback={<SearchSkeleton />}>
        <HomeSearch />
      </Suspense>
    </HomeHero>
  );
}

/*
 * Every data-reading subtree below is its own async component behind a
 * `<Suspense>` boundary. `cacheComponents: true` makes an uncached database read
 * outside a boundary a build error, and it is also the right shape: the hero and
 * the section headings are static, and each band streams in as its query
 * finishes rather than holding up the whole page.
 */

async function HomeSearch() {
  // `connection()` marks this subtree as request-time. Without it Next tries to
  // prerender the homepage at build time, which both freezes build-time listing
  // data into the HTML and fails outright: the Prisma client calls
  // `crypto.randomUUID()` internally, and `cacheComponents` rejects that as an
  // unstable value during prerendering. Declaring the dependency explicitly is
  // the documented way to say "this data is per-request".
  await connection();

  const [categories, cities] = await Promise.all([
    listCategories(),
    listLocations({ type: 'CITY' }),
  ]);

  return (
    <HeroSearchBar
      categories={categories.map((category) => ({ slug: category.slug, name: category.name }))}
      locations={cities.map((city) => ({ slug: city.slug, name: city.name }))}
    />
  );
}

function SearchSkeleton() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
      <Skeleton height={62} radius="md" />
      <Skeleton height={62} radius="md" />
      <Skeleton height={62} radius="md" />
      <Skeleton height={62} radius="md" />
    </SimpleGrid>
  );
}

async function PopularCategories() {
  // `connection()` marks this subtree as request-time. Without it Next tries to
  // prerender the homepage at build time, which both freezes build-time listing
  // data into the HTML and fails outright: the Prisma client calls
  // `crypto.randomUUID()` internally, and `cacheComponents` rejects that as an
  // unstable value during prerendering. Declaring the dependency explicitly is
  // the documented way to say "this data is per-request".
  await connection();

  const categories = await listCategories();
  const ranked = [...categories].sort(
    (a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name),
  );
  const withListings = ranked.filter((category) => category.listingCount > 0);
  const shown = (withListings.length > 0 ? withListings : ranked).slice(0, 8);

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
      {shown.map((category) => (
        <CategoryCard
          key={category.id}
          slug={category.slug}
          name={category.name}
          listingCount={category.listingCount}
          shortDescription={category.shortDescription}
          imageUrl={category.heroImageUrl}
        />
      ))}
    </SimpleGrid>
  );
}

async function CityStrip() {
  // `connection()` marks this subtree as request-time. Without it Next tries to
  // prerender the homepage at build time, which both freezes build-time listing
  // data into the HTML and fails outright: the Prisma client calls
  // `crypto.randomUUID()` internally, and `cacheComponents` rejects that as an
  // unstable value during prerendering. Declaring the dependency explicitly is
  // the documented way to say "this data is per-request".
  await connection();

  const cities = await listLocations({ type: 'CITY' });
  if (cities.length === 0) return null;

  return (
    <LocationLinks
      label="Browse by city"
      locations={cities.slice(0, 18).map((city) => ({ slug: city.slug, name: city.name }))}
    />
  );
}

async function TopPicksRail() {
  // `connection()` marks this subtree as request-time. Without it Next tries to
  // prerender the homepage at build time, which both freezes build-time listing
  // data into the HTML and fails outright: the Prisma client calls
  // `crypto.randomUUID()` internally, and `cacheComponents` rejects that as an
  // unstable value during prerendering. Declaring the dependency explicitly is
  // the documented way to say "this data is per-request".
  await connection();

  const result = await searchPublicListings({
    query: searchQuerySchema.parse({ verified: 'true', page: 1, pageSize: 4, sort: 'recommended' }),
    rawParams: { verified: 'true' },
    basePath: '/vendors',
  });
  const revealed = await getRevealedSlugs();
  const cards = publicListingCards(result.cards, revealed);

  if (cards.length === 0) {
    return (
      <EmptyState
        title="No top picks yet"
        description="Browse every listing in the meantime."
        primaryAction={
          <Button component={Link} href="/vendors" variant="default">
            Browse all vendors
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ListingGrid listings={cards} label="Top picks" />
      <Group mt="md">
        <Button component={Link} href="/vendors?verified=true" variant="default" size="sm">
          See all top picks
        </Button>
      </Group>
    </>
  );
}

export default function HomePage() {
  return (
    <SiteShell>
      {/* The hero and every band below it are the editorial register: one message
          in the viewport, so the page breathes. Density is only added where the
          task demands comparison — the browse grid (guide §8.1). */}
      <div className="surface--editorial">
        <Suspense
          fallback={
            <HomeHero
              {...HERO_COPY}
              videoUrl={HERO_VIDEO_URL}
              videoSegmentEndSeconds={HERO_VIDEO_SEGMENT_END_SECONDS}
            >
              <Suspense fallback={<SearchSkeleton />}>
                <HomeSearch />
              </Suspense>
            </HomeHero>
          }
        >
          <HomeHeroLive />
        </Suspense>
      </div>

      <Container className="surface--editorial">
        <PageSection
          id="popular-categories"
          title="Browse by category"
          action={
            <Button component={Link} href="/categories" variant="default" size="sm">
              All categories
            </Button>
          }
        >
          <Suspense
            fallback={
              <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} height={104} radius="lg" />
                ))}
              </SimpleGrid>
            }
          >
            <PopularCategories />
          </Suspense>
        </PageSection>

        <PageSection id="by-city" title="Find vendors near you">
          <Suspense
            fallback={
              <Group gap="xs">
                {Array.from({ length: 8 }, (_, index) => (
                  <Skeleton key={index} height={40} width={120} radius="xl" />
                ))}
              </Group>
            }
          >
            <CityStrip />
          </Suspense>
        </PageSection>

        <PageSection id="top-picks" title="Top picks">
          <Suspense fallback={<ListingResultsSkeleton count={4} />}>
            <TopPicksRail />
          </Suspense>
        </PageSection>

        <PageSection id="how-it-works" title="How it works">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Surface tone="raised" padding="md" radius="card">
              <Stack gap="xs">
                <h3>Compare</h3>
                <p>Price, capacity and inclusions as published. No guesses.</p>
              </Stack>
            </Surface>
            <Surface tone="raised" padding="md" radius="card">
              <Stack gap="xs">
                <h3>Enquire, and unlock</h3>
                <p>
                  One short form per business. Sending it reveals their name and contact details.
                </p>
              </Stack>
            </Surface>
            <Surface tone="raised" padding="md" radius="card">
              <Stack gap="xs">
                <h3>Track replies</h3>
                <p>One reference code per enquiry. No account needed.</p>
              </Stack>
            </Surface>
          </SimpleGrid>
        </PageSection>
      </Container>
    </SiteShell>
  );
}
