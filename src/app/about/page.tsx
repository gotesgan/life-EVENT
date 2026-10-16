import type { Metadata } from 'next';
import Link from 'next/link';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container, PageHeader, Prose, Surface } from '@/components/ui';

export const metadata: Metadata = {
  title: 'About Live Envt',
  description:
    'Live Envt is a discovery and enquiry platform for wedding and event businesses. Here is exactly what it does, what it publishes and what it deliberately does not do.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <SiteShell>
      <Container size="prose" className="surface--editorial">
        <PageHeader
          title="What Live Envt is for"
          description="Finding a wedding or event business should not mean calling ten numbers to learn ten prices."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]}
        />

        <PageSection title="Compare first, enquire once">
          <Prose>
            <p>
              Live Envt is a directory of wedding and event businesses — venues, photographers,
              decorators, caterers, beauty studios, entertainers and more. Each profile shows what
              that business has chosen to publish: its price, capacity, what it includes, and where
              it works.
            </p>
            <p>
              When you find businesses you are interested in, you describe your event once and send
              one enquiry to up to ten of them. That is the whole flow. It exists so you can compare
              on your own time instead of repeating the same conversation.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="What we publish, and what we do not">
          <Prose>
            <p>
              Every detail on a profile comes from the business. Where a business has published
              nothing for a field, the page says so rather than guessing a typical price or a round
              number.
            </p>
            <p>
              A &ldquo;top pick&rdquo; is a listing our team has chosen to highlight. It is an
              editorial choice, not a paid placement and not a promise about the business — a
              listing without it is no less worth your time.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="How an enquiry works">
          <Prose>
            <ul>
              <li>
                You choose the businesses and describe your event: type, date, guest count, budget
                and any specific requirements.
              </li>
              <li>
                You receive a reference code. Quote it whenever you contact us about that enquiry.
              </li>
              <li>
                You can follow the enquiry on the site with the reference code and the email address
                you used, or keep it together with the rest of your enquiries in an account.
              </li>
              <li>
                As each business responds, the stage on that enquiry changes, and the history is
                visible to you.
              </li>
            </ul>
          </Prose>
        </PageSection>

        <PageSection title="What this site is not">
          <Surface tone="muted" padding="md">
            <Prose>
              <p>
                Live Envt is not a booking system and not a payment system. No contract is formed
                here, and no money changes hands on this site. Once an enquiry is under way, the
                arrangement is between you and the business.
              </p>
              <p>
                There are no ratings, reviews or testimonials on this build, because we have not
                collected any. We would rather show nothing than show something invented.
              </p>
            </Prose>
          </Surface>
        </PageSection>

        <PageSection title="Where to go next">
          <Prose>
            <p>
              <Link href="/categories">Browse every category</Link> to see what is published, or{' '}
              <Link href="/vendors">search all vendors</Link> and narrow by city, budget and
              capacity.
            </p>
            <p>
              Questions about how we handle your details are answered in the{' '}
              <Link href="/privacy">privacy notice</Link>. If you want to reach a person, see{' '}
              <Link href="/contact">contact</Link>.
            </p>
          </Prose>
        </PageSection>
      </Container>
    </SiteShell>
  );
}
