import Link from '@/components/ui/ClientLink';
import { Button } from '@mantine/core';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { searchPublicListings } from '@/server/services/search.service';
import { searchQuerySchema } from '@/lib/validation/search';
import { getRevealedSlugs, publicListingCards } from '@/lib/listing-privacy';
import { ListingGrid } from './ListingGrid';

export interface RelatedListingsProps {
  categorySlug: string;
  categoryName: string;
  /** The profile being viewed, so it is never recommended beside itself. */
  excludeSlug: string;
  limit?: number;
}

/**
 * "More in this category", read from the same search service the results page
 * uses — so the recommendations obey publication status, and the cards are the
 * identical category-aware cards.
 *
 * Server Component: it calls the service directly. The caller wraps it in a
 * `<Suspense>` boundary, because it reads the database.
 */
export async function RelatedListings({
  categorySlug,
  categoryName,
  excludeSlug,
  limit = 3,
}: RelatedListingsProps) {
  const query = searchQuerySchema.parse({
    category: categorySlug,
    page: 1,
    pageSize: Math.min(limit + 1, 8),
    sort: 'recommended',
  });

  const result = await searchPublicListings({ query, rawParams: {}, basePath: '/vendors' });
  const revealed = await getRevealedSlugs();
  // Filter on the real slug *before* masking: a masked card carries an opaque
  // reference in `slug`, which would never match `excludeSlug` and the profile
  // would recommend itself.
  const cards = publicListingCards(
    result.cards.filter((card) => card.slug !== excludeSlug),
    revealed,
  ).slice(0, limit);

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="related-listings">
      <SectionHeading
        id="related-listings"
        title={`More in ${categoryName}`}
        action={
          <Button
            component={Link}
            href={`/vendors?category=${encodeURIComponent(categorySlug)}`}
            variant="default"
            size="sm"
          >
            See all {categoryName.toLowerCase()}
          </Button>
        }
      />
      <ListingGrid listings={cards} label={`More ${categoryName} listings`} />
    </section>
  );
}
