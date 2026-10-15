import { Suspense } from 'react';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { Button, Skeleton } from '@mantine/core';
import { ActiveFilterChips } from '@/components/filters/ActiveFilterChips';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { MobileFilterDrawer } from '@/components/filters/MobileFilterDrawer';
import { ResultsPagination } from '@/components/filters/ResultsPagination';
import { SearchBar } from '@/components/filters/SearchBar';
import { SortSelect } from '@/components/filters/SortSelect';
import { normaliseSearchParams, type RawSearchParams } from '@/components/filters/searchParams';
import { SiteShell } from '@/components/layout/SiteShell';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { ListingResultsSkeleton } from '@/components/listing/ListingResultsSkeleton';
import { Container } from '@/components/ui/Container';
import { cx } from '@/components/ui/cx';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { buildQuery, clearAllFilters } from '@/lib/filter-state';
import { AppError } from '@/lib/errors';
import { pluralise } from '@/lib/format';
import { searchQuerySchema } from '@/lib/validation/search';
import {
  getFilterDefinitionsForCategory,
  listAmenities,
  listCategories,
  listEventTypes,
  listLocations,
} from '@/server/services/catalog.service';
import { searchPublicListings } from '@/server/services/search.service';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Browse wedding and event vendors',
  description:
    'Filter wedding and event vendors by category, city, event type, budget and guest count. Every listing shows the price and details the business has published.',
  /**
   * One canonical URL for every filter combination. Filtered result sets are
   * deliberately excluded from the index (see `robots.ts`), so the canonical
   * points at the unfiltered surface rather than at a facet permutation.
   */
  alternates: { canonical: '/vendors' },
};

/** Static fallback while the search streams in. Mirrors the real header boxes. */
function SearchSkeleton() {
  return (
    <div>
      <Skeleton height={34} width="42%" radius="sm" mb="sm" />
      <Skeleton height={16} width="60%" radius="sm" mb="xl" />
      <ListingResultsSkeleton count={6} />
    </div>
  );
}

async function SearchResults({ rawParams }: { rawParams: RawSearchParams }) {
  // Request-time: results depend on the URL's filter parameters, and the search
  // service reaches Prisma, which calls `crypto.randomUUID()` internally — an
  // "unstable value" that `cacheComponents` refuses to evaluate while
  // prerendering. Declaring the dependency explicitly is the documented fix.
  await connection();

  const normalised = normaliseSearchParams(rawParams);
  const parsed = searchQuerySchema.safeParse(normalised);

  if (!parsed.success) {
    return (
      <div className={classes.stateBlock}>
        <ErrorState
          title="Those filters are not valid"
          description="Part of the address could not be understood. Start again from the unfiltered list."
          secondaryAction={
            <Button component={Link} href="/vendors" variant="default">
              Browse all vendors
            </Button>
          }
        />
      </div>
    );
  }

  const query = parsed.data;

  let result;
  try {
    // Called directly on the server — never an HTTP round trip to our own API.
    result = await searchPublicListings({ query, rawParams, basePath: '/vendors' });
  } catch (error) {
    if (error instanceof AppError) {
      return (
        <div className={classes.stateBlock}>
          <ErrorState
            title="We could not apply those filters"
            description={error.message}
            secondaryAction={
              <Button component={Link} href="/vendors" variant="default">
                Clear every filter
              </Button>
            }
          />
        </div>
      );
    }
    throw error;
  }

  const [categories, cities, eventTypes, amenities] = await Promise.all([
    listCategories(),
    listLocations({ type: 'CITY' }),
    listEventTypes(),
    listAmenities(),
  ]);

  // Category attribute filters only exist for the active category; with no
  // category there are none, and no `f.` parameter can be produced.
  const definitions = query.category ? await getFilterDefinitionsForCategory(query.category) : [];

  const facets = {
    categories: categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      listingCount: category.listingCount,
    })),
    locations: cities.map((city) => ({ slug: city.slug, name: city.name })),
    eventTypes: eventTypes.map((eventType) => ({ slug: eventType.slug, name: eventType.name })),
    amenities: amenities.map((amenity) => ({
      code: amenity.code,
      label: amenity.label,
      groupLabel: amenity.groupLabel,
    })),
  };

  const { pagination, appliedFilters, activeFilterCount, context } = result;
  const from = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  const clearHref = `/vendors${buildQuery(clearAllFilters(normalised, { keep: ['category'] }))}`;

  const title = context.category ? context.category.name : 'Wedding and event vendors';
  const description = context.category
    ? `Every published ${context.category.name.toLowerCase()} listing, filtered and sorted in one place.`
    : 'Browse every published business. Use the filters to narrow by category, city, event type, budget or guest count.';

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={
          context.category
            ? [
                { label: 'Home', href: '/' },
                { label: 'Categories', href: '/categories' },
                { label: context.category.name },
              ]
            : [{ label: 'Home', href: '/' }, { label: 'Vendors' }]
        }
      />

      <div className={cx(classes.layout, 'surface--dense')}>
        <aside className={classes.sidebar} aria-label="Filters">
          <FilterPanel
            facets={facets}
            definitions={definitions}
            categoryName={context.category?.name ?? null}
            idPrefix="sidebar"
          />
        </aside>

        <div className={classes.results}>
          <div className={classes.controls}>
            <SearchBar />
            <MobileFilterDrawer
              facets={facets}
              definitions={definitions}
              categoryName={context.category?.name ?? null}
              activeFilterCount={activeFilterCount}
              resultCount={pagination.totalItems}
            />
            <ActiveFilterChips
              appliedFilters={appliedFilters}
              activeFilterCount={activeFilterCount}
            />
          </div>

          <div className={classes.header}>
            <p className={classes.total}>
              {pagination.totalItems === 0 ? (
                'No businesses'
              ) : (
                <>
                  Showing <span className={classes.totalStrong}>{from}</span>–
                  <span className={classes.totalStrong}>{to}</span> of{' '}
                  <span className={classes.totalStrong}>{pagination.totalItems}</span>{' '}
                  {pluralise(pagination.totalItems, 'business', 'businesses')}
                </>
              )}
            </p>
            <SortSelect value={context.sort} />
          </div>

          {result.cards.length > 0 ? (
            <ListingGrid listings={result.cards} label="Search results" />
          ) : (
            <div className={classes.stateBlock}>
              <EmptyState
                title="No businesses match these filters"
                description="Every filter is a real constraint, so a narrow combination can legitimately return nothing. Try widening the budget, removing the guest count, or starting from a category."
                primaryAction={
                  <Button component={Link} href={clearHref}>
                    Clear all filters
                  </Button>
                }
                secondaryAction={
                  <Button component={Link} href="/categories" variant="default">
                    Browse categories
                  </Button>
                }
              />
            </div>
          )}

          {pagination.totalPages > 1 ? (
            <div className={classes.pagination}>
              <ResultsPagination page={pagination.page} totalPages={pagination.totalPages} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = await searchParams;

  return (
    <SiteShell>
      <Container>
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResults rawParams={rawParams} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
