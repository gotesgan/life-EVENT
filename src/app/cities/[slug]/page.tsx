import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { notFound } from 'next/navigation';
import { Button, SimpleGrid, Stack } from '@mantine/core';
import { SiteShell } from '@/components/layout/SiteShell';
import { CategoryCard } from '@/components/listing/CategoryCard';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { Container } from '@/components/ui/Container';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSection } from '@/components/layout/PageSection';
import { ListingGridSkeleton } from '@/components/ui/Skeletons';
import { getAppUrl } from '@/lib/env';
import { NotFoundError } from '@/lib/errors';
import { searchQuerySchema } from '@/lib/validation/search';
import { listCategories, resolveLocationOrThrow } from '@/server/services/catalog.service';
import { searchPublicListings } from '@/server/services/search.service';

/**
 * Location landing page.
 *
 * This is a real, indexable page rather than a thin filter shortcut: it answers
 * "which wedding businesses work in this city" with the city's description, the
 * categories that actually have listings there, and the matching results. Each
 * category link is a genuine category × city combination, which is the unit a
 * search engine should be allowed to index — as opposed to the endless
 * arbitrary filter permutations that `robots.ts` disallows.
 */

interface CityPageProps {
  params: Promise<{ slug: string }>;
}

const PREVIEW_PAGE_SIZE = 12;

export async function generateMetadata({ params }: CityPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const location = await resolveLocationOrThrow(slug);
    const title = `${location.name} wedding and event vendors`;
    const description =
      location.description ??
      `Find wedding and event businesses working in ${location.name} — venues, photographers, caterers, decorators and more — with published prices and a single enquiry form.`;

    return {
      title,
      description,
      alternates: { canonical: `/cities/${location.slug}` },
      openGraph: {
        type: 'website',
        title,
        description,
        url: `${getAppUrl()}/cities/${location.slug}`,
      },
    };
  } catch {
    return { title: 'Location not found', robots: { index: false, follow: false } };
  }
}

async function CityLanding({ slug }: { slug: string }) {
  // Request-time: this render depends on the location argument, and reading the
  // database during prerendering is both pointless and rejected by
  // `cacheComponents` when a library calls an unstable value.
  const { connection } = await import('next/server');
  await connection();

  let location;
  try {
    location = await resolveLocationOrThrow(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  if (!location.isActive) notFound();

  const query = searchQuerySchema.parse({
    location: location.slug,
    page: 1,
    pageSize: PREVIEW_PAGE_SIZE,
    sort: 'recommended',
  });

  const [results, categories] = await Promise.all([
    searchPublicListings({
      query,
      rawParams: { location: location.slug },
      basePath: '/cities/' + location.slug,
    }),
    listCategories(),
  ]);

  // Only categories that actually have published listings in this city, so the
  // page never links to an empty combination.
  const populated = categories
    .filter((category) => category.listingCount > 0)
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 8);

  const ancestors = location.path.split('/').filter(Boolean);

  return (
    <>
      <PageHeader
        title={`Wedding and event businesses in ${location.name}`}
        description={
          location.description ??
          `Providers that work in ${location.name}, with the prices and capacity they have chosen to publish.`
        }
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Locations', href: '/categories' },
          { label: location.name },
        ]}
      />

      {populated.length > 0 ? (
        <PageSection eyebrow="Browse" title={`Categories in ${location.name}`}>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }} spacing="md">
            {populated.map((category) => (
              <CategoryCard
                key={category.slug}
                slug={category.slug}
                name={category.name}
                shortDescription={category.shortDescription}
                listingCount={category.listingCount}
                href={`/vendors?category=${category.slug}&location=${location.slug}`}
              />
            ))}
          </SimpleGrid>
        </PageSection>
      ) : null}

      <PageSection
        eyebrow="Published listings"
        title={`${results.pagination.totalItems} ${results.pagination.totalItems === 1 ? 'business' : 'businesses'} in ${location.name}`}
        action={
          <Button
            component={Link}
            href={`/vendors?location=${location.slug}`}
            variant="light"
            radius="md"
          >
            See all with filters
          </Button>
        }
      >
        {/* The preview grid is the one dense band on this page: a dozen tiles
            compared on price and capacity, which is exactly the comparison load
            the dense register exists for (guide §8.1). */}
        <div className="surface--dense">
          {results.cards.length > 0 ? (
            <ListingGrid listings={results.cards} />
          ) : (
            <EmptyState
              title={`No published businesses in ${location.name} yet`}
              description="Nothing has been published for this location so far. Browse the full directory instead — many businesses work beyond the city they are based in."
              primaryAction={
                <Button component={Link} href="/vendors" radius="md">
                  Browse all businesses
                </Button>
              }
            />
          )}
        </div>
      </PageSection>

      {ancestors.length > 1 ? (
        <PageSection title="Related locations">
          <Stack gap="xs">
            <p>
              {location.name} sits inside{' '}
              <Link href={`/vendors?location=${location.slug}`}>{location.name}</Link>. Businesses
              registered elsewhere often declare {location.name} as a service area, so a city search
              does not miss providers based in a neighbouring area.
            </p>
          </Stack>
        </PageSection>
      ) : null}
    </>
  );
}

export default async function CityPage({ params }: CityPageProps) {
  const { slug } = await params;

  return (
    <SiteShell>
      <Container className="surface--editorial">
        <Suspense fallback={<ListingGridSkeleton count={PREVIEW_PAGE_SIZE} />}>
          <CityLanding slug={slug} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
