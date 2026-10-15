import Link from 'next/link';
import { SiteShell } from '@/components/layout/SiteShell';
import { Button, ClientLink, Container, PageHeader, Prose, Surface } from '@/components/ui';

/**
 * 404 surface.
 *
 * Next injects `robots: noindex` for this route automatically, so it is not
 * given a `metadata` export. The useful thing a lost visitor needs is a way
 * back into the catalogue, not an apology, so both routes out are real links.
 *
 * The prose lives in the shared `Prose` primitive rather than in four Mantine
 * gaps, so this page's measure and paragraph rhythm are the same as the legal
 * pages it links to.
 */
export default function NotFound() {
  return (
    <SiteShell>
      <Container size="prose" className="surface--editorial">
        <PageHeader
          eyebrow="404"
          title="We could not find that page"
          description="The address may be mistyped, or the page may have moved or been removed. Nothing is broken on your side."
        />

        <Surface tone="muted" padding="lg">
          <Prose>
            <p>
              The quickest way back is to browse the catalogue. Every category page lists its
              subcategories with real listing counts, and the vendor list can be narrowed by city,
              budget and guest count.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-stack-gap)' }}>
              <Button component={ClientLink} href="/">
                Go to the homepage
              </Button>
              <Button component={ClientLink} href="/categories" variant="secondary">
                Browse categories
              </Button>
            </div>

            <p>
              Looking for something specific? <Link href="/vendors">Search every vendor</Link>, or{' '}
              <Link href="/track">track an enquiry</Link> with its reference code.
            </p>
          </Prose>
        </Surface>
      </Container>
    </SiteShell>
  );
}
