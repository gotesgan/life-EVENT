import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { Button, SimpleGrid, Skeleton, Text } from '@mantine/core';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { CategoryCard } from '@/components/listing/CategoryCard';
import { Container } from '@/components/ui/Container';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { listCategories } from '@/server/services/catalog.service';

export const metadata: Metadata = {
  title: 'All wedding and event categories',
  description:
    'Browse every category of wedding and event vendor — venues, photography, planning and decor, catering, beauty, entertainment, invitations and rentals — with the number of published listings in each.',
  alternates: { canonical: '/categories' },
};

function DirectorySkeleton() {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index}>
          <Skeleton height={28} width="30%" radius="sm" mb="sm" />
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
            {Array.from({ length: 4 }, (_, cardIndex) => (
              <Skeleton key={cardIndex} height={104} radius="lg" />
            ))}
          </SimpleGrid>
        </div>
      ))}
    </>
  );
}

async function CategoryDirectory() {
  const roots = await listCategories();

  if (roots.length === 0) {
    return (
      <EmptyState
        title="The category list is empty"
        description="No categories are active yet. Once an administrator activates one it appears here with its published listing count."
        primaryAction={
          <Button component={Link} href="/vendors" variant="default">
            Browse all listings
          </Button>
        }
      />
    );
  }

  return (
    <>
      {roots.map((root) => (
        <PageSection
          key={root.id}
          id={root.slug}
          title={root.name}
          description={root.shortDescription}
          action={
            <Button
              component={Link}
              href={`/vendors?category=${encodeURIComponent(root.slug)}`}
              variant="default"
              size="sm"
            >
              {root.listingCount} {root.listingCount === 1 ? 'listing' : 'listings'}
            </Button>
          }
        >
          {root.children.length > 0 ? (
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3, lg: 4 }} spacing="sm">
              {root.children.map((child) => (
                <CategoryCard
                  key={child.id}
                  slug={child.slug}
                  name={child.name}
                  listingCount={child.listingCount}
                  shortDescription={child.shortDescription}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              This category has no subcategories. Browse its{' '}
              <Link href={`/vendors?category=${encodeURIComponent(root.slug)}`}>
                published listings
              </Link>{' '}
              instead.
            </Text>
          )}
        </PageSection>
      ))}
    </>
  );
}

export default function CategoriesPage() {
  return (
    <SiteShell>
      <Container className="surface--editorial">
        <PageHeader
          title="Every category, with real counts"
          description="Each count is the number of published businesses in that category and everything beneath it. Counts come from the catalogue, not from marketing copy."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Categories' }]}
        />
        <Suspense fallback={<DirectorySkeleton />}>
          <CategoryDirectory />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
