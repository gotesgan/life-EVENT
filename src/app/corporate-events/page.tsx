import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from '@/components/ui/ClientLink';
import { SimpleGrid } from '@mantine/core';
import { SiteShell } from '@/components/layout/SiteShell';
import { PageSection } from '@/components/layout/PageSection';
import { CategoryCard } from '@/components/listing/CategoryCard';
import { ListingGrid } from '@/components/listing/ListingGrid';
import { ListingResultsSkeleton } from '@/components/listing/ListingResultsSkeleton';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { getRevealedSlugs, publicListingCards } from '@/lib/listing-privacy';
import { searchQuerySchema } from '@/lib/validation/search';
import { listCategories } from '@/server/services/catalog.service';
import { searchPublicListings } from '@/server/services/search.service';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Corporate events — venues, catering, AV and offsites',
  description:
    'Corporate venues, conference and AV production, corporate catering and team offsites, with published prices and capacity. Filter by city and send an enquiry per business.',
  alternates: { canonical: '/corporate-events' },
};

/** The corporate subcategories, in the order the section presents them. */
const CORPORATE_CATEGORY_SLUGS = [
  'corporate-venues',
  'conference-and-av',
  'corporate-catering',
  'team-offsites',
] as const;

const WHY: readonly { title: string; body: string }[] = [
  {
    title: 'Published day rates, not quotes',
    body: 'Conference venues and AV houses list their day rates and capacity, so a budget check does not need a phone call.',
  },
  {
    title: 'One enquiry per supplier',
    body: 'Send a brief to the venue, the caterer and the AV house separately — each one answers on its own.',
  },
  {
    title: 'Names unlock on enquiry',
    body: 'Compare the published facts first. The business name and contact details appear when you send the enquiry.',
  },
];

async function CorporateCategories() {
  await connection();

  // `listCategories()` returns the tree (roots with their `children`), so the
  // corporate subcategories have to be flattened out of it rather than looked up
  // in the top-level array.
  const roots = await listCategories();
  const flattened = roots.flatMap((category) => [category, ...category.children]);
  const bySlug = new Map(flattened.map((category) => [category.slug, category]));

  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
      {CORPORATE_CATEGORY_SLUGS.map((slug) => {
        const category = bySlug.get(slug);
        if (!category) return null;
        return (
          <CategoryCard
            key={category.id}
            slug={category.slug}
            name={category.name}
            listingCount={category.listingCount}
            shortDescription={category.shortDescription}
            href={`/vendors?category=${encodeURIComponent(category.slug)}`}
          />
        );
      })}
    </SimpleGrid>
  );
}

async function CorporateListings() {
  await connection();

  const result = await searchPublicListings({
    query: searchQuerySchema.parse({
      category: 'corporate-events',
      page: 1,
      // Four fills exactly one row of the hub's grid; the "all corporate
      // suppliers" action is the path to the rest, so the section never ends on
      // a stranded single card.
      pageSize: 4,
      sort: 'recommended',
    }),
    rawParams: { category: 'corporate-events' },
    basePath: '/corporate-events',
  });
  const revealed = await getRevealedSlugs();
  const cards = publicListingCards(result.cards, revealed);

  if (cards.length === 0) {
    return (
      <Surface tone="muted" padding="lg">
        <p className={classes.empty}>
          No corporate listings are published yet. New suppliers are being added — the team can be
          reached from <Link href="/contact">the contact page</Link>.
        </p>
      </Surface>
    );
  }

  return <ListingGrid listings={cards} label="Corporate event suppliers" />;
}

export default function CorporateEventsPage() {
  return (
    <SiteShell>
      <Container>
        <PageHeader
          title="Corporate events"
          description="Conference venues, AV production, corporate catering and team offsites — with the prices and capacity each supplier publishes. Names unlock when you enquire."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Corporate events' }]}
        />

        <div className="surface--editorial">
          <PageSection
            id="corporate-categories"
            title="What you need for a corporate event"
            action={
              <Link className={classes.browseAll} href="/vendors?category=corporate-events">
                Browse all corporate suppliers
              </Link>
            }
          >
            <Suspense
              fallback={
                <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className={classes.skeletonTile} />
                  ))}
                </SimpleGrid>
              }
            >
              <CorporateCategories />
            </Suspense>
          </PageSection>

          <PageSection
            id="corporate-listings"
            title="Corporate suppliers"
            description="Every published corporate listing. Filter by city, budget and capacity on the full results page."
            action={
              <Link className={classes.browseAll} href="/vendors?category=corporate-events">
                All corporate suppliers
              </Link>
            }
          >
            <Suspense fallback={<ListingResultsSkeleton count={4} />}>
              <CorporateListings />
            </Suspense>
          </PageSection>

          <PageSection id="corporate-how" title="How a corporate enquiry works">
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {WHY.map((item) => (
                <Surface key={item.title} tone="raised" padding="md">
                  <h3 className={classes.whyTitle}>{item.title}</h3>
                  <p className={classes.whyBody}>{item.body}</p>
                </Surface>
              ))}
            </SimpleGrid>
          </PageSection>
        </div>
      </Container>
    </SiteShell>
  );
}
