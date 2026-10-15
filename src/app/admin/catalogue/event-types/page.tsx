import { Suspense } from 'react';
import { connection } from 'next/server';
import { Stack } from '@mantine/core';
import { PageHeader, Surface, TableSkeleton } from '@/components/ui';
import { listEventTypeRows } from '../_lib/data';
import { describeError } from '../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { EventTypesAdmin } from '@/components/admin/catalogue/EventTypesAdmin';

export const metadata = { title: 'Event types' };

export default function AdminEventTypesPage() {
  return (
    <Stack gap="lg">
      <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
        <EventTypesContent />
      </Suspense>
    </Stack>
  );
}

async function EventTypesContent() {
  // Request-time by definition: this is an authenticated catalogue screen.
  await connection();

  let rows: Awaited<ReturnType<typeof listEventTypeRows>>;
  try {
    rows = await listEventTypeRows();
  } catch (error) {
    return <RetryState title="Could not load event types" detail={describeError(error)} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Event types"
        description="The occasions customers are planning. These drive the event-type filter on search and the picker on the enquiry form."
      />

      <Surface padding="md" tone="raised" as="section">
        <EventTypesAdmin rows={rows} />
      </Surface>
    </>
  );
}
