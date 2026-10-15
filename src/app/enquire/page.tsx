import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { EnquiryForm, type ProviderOption } from '@/components/enquiry/EnquiryForm';
import { normaliseSearchParams, type RawSearchParams } from '@/components/filters/searchParams';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { cx } from '@/components/ui/cx';
import { readSelectedListings } from '@/lib/filter-state';
import { getOptionalUser } from '@/lib/auth/actor';
import { PRIVACY_POLICY_VERSION } from '@/lib/validation/enquiry';
import { getAccountOverview } from '@/server/services/account.service';
import { listEventTypes, listLocations } from '@/server/services/catalog.service';
import { getPublicListingSummariesBySlugs } from '@/server/services/listing.service';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Send an enquiry',
  description:
    'One short form, sent to the wedding and event businesses you choose. Tell them about your event once and track every reply with a reference code.',
  /**
   * A pre-filled enquiry is a private, per-visitor view; it carries no content a
   * search engine should index, so it stays out of the index while remaining
   * crawlable through to the vendor profiles it links back to.
   */
  robots: { index: false, follow: true },
};

const MAX_PROVIDERS = 10;

function FormSkeleton() {
  return (
    <Stack gap="lg" aria-hidden>
      <Skeleton height={28} width="42%" radius="sm" />
      <Skeleton height={120} radius="md" />
      <Skeleton height={28} width="34%" radius="sm" />
      <Skeleton height={180} radius="md" />
      <Skeleton height={48} width={180} radius="md" />
    </Stack>
  );
}

/**
 * Resolves the slugs from `?enquire=` into the minimal provider shape the form
 * needs. Unpublished or unknown slugs are dropped rather than passed on, because
 * sending one would make the whole submission a 400 for the user.
 */
/**
 * Resolves the chosen business slugs to the identity the form renders.
 *
 * One query for all of them. This previously called `getPublicListingBySlug`
 * once per slug, so a ten-business brief ran ten concurrent loads of ten
 * relations each to display ten names.
 */
async function resolveProviders(slugs: readonly string[]): Promise<{
  providers: ProviderOption[];
  droppedCount: number;
}> {
  const providers = await getPublicListingSummariesBySlugs(slugs);
  return { providers, droppedCount: slugs.length - providers.length };
}

async function EnquireContent({ slugs }: { slugs: string[] }) {
  const [cities, eventTypes, user, { providers, droppedCount }] = await Promise.all([
    listLocations({ type: 'CITY' }),
    listEventTypes(),
    getOptionalUser(),
    resolveProviders(slugs),
  ]);

  // A signed-in customer has a saved profile, so the form arrives filled in.
  // The session itself carries no phone number, so the profile is the only
  // honest source for that field — it is never guessed from the enquiry.
  const account = user ? await getAccountOverview(user.id) : null;

  return (
    <div className={cx(classes.content, 'surface--editorial')}>
      {droppedCount > 0 ? (
        <p className={classes.notice} role="status">
          <IconAlertTriangle className={classes.noticeIcon} size="1rem" stroke={1.5} aria-hidden />
          {droppedCount === 1
            ? 'One business from your link is no longer accepting enquiries, so it was removed.'
            : `${droppedCount} businesses from your link are no longer accepting enquiries, so they were removed.`}
        </p>
      ) : null}

      <EnquiryForm
        providers={providers}
        cityOptions={cities.map((city) => ({ value: city.slug, label: city.name }))}
        eventTypeOptions={eventTypes.map((eventType) => ({
          value: eventType.slug,
          label: eventType.name,
        }))}
        policyVersion={PRIVACY_POLICY_VERSION}
        initialValues={
          user
            ? {
                contactName: account?.user.name ?? user.name,
                contactEmail: account?.user.email ?? user.email,
                contactPhone: account?.profile.phone ?? undefined,
                contactCitySlug: account?.profile.city?.slug ?? undefined,
                contactMethod: account?.profile.preferredContactMethod,
              }
            : undefined
        }
      />
    </div>
  );
}

export default async function EnquirePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawParams = await searchParams;
  const slugs = Array.from(new Set(readSelectedListings(normaliseSearchParams(rawParams)))).slice(
    0,
    MAX_PROVIDERS,
  );

  return (
    <SiteShell>
      <Container>
        <PageHeader
          title="Send an enquiry"
          description="Tell the businesses you chose about your event once. They reply to you directly, and you can track every reply with one reference code."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Send an enquiry' }]}
        />

        <Suspense fallback={<FormSkeleton />}>
          <EnquireContent slugs={slugs} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}
