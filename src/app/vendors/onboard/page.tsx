import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from '@/components/ui/ClientLink';
import { BrandMark } from '@/components/ui/BrandMark';
import { Surface } from '@/components/ui/Surface';
import { VendorOnboardingForm } from '@/components/vendor/VendorOnboardingForm';
import { listCategories, listLocations } from '@/server/services/catalog.service';
import { resolveVendorInvite } from '@/server/services/vendor-invite.service';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Vendor onboarding',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ t?: string | string[] }>;

function tokenFrom(params: { t?: string | string[] }): string | null {
  const value = Array.isArray(params.t) ? params.t[0] : params.t;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * A terminal state for the link: invalid, expired, revoked or already submitted.
 * Presented as its own centred card inside the onboarding shell, not as an error
 * page of the public site.
 */
function Message({ title, body }: { title: string; body: string }) {
  return (
    <Surface tone="raised" padding="lg" className={classes.message}>
      <p className={classes.messageEyebrow}>Vendor onboarding</p>
      <h1 className={classes.messageTitle}>{title}</h1>
      <p className={classes.messageBody}>{body}</p>
    </Surface>
  );
}

/** The quiet facts a vendor needs before filling the form. */
const CHECKLIST = [
  'The business name, category and city you want to appear in.',
  'A contact person, phone number and email the team can verify.',
  'What you offer, in your own words — services, capacity, anything a customer should know.',
] as const;

const NEXT_STEPS = [
  { step: '01', label: 'Send your details', note: 'This form' },
  { step: '02', label: 'The team reviews', note: 'Prices and wording checked' },
  { step: '03', label: 'Your listing goes live', note: 'Customers can enquire' },
] as const;

/**
 * The private onboarding flow behind a vendor invite link.
 *
 * Deliberately **not** wrapped in `SiteShell`: this is an app-like onboarding
 * surface for a business, not a page of the marketplace. It keeps a minimal
 * branded header and no footer or public navigation, so a vendor never feels
 * they have wandered into the customer-facing site mid-task.
 *
 * No account, no login: the token is the credential. Every terminal state the
 * link can be in gets its own sentence — expired, revoked, already submitted,
 * invalid — because "something went wrong" tells a vendor nothing.
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

  const expiry = invite.expiresAt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={classes.layout}>
      <aside className={classes.intro} aria-label="About this form">
        <p className={classes.eyebrow}>Vendor onboarding</p>
        <h1 className={classes.title}>Add the details of your business</h1>
        <p className={classes.lede}>
          This is what appears on your public listing. The team reviews it before publishing, so
          check the prices and description carefully. Nothing is published without your approval of
          these details.
        </p>

        <div className={classes.checklistBlock}>
          <h2 className={classes.blockTitle}>What you will need</h2>
          <ul className={classes.checklist}>
            {CHECKLIST.map((item) => (
              <li key={item} className={classes.checklistItem}>
                <span className={classes.checkmark} aria-hidden>
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ol className={classes.steps} aria-label="What happens next">
          {NEXT_STEPS.map((item) => (
            <li key={item.step} className={classes.step}>
              <span className={classes.stepNumber} aria-hidden>
                {item.step}
              </span>
              <span className={classes.stepBody}>
                <span className={classes.stepLabel}>{item.label}</span>
                <span className={classes.stepNote}>{item.note}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className={classes.expiry}>
          This private link is single-use and expires on {expiry}. Only the team and you can open
          it.
        </p>
      </aside>

      <Surface tone="raised" padding="lg" elevated className={classes.formCard}>
        <div className={classes.formHead}>
          <div>
            <p className={classes.formEyebrow}>Private intake</p>
            <h2 className={classes.formTitle}>Listing details</h2>
          </div>
          <span className={classes.draftBadge}>Draft</span>
        </div>
        <p className={classes.formNote}>
          Everything here can be changed after the team reviews it. Nothing is sent to customers
          yet.
        </p>

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
    <div className={classes.app}>
      {/*
        A minimal app header: brand + what this surface is. No public navigation,
        no utility strip, and deliberately no footer — this flow ends with the
        vendor's own success card, not the marketplace's chrome.
      */}
      <header className={classes.topbar}>
        <div className={classes.topbarInner}>
          <Link href="/" className={classes.brand} aria-label="Life Events — home">
            <BrandMark size="sm" />
          </Link>
          <span className={classes.topbarDivider} aria-hidden />
          <span className={classes.topbarLabel}>Vendor onboarding</span>
          <span className={classes.privateTag}>Private link</span>
        </div>
      </header>

      <main className={classes.main}>
        <Suspense fallback={<div className={classes.loading} aria-hidden />}>
          <InviteContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
