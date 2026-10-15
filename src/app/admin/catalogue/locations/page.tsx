import { Suspense } from 'react';
import { connection } from 'next/server';
import { Stack } from '@mantine/core';
import { PageHeader, Surface, TableSkeleton } from '@/components/ui';
import { listLocationRows } from '../_lib/data';
import { describeError } from '../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { LocationsAdmin } from '@/components/admin/catalogue/LocationsAdmin';

export const metadata = { title: 'Locations' };

export default function AdminLocationsPage() {
  return (
    <Stack gap="lg">
      <Suspense fallback={<TableSkeleton rows={8} columns={2} />}>
        <LocationsContent />
      </Suspense>
    </Stack>
  );
}

async function LocationsContent() {
  // Request-time by definition: this is an authenticated catalogue screen.
  await connection();

  let rows: Awaited<ReturnType<typeof listLocationRows>>;
  try {
    rows = await listLocationRows();
  } catch (error) {
    return <RetryState title="Could not load locations" detail={describeError(error)} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Locations"
        description="The geographic hierarchy customers browse by. The materialised path shown on each node is generated from its parent chain."
      />

      <Surface padding="md" tone="raised" as="section">
        <LocationsAdmin rows={rows} />
      </Surface>
    </>
  );
}
