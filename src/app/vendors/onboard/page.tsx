import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { SiteShell } from '@/components/layout/SiteShell';
import { VendorOnboardingForm } from '@/components/vendor/VendorOnboardingForm';
import { Container } from '@/components/ui/Container';
import { Surface } from '@/components/ui/Surface';
import { listCategories, listLocations } from '@/server/services/catalog.service';
import { resolveVendorInvite } from '@/server/services/vendor-invite.service';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Complete your listing',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ t?: string | string[] }>;

function tokenFrom(params: { t?: string | string[] }): string | null {
  const value = Array.isArray(params.t) ? params.t[0] : params.t;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Surface tone="muted" padding="lg" className={classes.message}>
      <h1 className={classes.messageTitle}>{title}</h1>
      <p className={classes.messageBody}>{body}</p>
    </Surface>
  );
}

/**
 * The private onboarding form behind a vendor invite link.
 *
 * No account, no login: the token is the credential. Every terminal state the
 * link can be in gets its own sentence — expired, revoked, already submitted,
 * invalid — because "something went wrong" tells a vendor nothing and produces a
 * support email either way.
 */
async function InviteContent({ searchParams }: { searchParams: SearchParams }) {
  // Request-time only: a token in the URL must never be part of a prerendered
  // shell, and the invite state is checked against the database on every load.
  await connection();

  const token = tokenFrom(await searchParams);
  if (!token) {
    return (
      <Message
        title="This link is incomplete"
        body="Open the link exactly as it was sent to you. If it still does not work, reply to the email and we will send a new one."
      />
    );
  }

  const invite = await resolveVendorInvite(token);

  if (invite.state === 'invalid') {
    return (
      <Message
        title="This link is not valid"
        body="Check that you copied the whole link. If it still does not open, reply to the email and we will send a new one."
      />
    );
  }
  if (invite.state === 'expired') {
    return (
      <Message
        title="This link has expired"
        body="For security, onboarding links last fourteen days. Reply to the email and the team will send a fresh one."
      />
    );
  }
  if (invite.state === 'revoked') {
    return (
      <Message
        title="This link was withdrawn"
        body="The team has closed this invite. Reply to the email if you still want your business listed."
      />
    );
  }
  if (invite.state === 'submitted') {
    return (
      <Message
        title="Your details are already with us"
        body="This form has been submitted. The team reviews it and publishes the listing after checking prices and photos."
      />
    );
  }

  const [roots, cities] = await Promise.all([listCategories(), listLocations({ type: 'CITY' })]);

  const vendorTypes = roots
    .flatMap((category) => category.children)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => ({ value: category.slug, label: category.name }));

  return (
    <div className={classes.layout}>
      <div>
        <p className={classes.eyebrow}>Listing onboarding</p>
        <h1 className={classes.title}>Add the details of your business</h1>
        <p className={classes.lede}>
          This is what appears on your public listing. The team reviews it before publishing, so
          check the prices and description carefully. Nothing is published without your approval of
          these details.
        </p>
        <p className={classes.expiry}>
          This link is single-use and expires on{' '}
          {invite.expiresAt.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
      </div>

      <Surface tone="raised" padding="lg">
        <VendorOnboardingForm
          token={token}
          vendorTypes={vendorTypes}
          cities={cities.map((city) => ({ value: city.slug, label: city.name }))}
          defaults={{
            businessName: invite.businessName,
            contactEmail: invite.email,
          }}
        />
      </Surface>
    </div>
  );
}

export default function VendorOnboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <SiteShell>
      <Container size="prose" className={classes.page}>
        <Suspense fallback={<div className={classes.loading} aria-hidden />}>
          <InviteContent searchParams={searchParams} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
