import type { UseFormReturnType } from '@mantine/form';

/**
 * Shape of the listing editor's form.
 *
 * Empty numeric inputs are held as `''` rather than `null`, because that is what
 * a `NumberInput` gives back when an administrator clears it, and the payload
 * builder converts it to `null` at the edge. Keeping the empty state distinct
 * from `0` matters: "no price published" and "priced at zero" are different
 * facts about a listing.
 */

export interface ListingServiceFormValue {
  name: string;
  description: string;
  priceFrom: number | '';
  priceTo: number | '';
  priceUnit: string | null;
  durationMinutes: number | '';
  includes: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface ListingPackageFormValue {
  name: string;
  description: string;
  price: number | '';
  priceUnit: string | null;
  minGuests: number | '';
  maxGuests: number | '';
  inclusions: string[];
  exclusions: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface VenueSpaceFormValue {
  name: string;
  description: string;
  capacitySeated: number | '';
  capacityStanding: number | '';
  areaSqft: number | '';
  isIndoor: boolean;
  isOutdoor: boolean;
  layoutOptions: string[];
  sortOrder: number;
}

export interface ListingFormValues {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  about: string;

  primaryCategoryId: string;
  categoryIds: string[];
  primaryLocationId: string;
  serviceAreaIds: string[];
  eventTypeIds: string[];
  amenityIds: string[];

  contactPersonName: string;
  contactPhone: string;
  contactEmail: string;
  contactWhatsapp: string;
  websiteUrl: string;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;

  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  latitude: number | '';
  longitude: number | '';

  priceMin: number | '';
  priceMax: number | '';
  priceUnit: string | null;
  capacityMin: number | '';
  capacityMax: number | '';

  services: ListingServiceFormValue[];
  packages: ListingPackageFormValue[];
  venueSpaces: VenueSpaceFormValue[];
}

export type ListingForm = UseFormReturnType<ListingFormValues, ListingFormValues>;

export interface AttributeEditorOption {
  value: string;
  label: string;
}

export interface AttributeEditorFieldModel {
  attributeId: string;
  code: string;
  label: string;
  dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  unit: string | null;
  helpText: string | null;
  groupLabel: string | null;
  isRequired: boolean;
  minNumber: number | null;
  maxNumber: number | null;
  maxLength: number | null;
  options: AttributeEditorOption[];
}

/** One attribute's editor state, keyed by `attributeId` in the form. */
export type AttributeFieldValue =
  | { kind: 'TEXT'; value: string }
  | { kind: 'NUMBER'; value: number | '' }
  | { kind: 'BOOLEAN'; value: boolean }
  | { kind: 'DATE'; value: string | null }
  | { kind: 'SINGLE_SELECT'; value: string | null }
  | { kind: 'MULTI_SELECT'; value: string[] };

export type AttributeFieldValueMap = Record<string, AttributeFieldValue>;

export interface ListingEditorMediaModel {
  id: string;
  publicUrl: string;
  altText: string;
  isCover: boolean;
  sortOrder: number;
  status: 'PENDING' | 'READY' | 'FAILED';
  mimeType: string;
  sizeBytes: number;
}

export interface ListingEditorModel {
  id: string;
  slug: string;
  name: string;
  publicationStatus: string;
  verificationStatus: string;
  isFeatured: boolean;
  values: ListingFormValues;
  media: ListingEditorMediaModel[];
  attributeFields: AttributeEditorFieldModel[];
  attributeValues: AttributeFieldValueMap;
}
