'use client';

import type { ReactNode } from 'react';
import {
  Alert,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { slugify } from '@/lib/slug';
import { PRICE_UNIT_LABELS } from '@/lib/format';
import type { ListingForm } from './types';
import type { Option } from '../ListingsFilters';
import classes from './Sections.module.css';

/**
 * One labelled group of fields.
 *
 * A `<fieldset>` with a `<legend>` gives the grouping to assistive technology as
 * well as to the eye, and the hairline above it (from the CSS sibling rule)
 * means the group boundary is visible in a screenshot. `legend` cannot be used
 * as a flex container in every browser, so the heading lives in a `span` inside
 * it and the layout is done by the fieldset.
 */
function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={classes.fieldGroup}>
      <legend className={classes.groupHead}>
        <span className={classes.groupTitle}>{title}</span>
        {hint ? <span className={classes.groupHint}>{hint}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

const PRICE_UNIT_OPTIONS: Option[] = Object.entries(PRICE_UNIT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export interface SectionProps {
  form: ListingForm;
}

export interface BasicsSectionProps extends SectionProps {
  categories: readonly Option[];
  locations: readonly Option[];
  eventTypes: readonly Option[];
  amenities: readonly Option[];
}

export function BasicsSection({
  form,
  categories,
  locations,
  eventTypes,
  amenities,
}: BasicsSectionProps) {
  const previewSlug = form.values.slug.trim() || slugify(form.values.name) || 'listing-name';

  return (
    <Stack gap="lg">
      <FieldGroup
        title="Identity"
        hint="What customers see first: the name, the card copy and the public address."
      >
        <TextInput
          label="Listing name"
          description="The business name customers will see."
          withAsterisk
          {...form.getInputProps('name')}
        />

        <div>
          <TextInput
            label="Slug"
            description="Leave blank to generate one from the name. Used in the public URL."
            placeholder={slugify(form.values.name) || 'auto-generated'}
            {...form.getInputProps('slug')}
          />
          <Text size="xs" c="dimmed" mt={4}>
            Public URL: <code>/vendors/{previewSlug}</code>
          </Text>
        </div>

        <TextInput
          label="Tagline"
          description="One short line shown under the name on cards and search results."
          {...form.getInputProps('tagline')}
        />

        <Textarea
          label="Description"
          description="Required before the listing can be published."
          minRows={4}
          autosize
          {...form.getInputProps('description')}
        />

        <Textarea
          label="About"
          description="Longer narrative for the listing page. Optional."
          minRows={6}
          autosize
          {...form.getInputProps('about')}
        />
      </FieldGroup>

      <FieldGroup
        title="Placement"
        hint="Decides which filters, locations and event types this listing appears under."
      >
        <Select
          label="Primary category"
          description="Decides which filters and attributes this listing offers."
          data={categories}
          searchable
          withAsterisk
          {...form.getInputProps('primaryCategoryId')}
        />

        <MultiSelect
          label="Additional categories"
          description="Up to 8. The listing appears in each of these sections."
          data={categories}
          searchable
          maxValues={8}
          {...form.getInputProps('categoryIds')}
        />

        <Select
          label="Primary location"
          data={locations}
          searchable
          withAsterisk
          {...form.getInputProps('primaryLocationId')}
        />

        <MultiSelect
          label="Service areas"
          description="Where this vendor will travel or deliver."
          data={locations}
          searchable
          maxValues={40}
          {...form.getInputProps('serviceAreaIds')}
        />

        <MultiSelect
          label="Event types"
          description="Which kinds of events this vendor handles."
          data={eventTypes}
          searchable
          maxValues={20}
          {...form.getInputProps('eventTypeIds')}
        />

        <MultiSelect
          label="Amenities"
          description="Facilities and services, shown as highlights."
          data={amenities}
          searchable
          maxValues={30}
          {...form.getInputProps('amenityIds')}
        />
      </FieldGroup>
    </Stack>
  );
}

export function ContactSection({ form }: SectionProps) {
  return (
    <Stack gap="lg">
      <FieldGroup
        title="Reachability"
        hint="How the platform reaches this provider. Phone and email here are contact details, not yet public."
      >
        <TextInput label="Contact person" {...form.getInputProps('contactPersonName')} />

        <div className={classes.pair}>
          <TextInput label="Phone" {...form.getInputProps('contactPhone')} />
          <TextInput label="WhatsApp" {...form.getInputProps('contactWhatsapp')} />
        </div>

        <TextInput
          label="Email"
          description="Must be a full address, e.g. bookings@example.com"
          {...form.getInputProps('contactEmail')}
        />
        <TextInput
          label="Website"
          description="Full URL including https://"
          placeholder="https://example.com"
          {...form.getInputProps('websiteUrl')}
        />
      </FieldGroup>

      <FieldGroup
        title="Disclosure flags"
        hint="Which channels may ever be published to a customer, and at what stage."
      >
        <Alert
          variant="light"
          color="brand"
          icon={<IconInfoCircle size={18} stroke={1.5} />}
          title="What the disclosure flags do"
        >
          <Stack gap="xs">
            <Text size="sm">
              A customer sees contact details only once the lead reaches the stage where the vendor
              has been given their brief. These flags decide <em>which</em> channels are ever
              published — turning one off hides it permanently, even at the final stage.
            </Text>
            <Text size="sm">
              Phone and WhatsApp reveal direct calling. Email reveals the address. Website is the
              only channel that is safe to publish from the start, because it is already public.
            </Text>
          </Stack>
        </Alert>

        <Switch
          label="Publish phone number"
          description="When on, the phone number can be revealed to a customer once their enquiry is shared with this provider."
          {...form.getInputProps('showPhone', { type: 'checkbox' })}
        />
        <Switch
          label="Publish email address"
          description="When on, the email address can be revealed at the same stage. Leave off if the inbox is not monitored."
          {...form.getInputProps('showEmail', { type: 'checkbox' })}
        />
        <Switch
          label="Publish WhatsApp number"
          description="When on, the WhatsApp number can be revealed. Only enable it if this number actually receives messages."
          {...form.getInputProps('showWhatsapp', { type: 'checkbox' })}
        />
        <Switch
          label="Publish website"
          description="Shown on the public listing page. Safe to leave on for most providers."
          {...form.getInputProps('showWebsite', { type: 'checkbox' })}
        />
      </FieldGroup>

      <FieldGroup title="Address" hint="The postal address and map position, if they are known.">
        <TextInput label="Address line 1" {...form.getInputProps('addressLine1')} />
        <TextInput label="Address line 2" {...form.getInputProps('addressLine2')} />
        <TextInput
          label="Postal code"
          description="Used for the address block, not for search."
          {...form.getInputProps('postalCode')}
        />

        <div className={classes.pair}>
          <NumberInput
            label="Latitude"
            description="-90 to 90"
            min={-90}
            max={90}
            decimalScale={6}
            {...form.getInputProps('latitude')}
          />
          <NumberInput
            label="Longitude"
            description="-180 to 180"
            min={-180}
            max={180}
            decimalScale={6}
            {...form.getInputProps('longitude')}
          />
        </div>
        <Text size="xs" c="dimmed">
          Coordinates place the listing on a map. Leave both blank if the exact position is unknown
          — an approximate location is better than a wrong pin.
        </Text>
      </FieldGroup>
    </Stack>
  );
}

export interface CommercialSectionProps extends SectionProps {
  /** Venue-like categories show the capacity fields. */
  showCapacity: boolean;
}

export function CommercialSection({ form, showCapacity }: CommercialSectionProps) {
  return (
    <Stack gap="lg">
      <Alert
        variant="light"
        color="accent"
        icon={<IconInfoCircle size={18} stroke={1.5} />}
        title="These numbers drive the public filters"
      >
        <Text size="sm">
          Price and capacity are what the search page&rsquo;s budget and guest-count sliders filter
          on. Leaving a value blank is correct when the vendor does not publish it — the listing
          then shows &ldquo;price on request&rdquo; rather than a misleading zero.
        </Text>
      </Alert>

      <FieldGroup
        title="Price"
        hint="What the vendor charges. Both fields are optional; leaving them blank is the honest state."
      >
        <div className={classes.pair}>
          <NumberInput
            label="Minimum price"
            description="In rupees"
            min={0}
            thousandSeparator=","
            {...form.getInputProps('priceMin')}
          />
          <NumberInput
            label="Maximum price"
            description="In rupees"
            min={0}
            thousandSeparator=","
            {...form.getInputProps('priceMax')}
          />
        </div>

        <Select
          label="Price unit"
          description="What the price is charged per."
          data={PRICE_UNIT_OPTIONS}
          clearable
          {...form.getInputProps('priceUnit')}
        />
      </FieldGroup>

      {showCapacity ? (
        <FieldGroup
          title="Capacity"
          hint="Backs the public guest-count filter, so it should reflect the largest event the venue can actually host."
        >
          <div className={classes.pair}>
            <NumberInput
              label="Minimum guests"
              min={0}
              thousandSeparator=","
              {...form.getInputProps('capacityMin')}
            />
            <NumberInput
              label="Maximum guests"
              min={0}
              thousandSeparator=","
              {...form.getInputProps('capacityMax')}
            />
          </div>
        </FieldGroup>
      ) : null}
    </Stack>
  );
}
