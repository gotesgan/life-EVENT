import { Suspense } from 'react';
import { Stack } from '@mantine/core';
import { PageHeader, TableSkeleton } from '@/components/ui';
import { getServerEnv } from '@/lib/env';
import { describeError } from '../../_lib/errors';
import {
  amenitySelectOptions,
  categorySelectOptions,
  eventTypeSelectOptions,
  locationSelectOptions,
} from '../../_lib/options';
import { RetryState } from '@/components/admin/RetryState';
import { ListingEditor } from '@/components/admin/listing-editor/ListingEditor';

export const metadata = { title: 'New listing' };

export default function NewListingPage() {
  return (
    <Stack gap="lg">
      <PageHeader
        title="New listing"
        description="Create the provider record. It is saved as a draft — nothing appears on the public site until an administrator publishes it."
      />

      <Suspense fallback={<TableSkeleton rows={8} columns={2} />}>
        <NewListingForm />
      </Suspense>
    </Stack>
  );
}

async function NewListingForm() {
  // Data is loaded inside the try/catch, but JSX is constructed *after* it.
  // React does not render at the point JSX is created, so a component built
  // inside a try block would not actually be protected by that catch — the rule
  // exists because the apparent safety is an illusion.
  let options: {
    categories: Awaited<ReturnType<typeof categorySelectOptions>>;
    locations: Awaited<ReturnType<typeof locationSelectOptions>>;
    eventTypes: Awaited<ReturnType<typeof eventTypeSelectOptions>>;
    amenities: Awaited<ReturnType<typeof amenitySelectOptions>>;
    maxUploadBytes: number;
  } | null = null;
  let loadFailure: unknown = null;

  try {
    const [categories, locations, eventTypes, amenities] = await Promise.all([
      categorySelectOptions(false),
      locationSelectOptions(true),
      eventTypeSelectOptions(),
      amenitySelectOptions(),
    ]);

    options = {
      categories,
      locations,
      eventTypes,
      amenities,
      maxUploadBytes: getServerEnv().MEDIA_MAX_UPLOAD_BYTES,
    };
  } catch (error) {
    loadFailure = error;
  }

  if (!options) {
    return (
      <RetryState title="Could not load the listing form" detail={describeError(loadFailure)} />
    );
  }

  if (options.categories.length === 0 || options.locations.length === 0) {
    return (
      <RetryState
        title="The catalogue is empty"
        description="A listing needs at least one active category and one active location. Create those under Catalogue first."
      />
    );
  }

  return (
    <ListingEditor
      mode="create"
      categories={options.categories}
      locations={options.locations}
      eventTypes={options.eventTypes}
      amenities={options.amenities}
      maxUploadBytes={options.maxUploadBytes}
    />
  );
}
