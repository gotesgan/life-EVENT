import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton, Stack } from '@mantine/core';
import { TrackForm } from '@/components/enquiry/TrackForm';
import { normaliseSearchParams, type RawSearchParams } from '@/components/filters/searchParams';
import { SiteShell } from '@/components/layout/SiteShell';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import classes from './page.module.css';

export const metadata: Metadata = {
  title: 'Track an enquiry',
  description:
    'Enter the reference code from your enquiry and the email you used to see the current stage of each business you contacted.',
  robots: { index: false, follow: true },
};

function TrackSkeleton() {
  return (
    <Stack gap="lg" aria-hidden>
      <Skeleton height={180} radius="md" />
      <Skeleton height={140} radius="md" />
    </Stack>
  );
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = normaliseSearchParams(await searchParams);

  return (
    <SiteShell>
      <Container size="prose">
        <PageHeader
          title="Track an enquiry"
          description="Enter your reference code and the email you used. You do not need an account."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Track an enquiry' }]}
        />

        <div className={classes.content}>
          <Suspense fallback={<TrackSkeleton />}>
            <TrackForm
              initialReference={params.reference ?? ''}
              initialEmail={params.email ?? ''}
            />
          </Suspense>
        </div>
      </Container>
    </SiteShell>
  );
}
