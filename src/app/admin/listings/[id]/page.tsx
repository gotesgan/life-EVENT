import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Stack } from '@mantine/core';
import { PageHeader, TableSkeleton } from '@/components/ui';
import { getServerEnv } from '@/lib/env';
import { isAppError } from '@/lib/errors';
import { loadListingEditor } from '../../_lib/listing-editor';
import { describeError } from '../../_lib/errors';
import {
  amenitySelectOptions,
  categorySelectOptions,
  eventTypeSelectOptions,
  locationSelectOptions,
} from '../../_lib/options';
import { RetryState } from '@/components/admin/RetryState';
import { ListingEditor } from '@/components/admin/listing-editor/ListingEditor';

export const metadata = { title: 'Edit listing' };

/**
 * The edit screen reads the listing, the categories it could move to and the
 * attribute fields its categories define — all inside one Suspense boundary, so
 * a slow query streams behind a skeleton instead of holding the page.
 */
export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Edit listing"
        description="Update the provider record, its attributes and its gallery. Changes are audited."
      />

      <Suspense fallback={<TableSkeleton rows={8} columns={2} />}>
        <EditListingForm id={id} />
      </Suspense>
    </Stack>
  );
}

async function EditListingForm({ id }: { id: string }) {
  const [editorResult, categories, locations, eventTypes, amenities] = await Promise.all([
    loadListingEditor(id)
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, error })),
    categorySelectOptions(false),
    locationSelectOptions(true),
    eventTypeSelectOptions(),
    amenitySelectOptions(),
  ]);

  if (!editorResult.ok) {
    if (isAppError(editorResult.error) && editorResult.error.code === 'NOT_FOUND') {
      notFound();
    }
    return (
      <RetryState title="Could not load this listing" detail={describeError(editorResult.error)} />
    );
  }

  return (
    <ListingEditor
      mode="edit"
      listing={editorResult.value}
      categories={categories}
      locations={locations}
      eventTypes={eventTypes}
      amenities={amenities}
      maxUploadBytes={getServerEnv().MEDIA_MAX_UPLOAD_BYTES}
    />
  );
}
