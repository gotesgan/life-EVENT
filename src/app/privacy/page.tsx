import type { Metadata } from 'next';
import Link from 'next/link';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container, PageHeader, Prose, Surface } from '@/components/ui';
import { PRIVACY_POLICY_VERSION } from '@/lib/validation/enquiry';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description:
    'What Live Envt collects when you send an enquiry or create an account, why it is collected, how consent is recorded, and what is deliberately not collected.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <Container size="prose" className="surface--editorial">
        <PageHeader
          title="Privacy notice"
          description="This notice describes what this build actually does. Where something a full privacy programme would include is missing, it is named as missing rather than implied."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Privacy' }]}
        />

        <PageSection title="What the enquiry form collects">
          <Prose>
            <p>When you send an enquiry, you give us:</p>
            <ul>
              <li>Your name, email address and phone number.</li>
              <li>
                Your event brief: the event type, date and whether it is flexible, guest count,
                budget range, the city the event is in, any requirements you write out, and how you
                heard about us if you tell us.
              </li>
              <li>Your chosen contact method, so the businesses know how to reach you first.</li>
              <li>
                A record that you accepted this notice, the version of the notice you accepted, and
                when you accepted it.
              </li>
            </ul>
          </Prose>
        </PageSection>

        <PageSection title="Why we hold it">
          <Prose>
            <p>
              The brief and your contact details exist so the businesses you selected can respond to
              your enquiry, and so our team can pass it to them and follow it up. The consent record
              exists so there is a verifiable answer to &ldquo;what did this person agree to, and
              when?&rdquo;.
            </p>
            <p>
              The current notice version is <strong>{PRIVACY_POLICY_VERSION}</strong>. It is stored
              against each enquiry you send, so a later change to this page cannot rewrite what you
              agreed to.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="Who sees what">
          <Prose>
            <p>
              The businesses you chose to enquire with see your brief and the contact details needed
              to respond. Our team sees the enquiry in order to route and follow it up.
            </p>
            <p>
              When you view an enquiry in your account, you see a customer version of it. Internal
              working notes, staff assignments and internal status flags are not part of that view —
              they are excluded before the page is built, not hidden afterwards.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="Tracking an enquiry without an account">
          <Prose>
            <p>
              You do not need an account to follow an enquiry. Tracking needs two things together:
              the reference code we gave you and the email address you used. Neither alone will
              reveal anything, and repeated attempts are rate limited.
            </p>
            <p>
              If you do create an account, we store your name, email and password, plus the profile
              details you choose to add: phone, city, preferred contact method, and whether you want
              email updates.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="What we do not collect">
          <Surface tone="muted" padding="md">
            <Prose>
              <p>
                We do not store your raw IP address. To investigate abuse we keep a salted hash of
                it — a one-way value that cannot be turned back into the address — together with the
                browser identification string your request carried.
              </p>
              <p>
                We do not collect payment details, because no payment happens on this site. We do
                not run advertising or third-party tracking scripts on these pages.
              </p>
            </Prose>
          </Surface>
        </PageSection>

        <PageSection title="What is not built yet">
          <Prose>
            <p>This build does not yet provide:</p>
            <ul>
              <li>a way to export the data we hold about you;</li>
              <li>a self-service account deletion flow;</li>
              <li>an automatic expiry that removes old enquiries after a fixed period;</li>
              <li>a one-click way to withdraw consent and stop follow-up;</li>
              <li>email verification for your account.</li>
            </ul>
            <p>
              These are real gaps, not choices we are presenting as features. See{' '}
              <Link href="/contact">contact</Link> for how to raise a request about your data in the
              meantime, and <Link href="/terms">the terms</Link> for how the service may be used.
            </p>
          </Prose>
        </PageSection>
      </Container>
    </SiteShell>
  );
}
