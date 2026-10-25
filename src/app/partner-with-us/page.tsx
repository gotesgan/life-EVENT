import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { IconCheck } from '@tabler/icons-react';
import { SiteShell } from '@/components/layout/SiteShell';
import { VendorApplicationForm } from '@/components/vendor/VendorApplicationForm';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { Surface } from '@/components/ui/Surface';
import { listCategories } from '@/server/services/catalog.service';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'List your business',
  description:
    'Register a wedding or event business on Live Envt. Tell us the business name, what kind of vendor you are, a contact number and what you offer.',
  alternates: { canonical: '/partner-with-us' },
};

const REASONS: readonly { title: string; body: string }[] = [
  {
    title: 'Enquiries, not phone calls',
    body: 'Every lead arrives as a written enquiry with the event date, guest count and requirements already attached.',
  },
  {
    title: 'You control what is published',
    body: 'Prices, capacity and facilities are yours to publish or withhold. Nothing is invented on your behalf.',
  },
  {
    title: 'No fee to apply',
    body: 'Send the form and the team calls the number you give. Listing is free while the launch catalogue is being built.',
  },
];

const STEPS: readonly string[] = [
  'Send this form — four fields, no documents yet.',
  'We call the number you gave to confirm the business.',
  'Your listing is built with the prices and details you choose.',
];

/** Vendor types are the catalogue's leaf categories — the concrete businesses. */
async function VendorTypeOptions() {
  await connection();

  // `listCategories()` returns the tree, so the leaf options are the children of
  // every root — the concrete businesses a vendor can identify as.
  const roots = await listCategories();
  const leaves = roots
    .flatMap((category) => category.children)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <VendorApplicationForm
      vendorTypes={leaves.map((category) => ({ value: category.slug, label: category.name }))}
    />
  );
}

function FormSkeleton() {
  return (
    <div className={classes.formSkeleton} aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <span key={index} className={classes.skeletonRow} />
      ))}
    </div>
  );
}

export default function PartnerWithUsPage() {
  return (
    <SiteShell>
      <Container>
        <PageHeader
          title="List your business on Live Envt"
          description="Reach couples and companies who are already comparing published prices. Send the short form and the team gets in touch."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'List your business' }]}
        />

        {/*
         * Two panels of equal height, not a loose column beside a card.
         *
         * The old layout put bare text on the left and a padded card on the
         * right, so the two columns' first lines sat ~36px apart (the card's
         * padding) and their bottom edges never matched. Giving the pitch its own
         * muted panel means both columns share one inner inset, one top edge and
         * one bottom edge; the steps block is pinned to the foot of its panel so
         * the two bottom borders line up whatever the form's height.
         */}
        <div className={classes.layout}>
          <Surface tone="muted" padding="lg" className={classes.pitchCard}>
            <h2 className={classes.panelTitle}>Why list with us</h2>

            <ul className={classes.reasons}>
              {REASONS.map((reason) => (
                <li key={reason.title} className={classes.reason}>
                  <span className={classes.reasonIcon} aria-hidden>
                    <IconCheck size="0.875rem" stroke={2} />
                  </span>
                  <div>
                    <h3 className={classes.reasonTitle}>{reason.title}</h3>
                    <p className={classes.reasonBody}>{reason.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className={classes.who}>
              <h3 className={classes.whoTitle}>Who can list</h3>
              <p className={classes.whoBody}>
                Venues, photographers and film-makers, planners and decorators, caterers, beauty
                artists, entertainers, stationers, rental and transport businesses — and corporate
                suppliers for conferences, launches and team offsites.
              </p>
            </div>

            <div className={classes.steps}>
              <h3 className={classes.stepsTitle}>What happens next</h3>
              <ol className={classes.stepList}>
                {STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </Surface>

          <Surface tone="raised" padding="lg" elevated className={classes.formCard}>
            <h2 className={classes.panelTitle}>Register your business</h2>
            <p className={classes.panelLede}>
              Four fields. No catalogue documents, no payment details, no account.
            </p>
            <Suspense fallback={<FormSkeleton />}>
              <VendorTypeOptions />
            </Suspense>
          </Surface>
        </div>
      </Container>
    </SiteShell>
  );
}
