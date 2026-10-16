import type { Metadata } from 'next';
import Link from 'next/link';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container, PageHeader, Prose, Surface } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The terms for using Live Envt: what the service is, what it is not, your responsibilities when you send an enquiry, and acceptable use.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <SiteShell>
      <Container size="prose" className="surface--editorial">
        <PageHeader
          title="Terms of use"
          description="Plain terms for a plain service. Live Envt helps you find businesses and send them an enquiry. Nothing more is promised here."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Terms' }]}
        />

        <PageSection title="What the service does">
          <Prose>
            <p>
              Live Envt publishes listings for wedding and event businesses, lets you filter them,
              and passes your enquiry to the businesses you choose. That is the whole service.
            </p>
            <p>
              We are not a party to any arrangement you make with a business. We do not book dates,
              hold availability, take payment or act as an agent for either side. Any agreement,
              quote or contract is between you and the business.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="Business details and prices">
          <Prose>
            <p>
              Prices, capacity, inclusions and photographs come from the business. They can change
              and they can be out of date. Treat a listing as what the business has published, and
              confirm the final details with them before you rely on anything.
            </p>
            <p>
              A &ldquo;top pick&rdquo; marks a listing our team chose to highlight. It does not mean
              we recommend the business, guarantee its work, or have inspected anything it does.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="Your account">
          <Prose>
            <ul>
              <li>
                Give accurate details. An enquiry is only useful if the business can reach you.
              </li>
              <li>
                Keep your password to yourself; you are responsible for activity under your account.
              </li>
              <li>
                There is no password reset yet. If you lose your password, see{' '}
                <Link href="/contact">contact</Link>.
              </li>
              <li>
                One person, one account. Do not share an account or use someone else&rsquo;s details
                to send an enquiry.
              </li>
            </ul>
          </Prose>
        </PageSection>

        <PageSection title="Sending enquiries">
          <Prose>
            <p>
              Send enquiries for real events, to businesses you actually want to hear from. Our
              system limits how often an enquiry can be sent and merges requests that look like
              repeats of one you already sent, so a double submission becomes one enquiry rather
              than two.
            </p>
            <p>
              You can cancel an enquiry from your account while the businesses are still being
              contacted. Once your details have been shared with a business, cancelling on the site
              will not end the conversation — speak to the business directly.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="Acceptable use">
          <Surface tone="muted" padding="md">
            <Prose>
              <p>Do not:</p>
              <ul>
                <li>send bulk, automated or misleading enquiries;</li>
                <li>
                  scrape, harvest or republish listings, contact details or content from this site;
                </li>
                <li>impersonate anyone, or misrepresent your event;</li>
                <li>attempt to access accounts, enquiries or data that are not yours;</li>
                <li>use the service for anything unlawful.</li>
              </ul>
            </Prose>
          </Surface>
        </PageSection>

        <PageSection title="Changes and availability">
          <Prose>
            <p>
              Listings are added, updated and removed as businesses and our team maintain them, and
              the service may be unavailable while it is worked on. We may suspend or close an
              account that abuses the service.
            </p>
            <p>
              We may change these terms. When we do, this page is the current version — there is no
              separate document to hunt for.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="Your data">
          <Prose>
            <p>
              What we collect, why, and what we deliberately do not collect is set out in the{' '}
              <Link href="/privacy">privacy notice</Link>. Read it alongside these terms; it is
              written for the same build you are using.
            </p>
          </Prose>
        </PageSection>
      </Container>
    </SiteShell>
  );
}
