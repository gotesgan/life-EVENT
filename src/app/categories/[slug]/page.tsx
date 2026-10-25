import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { notFound } from 'next/navigation';
import { Button } from '@mantine/core';
import { FilterNavigationProvider } from '@/components/filters/useFilterNavigation';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { MobileFilterDrawer } from '@/components/filters/MobileFilterDrawer';
import { SiteShell } from '@/components/layout/SiteShell';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { Container } from '@/components/ui/Container';
import { cx } from '@/components/ui/cx';
import { NotFoundError } from '@/lib/errors';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ListingDetailSkeleton } from '@/components/ui/Skeletons';
import { getAppUrl } from '@/lib/env';
import { searchQuerySchema } from '@/lib/validation/search';
import {
  getCatalogBounds,
  getCategoryDetail,
  listAmenities,
  listCategories,
  listEventTypes,
  listLocations,
} from '@/server/services/catalog.service';
import { searchPublicListings } from '@/server/services/search.service';
import { getRevealedSlugs, publicListingCards } from '@/lib/listing-privacy';
import classes from './page.module.css';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const detail = await getCategoryDetail(slug);
    const title = detail.category.metaTitle ?? `${detail.category.name} — vendors and prices`;
    const description =
      detail.category.metaDescription ??
      detail.category.shortDescription ??
      `Browse ${detail.listingCount} published ${detail.category.name.toLowerCase()} listings with prices, capacity and verification status, and send one enquiry to the businesses you choose.`;

    return {
      title,
      description,
      alternates: { canonical: `/categories/${detail.category.slug}` },
      openGraph: {
        type: 'website',
        title,
        description,
        url: `${getAppUrl()}/categories/${detail.category.slug}`,
      },
    };
  } catch {
    return {
      title: 'Category not found',
      robots: { index: false, follow: false },
    };
  }
}

async function CategoryLanding({ slug }: { slug: string }) {
  let detail;
  try {
    detail = await getCategoryDetail(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { category, parent, children, listingCount, filterDefinitions } = detail;
  const browseHref = `/vendors?category=${encodeURIComponent(category.slug)}`;

  const revealed = await getRevealedSlugs();
  const [previewResult, categories, cities, eventTypes, amenities, bounds] = await Promise.all([
    searchPublicListings({
      query: searchQuerySchema.parse({
        category: category.slug,
        page: 1,
        pageSize: 6,
        sort: 'recommended',
      }),
      rawParams: { category: category.slug },
      basePath: '/vendors',
    }),
    listCategories(),
    listLocations({ type: 'CITY' }),
    listEventTypes(),
    listAmenities(),
    getCatalogBounds(),
  ]);
  const preview = { ...previewResult, cards: publicListingCards(previewResult.cards, revealed) };

  const facets = {
    categories: categories.map((item) => ({
      slug: item.slug,
      name: item.name,
      listingCount: item.listingCount,
    })),
    locations: cities.map((item) => ({ slug: item.slug, name: item.name })),
    eventTypes: eventTypes.map((item) => ({ slug: item.slug, name: item.name })),
    amenities: amenities.map((item) => ({
      code: item.code,
      label: item.label,
      groupLabel: item.groupLabel,
    })),
  };

  return (
    <>
      <PageHeader
        title={category.name}
        description={category.shortDescription}
        eyebrow={`${listingCount} published ${listingCount === 1 ? 'listing' : 'listings'}`}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Categories', href: '/categories' },
          ...(parent ? [{ label: parent.name, href: `/categories/${parent.slug}` }] : []),
          { label: category.name },
        ]}
        actions={
          <Button component={Link} href={browseHref} size="sm">
            Browse all {listingCount} with filters
          </Button>
        }
      />

      <FilterNavigationProvider basePath="/vendors" seed={{ category: category.slug }}>
        <div className={cx(classes.layout, 'surface--dense')}>
          {/* The sidebar performs the search on `/vendors`, seeded with this
              category, so every control here lands on the results surface with the
              category already applied. */}
          <aside className={classes.sidebar} aria-label={`Filters for ${category.name}`}>
            <FilterPanel
              facets={facets}
              definitions={filterDefinitions}
              categoryName={category.name}
              idPrefix="category"
              bounds={bounds}
            />
          </aside>

          {/* Below `md` the sidebar above is `display: none`, so this drawer is the
              only route to the same panel — including the category's attribute
              filters, which are the reason this page exists. Above `md` the
              wrapper collapses and the sidebar takes over. */}
          <div className={classes.mobileFilters}>
            <MobileFilterDrawer
              facets={facets}
              definitions={filterDefinitions}
              categoryName={category.name}
              /* This landing page's own URL never carries a filter: every control
                 in the panel navigates to `/vendors?category=…`. The count is
                 therefore genuinely zero, not an unknown. */
              activeFilterCount={0}
              /* The unfiltered category total is exactly what `/vendors` shows
                 before any filter is applied, so the trigger cannot overstate. */
              resultCount={listingCount}
              bounds={bounds}
            />
          </div>

          <div className={classes.content}>
            {children.length > 0 ? (
              <ul
                className={classes.subcategories}
                aria-label={`Subcategories of ${category.name}`}
              >
                {children.map((child) => (
                  <li key={child.id}>
                    <Link className={classes.subcategory} href={`/categories/${child.slug}`}>
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <SectionHeading
              title={`${category.name} listings`}
              description={
                preview.cards.length < listingCount
                  ? `Showing the first ${preview.cards.length} of ${listingCount}.`
                  : undefined
              }
              action={
                <Button component={Link} href={browseHref} variant="default" size="sm">
                  See all {listingCount}
                </Button>
              }
            />

            <ListingGrid
              listings={preview.cards}
              label={`${category.name} listings`}
              variant="grid"
            />

            {category.description ? (
              <div className={classes.prose}>{category.description}</div>
            ) : null}

            <p className={classes.meta}>
              Prices shown are the ones each business published. Where nothing is published, the
              listing says “Price on request” rather than guessing.
            </p>
          </div>
        </div>
      </FilterNavigationProvider>
    </>
  );
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  return (
    <SiteShell>
      <Container>
        <Suspense fallback={<ListingDetailSkeleton />}>
          <CategoryLanding slug={slug} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
