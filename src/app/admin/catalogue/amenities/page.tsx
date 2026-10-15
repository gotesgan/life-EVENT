import { Suspense } from 'react';
import { connection } from 'next/server';
import { Stack } from '@mantine/core';
import { PageHeader, Surface, TableSkeleton } from '@/components/ui';
import { listAmenityRows } from '../_lib/data';
import { describeError } from '../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { AmenitiesAdmin } from '@/components/admin/catalogue/AmenitiesAdmin';

export const metadata = { title: 'Amenities' };

export default function AdminAmenitiesPage() {
  return (
    <Stack gap="lg">
      <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
        <AmenitiesContent />
      </Suspense>
    </Stack>
  );
}

async function AmenitiesContent() {
  // Request-time by definition: this is an authenticated catalogue screen.
  await connection();

  let rows: Awaited<ReturnType<typeof listAmenityRows>>;
  try {
    rows = await listAmenityRows();
  } catch (error) {
    return <RetryState title="Could not load amenities" detail={describeError(error)} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Amenities"
        description="Facilities and services a listing can offer. Amenities are grouped so a long list stays scannable on the public profile."
      />

      <Surface padding="md" tone="raised" as="section">
        <AmenitiesAdmin rows={rows} />
      </Surface>
    </>
  );
}
