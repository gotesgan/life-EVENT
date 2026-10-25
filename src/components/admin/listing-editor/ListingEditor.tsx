'use client';

import { useState } from 'react';
import Link from '@/components/ui/ClientLink';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, Tabs, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertTriangle,
  IconCheck,
  IconExternalLink,
  IconInfoCircle,
} from '@tabler/icons-react';
import { StatusBadge, Surface } from '@/components/ui';
import { ListingRowActions } from '../ListingRowActions';
import { PublicationBadge, VerificationBadge } from '../ListingCells';
import editorClasses from './ListingEditor.module.css';
import { fieldErrorsFrom, notifyError, notifySuccess, patchJson, postJson } from '../api';
import { confirmAction } from '../confirm';
import { AttributesSection } from './AttributesSection';
import { BasicsSection, CommercialSection, ContactSection } from './Sections';
import { CollectionsSection } from './CollectionsSection';
import { MediaManager } from './MediaManager';
import { emptyListingForm, listingFormValidator, toListingPayload } from './form';
import type { ListingEditorModel, ListingFormValues } from './types';
import type { Option } from '../ListingsFilters';

export interface ListingEditorProps {
  mode: 'create' | 'edit';
  listing?: ListingEditorModel;
  categories: Option[];
  locations: Option[];
  eventTypes: Option[];
  amenities: Option[];
  maxUploadBytes: number;
}

type TabKey = 'basics' | 'contact' | 'commercial' | 'collections' | 'attributes' | 'media';

/**
 * Which tabs submit through the shared `PATCH`.
 *
 * Attributes and Media are not in this list because they save through their own
 * endpoints — a failed image upload must not re-send the whole listing — so the
 * dirty/save dock is only rendered while one of these four is showing.
 */
const COLLECTION_TABS: TabKey[] = ['basics', 'contact', 'commercial', 'collections'];

interface SectionDef {
  key: TabKey;
  label: string;
  /** Shown under the section list, so a disabled section says why. */
  note: string;
  disabledOnCreate?: boolean;
}

/**
 * The section list, in reading order.
 *
 * The order is the order an administrator fills the record: what it is, how to
 * reach it, what it costs, then the collections and the media. A form this long
 * is navigated, not read, so the nav is the primary structure on the page.
 */
const SECTIONS: ReadonlyArray<SectionDef> = [
  { key: 'basics', label: 'Basics', note: 'Name, copy, category and placement.' },
  {
    key: 'contact',
    label: 'Contact & disclosure',
    note: 'Who to reach, and what may be published.',
  },
  {
    key: 'commercial',
    label: 'Commercial',
    note: 'Price and capacity, as the public filter reads them.',
  },
  { key: 'collections', label: 'Services & spaces', note: 'Packages, services and venue spaces.' },
  {
    key: 'attributes',
    label: 'Attributes',
    note: 'Available once the listing exists.',
    disabledOnCreate: true,
  },
  {
    key: 'media',
    label: 'Media',
    note: 'Available once the listing exists.',
    disabledOnCreate: true,
  },
];

/**
 * The listing editor.
 *
 * The form is split across two save paths on purpose: everything in
 * Basics/Contact/Commercial/Collections submits as one `PATCH` (the service
 * replaces the child collections wholesale), while attributes go to
 * `PUT .../attributes` and media is managed image by image. Merging them into a
 * single save would mean one failed image re-uploads the whole listing.
 *
 * Validation uses `schemaResolver` bound to the API's own Zod schema, so the
 * browser and the route cannot disagree about what a valid listing is.
 */
export function ListingEditor({
  mode,
  listing,
  categories,
  locations,
  eventTypes,
  amenities,
  maxUploadBytes,
}: ListingEditorProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('basics');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set only after a confirmed write, so the dock never claims a save the
  // server refused. Cleared as soon as the form is touched again.
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const form = useForm<ListingFormValues>({
    initialValues: listing ? listing.values : emptyListingForm(),
    validate: listingFormValidator(mode === 'create' ? 'create' : 'update'),
  });

  const isCreate = mode === 'create';
  const listingId = listing?.id;

  async function submit(values: ListingFormValues) {
    setSaving(true);
    setSaveError(null);
    try {
      const body = toListingPayload(values);

      if (isCreate) {
        const created = await postJson<{ data: { id: string; slug: string; name: string } }>(
          '/api/admin/listings',
          body,
        );
        notifySuccess(
          'Saved as draft. Add at least one image and a description to publish.',
          'Listing created',
        );
        router.push(`/admin/listings/${created.data.id}`);
        return;
      }

      await patchJson(`/api/admin/listings/${listingId}`, body);
      notifySuccess('Listing saved.', 'Saved');
      form.resetDirty();
      setSavedAt(new Date());
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The listing could not be saved.';
      setSaveError(message);
      notifyError(error, 'Could not save the listing');
      const fieldErrors = fieldErrorsFrom(error);
      if (Object.keys(fieldErrors).length > 0) form.setErrors(fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  function requestRemove(
    list: 'services' | 'packages' | 'venueSpaces',
    index: number,
    label: string,
  ) {
    confirmAction({
      title: `Remove "${label}"?`,
      body: `This removes the item from the form. Nothing is deleted until you save the listing, but the whole ${list === 'venueSpaces' ? 'venue space' : list.slice(0, -1)} collection is replaced when you do.`,
      confirmLabel: 'Remove',
      onConfirm: () => form.removeListItem(list, index),
    });
  }

  const isDirty = form.isDirty();
  const canSubmit = COLLECTION_TABS.includes(tab);

  return (
    <Stack gap="lg" className={editorClasses.root}>
      {isCreate ? (
        <Alert variant="light" color="accent" icon={<IconInfoCircle size={18} stroke={1.5} />}>
          <Text size="sm" fw={600}>
            New listings are always created as a draft.
          </Text>
          <Text size="sm">
            Saved as draft. Add at least one image and a description to publish. Images and
            category-specific attributes become available once the listing exists.
          </Text>
        </Alert>
      ) : null}

      {/*
        Record header. The identity, the two states that decide whether the
        listing is publicly reachable, and the row actions — so the editor
        answers "what am I editing and is it live" before the first field.
      */}
      <Surface tone="raised" padding="md">
        <div className={editorClasses.recordHeader}>
          <div className={editorClasses.recordIdentity}>
            <div className={editorClasses.recordNameRow}>
              <span className={editorClasses.recordName}>{listing?.name ?? 'New listing'}</span>
              {listing ? (
                <>
                  <PublicationBadge status={listing.publicationStatus} />
                  <VerificationBadge status={listing.verificationStatus} />
                </>
              ) : null}
              {listing?.isFeatured ? (
                <StatusBadge tone="accent" size="sm">
                  Featured
                </StatusBadge>
              ) : null}
            </div>

            {listing ? (
              listing.publicationStatus === 'PUBLISHED' ? (
                <a
                  className={editorClasses.recordUrl}
                  href={`/vendors/${listing.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconExternalLink size={13} stroke={1.5} aria-hidden />
                  /vendors/{listing.slug}
                </a>
              ) : (
                <p className={editorClasses.recordNote}>
                  No public page yet — this listing is {listing.publicationStatus.toLowerCase()}. It
                  will be reachable at /vendors/{listing.slug} once published.
                </p>
              )
            ) : (
              <p className={editorClasses.recordNote}>
                The public URL is generated from the name if you leave the slug blank.
              </p>
            )}
          </div>

          {listing ? (
            <div className={editorClasses.recordActions}>
              <Button component={Link} href="/admin/listings" variant="default" size="sm">
                All listings
              </Button>
              <ListingRowActions
                id={listing.id}
                name={listing.name}
                slug={listing.slug}
                publicationStatus={listing.publicationStatus}
                verificationStatus={listing.verificationStatus}
                onDone={() => router.refresh()}
              />
            </div>
          ) : null}
        </div>
      </Surface>

      <Tabs
        value={tab}
        onChange={(value) => setTab((value as TabKey) ?? 'basics')}
        keepMounted={false}
        orientation="vertical"
        placement="left"
        className={editorClasses.body}
      >
        {/*
          Section navigation. `role="tablist"` plus one `Tabs.Tab` per section
          keeps the arrow-key behaviour of a real tab set; the vertical list is
          what makes all six sections visible at once. The marker span repeats
          the shell nav's "you are here" idiom, and is `aria-hidden` so the
          button's accessible name stays exactly the section label.
        */}
        <Tabs.List
          aria-label="Listing sections"
          className={`${editorClasses.rail} ${editorClasses.railList}`}
        >
          {SECTIONS.map((section) => {
            const disabled = Boolean(section.disabledOnCreate && isCreate);
            const active = tab === section.key;
            return (
              <Tabs.Tab
                key={section.key}
                value={section.key}
                disabled={disabled}
                className={[editorClasses.railItem, active ? editorClasses.railItemActive : '']
                  .filter(Boolean)
                  .join(' ')}
                leftSection={
                  <span
                    aria-hidden
                    className={
                      active
                        ? `${editorClasses.railMarker} ${editorClasses.railMarkerActive}`
                        : editorClasses.railMarker
                    }
                  />
                }
              >
                <span className={editorClasses.railItemLabel}>{section.label}</span>
              </Tabs.Tab>
            );
          })}
          <p className={editorClasses.railNote}>
            Changes in Basics, Contact, Commercial and Services are saved together. Attributes and
            media save on their own.
          </p>
        </Tabs.List>

        {/*
          The second grid column.

          Four panels live inside the `<form>` because they share one PATCH, while
          Attributes and Media save through their own endpoints and sit outside it.
          Before this wrapper existed they were direct grid children, so the grid
          auto-placed them into the *rail* column: on the Media and Attributes tabs
          the panel rendered 196px wide under the section list. One column wrapper
          keeps every panel in the content column while preserving the separate
          save paths.
        */}
        <div className={editorClasses.panelColumn}>
          <form
            className={editorClasses.panel}
            onSubmit={form.onSubmit((values) => void submit(values))}
            noValidate
          >
            <Tabs.Panel value="basics">
              <BasicsSection
                form={form}
                categories={categories}
                locations={locations}
                eventTypes={eventTypes}
                amenities={amenities}
              />
            </Tabs.Panel>

            <Tabs.Panel value="contact">
              <ContactSection form={form} />
            </Tabs.Panel>

            <Tabs.Panel value="commercial">
              <CommercialSection form={form} showCapacity />
            </Tabs.Panel>

            <Tabs.Panel value="collections">
              <CollectionsSection form={form} onRequestRemove={requestRemove} />
            </Tabs.Panel>

            {/*
            Dirty state and the save affordance, in one docked strip.

            Three statements, in priority order: the error (if the last save was
            refused), whether the screen differs from the database, and the two
            controls. The status is written out as text — a colour alone is not a
            statement about unsaved work — and the dot repeats it non-verbally.
          */}
            {canSubmit ? (
              <div className={editorClasses.saveDock}>
                <div className={editorClasses.saveStatus} role="status">
                  <span aria-hidden className={editorClasses.saveDot} />
                  <Text component="span" className={editorClasses.saveStatusText}>
                    {isDirty ? (
                      <span className={editorClasses.saveStatusDirty}>Unsaved changes</span>
                    ) : savedAt ? (
                      <span className={editorClasses.saveStatusSaved}>
                        <IconCheck size={12} stroke={2} aria-hidden /> Saved
                      </span>
                    ) : (
                      'No changes to save'
                    )}
                  </Text>
                </div>

                <div className={editorClasses.saveActions}>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      form.reset();
                      setSaveError(null);
                      setSavedAt(null);
                    }}
                    disabled={!isDirty}
                  >
                    Discard changes
                  </Button>
                  <Button type="submit" size="sm" loading={saving} disabled={!isDirty}>
                    {isCreate ? 'Create draft listing' : 'Save changes'}
                  </Button>
                </div>
              </div>
            ) : null}

            {saveError ? (
              <Alert
                variant="light"
                color="red"
                role="alert"
                icon={<IconAlertTriangle size={16} />}
                mb="md"
              >
                {saveError}
              </Alert>
            ) : null}
          </form>

          {!isCreate && listing ? (
            <>
              <Tabs.Panel value="attributes">
                <AttributesSection
                  listingId={listing.id}
                  fields={listing.attributeFields}
                  initialValues={listing.attributeValues}
                  onSaved={() => router.refresh()}
                />
              </Tabs.Panel>

              <Tabs.Panel value="media">
                <MediaManager
                  listingId={listing.id}
                  media={listing.media}
                  maxUploadBytes={maxUploadBytes}
                />
              </Tabs.Panel>
            </>
          ) : null}
        </div>
      </Tabs>
    </Stack>
  );
}
