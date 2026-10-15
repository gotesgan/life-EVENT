import { Suspense } from 'react';
import { connection } from 'next/server';
import { Stack } from '@mantine/core';
import { PageHeader, Surface, TableSkeleton } from '@/components/ui';
import { listAttributeRows } from '../_lib/data';
import { describeError } from '../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { AttributesAdmin } from '@/components/admin/catalogue/AttributesAdmin';

export const metadata = { title: 'Attributes' };

export default function AdminAttributesPage() {
  return (
    <Stack gap="lg">
      <Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
        <AttributesContent />
      </Suspense>
    </Stack>
  );
}

async function AttributesContent() {
  // Request-time by definition: this is an authenticated catalogue screen.
  await connection();

  let rows: Awaited<ReturnType<typeof listAttributeRows>>;
  try {
    rows = await listAttributeRows();
  } catch (error) {
    return <RetryState title="Could not load attributes" detail={describeError(error)} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Attributes"
        description="The structured facts a listing can carry. Define an attribute once here, then bind it to each category that should collect it."
      />

      <Surface padding="md" tone="raised" as="section">
        <AttributesAdmin rows={rows} />
      </Surface>
    </>
  );
}
