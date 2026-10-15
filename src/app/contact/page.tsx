import type { Metadata } from 'next';
import Link from 'next/link';
import { PageSection } from '@/components/layout/PageSection';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container, PageHeader, Prose, Surface } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'How to reach Live Envt about an enquiry: send a new enquiry, track one with its reference code, or manage it from your account.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <SiteShell>
      <Container size="prose" className="surface--editorial">
        <PageHeader
          title="How to reach us"
          description="The routes below are the ones that work today. Everything about an enquiry is handled through the enquiry itself, so a reference code is the fastest way to get a useful answer."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
        />

        <PageSection title="About an enquiry you have already sent">
          <Prose>
            <p>Use the reference code that came with your enquiry. From there you can:</p>
            <ul>
              <li>
                <Link href="/track">Track the enquiry</Link> with the reference code and the email
                address you used — no account needed.
              </li>
              <li>
                <Link href="/account/enquiries">Open it in your account</Link> if you were signed in
                when you sent it. You can see every stage, the businesses involved, and the history.
              </li>
              <li>
                Cancel it from the enquiry page while the businesses are still being contacted. Once
                details have been shared with a business, that business is the right place to
                continue the conversation.
              </li>
            </ul>
          </Prose>
        </PageSection>

        <PageSection title="Sending a new enquiry">
          <Prose>
            <p>
              <Link href="/enquire">Send an enquiry</Link> after choosing the businesses you are
              interested in. You can add up to ten businesses to one enquiry and describe the event
              once.
            </p>
            <p>
              If you are still looking, start from <Link href="/categories">the category list</Link>{' '}
              or <Link href="/vendors">search every vendor</Link>.
            </p>
          </Prose>
        </PageSection>

        <PageSection title="A general enquiry or a complaint">
          <Surface tone="muted" padding="md">
            <Prose>
              <p>
                This build does not have a general contact form, and no public support address or
                phone number is configured for it. We are saying that plainly rather than showing a
                form that cannot send anything.
              </p>
              <p>
                If you have an account and your problem is about an enquiry,{' '}
                <Link href="/account/enquiries">open that enquiry</Link> — the reference code is
                what lets us find it. If the problem is about a business&rsquo;s published details,
                reply to the message you already have from that business.
              </p>
            </Prose>
          </Surface>
        </PageSection>
      </Container>
    </SiteShell>
  );
}
