import { schemaResolver } from '@mantine/form';
import { z } from 'zod';
import { listingCreateSchema, listingUpdateSchema } from '@/lib/validation/listing';
import type {
  ListingFormValues,
  ListingPackageFormValue,
  ListingServiceFormValue,
  VenueSpaceFormValue,
} from './types';

/**
 * Form ⇄ API translation for the listing editor.
 *
 * Two conversions happen here and nowhere else:
 *
 * 1. **Empty input → absence.** A cleared `NumberInput` yields `''`, which
 *    `z.coerce.number()` would turn into `0`. That would silently publish a
 *    listing as "₹0" instead of "price on request", so every numeric field is
 *    converted to `null` before validation and before the request body is built.
 * 2. **Empty optional text → omitted key.** The API's `optionalText` maps `''`
 *    to `undefined` and rejects `null`, so an omitted key is the only safe
 *    representation of "nothing here". (That also means an existing value cannot
 *    be cleared through this API — reported, not worked around.)
 */

const TEXT_KEYS = [
  'slug',
  'tagline',
  'description',
  'about',
  'contactPersonName',
  'contactPhone',
  'contactEmail',
  'contactWhatsapp',
  'websiteUrl',
  'addressLine1',
  'addressLine2',
  'postalCode',
] as const;

const NUMBER_KEYS = [
  'latitude',
  'longitude',
  'priceMin',
  'priceMax',
  'capacityMin',
  'capacityMax',
] as const;

function numberOrNull(value: number | '' | null | undefined): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanTags(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function serviceToPayload(service: ListingServiceFormValue) {
  return {
    name: service.name.trim(),
    description: service.description.trim() || undefined,
    priceFrom: numberOrNull(service.priceFrom),
    priceTo: numberOrNull(service.priceTo),
    priceUnit: service.priceUnit || null,
    durationMinutes: numberOrNull(service.durationMinutes),
    includes: cleanTags(service.includes),
    isActive: service.isActive,
    sortOrder: service.sortOrder,
  };
}

function packageToPayload(pack: ListingPackageFormValue) {
  return {
    name: pack.name.trim(),
    description: pack.description.trim() || undefined,
    price: numberOrNull(pack.price),
    priceUnit: pack.priceUnit || null,
    minGuests: numberOrNull(pack.minGuests),
    maxGuests: numberOrNull(pack.maxGuests),
    inclusions: cleanTags(pack.inclusions),
    exclusions: cleanTags(pack.exclusions),
    isActive: pack.isActive,
    sortOrder: pack.sortOrder,
  };
}

function spaceToPayload(space: VenueSpaceFormValue) {
  return {
    name: space.name.trim(),
    description: space.description.trim() || undefined,
    capacitySeated: numberOrNull(space.capacitySeated),
    capacityStanding: numberOrNull(space.capacityStanding),
    areaSqft: numberOrNull(space.areaSqft),
    isIndoor: space.isIndoor,
    isOutdoor: space.isOutdoor,
    layoutOptions: cleanTags(space.layoutOptions),
    sortOrder: space.sortOrder,
  };
}

/** Drops `undefined` values so an omitted field is genuinely absent. */
function compact<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export function toListingPayload(values: ListingFormValues): Record<string, unknown> {
  return compact({
    name: values.name.trim(),
    slug: values.slug.trim() || undefined,
    tagline: values.tagline.trim() || undefined,
    description: values.description.trim() || undefined,
    about: values.about.trim() || undefined,

    primaryCategoryId: values.primaryCategoryId,
    categoryIds: Array.from(new Set(values.categoryIds)),
    primaryLocationId: values.primaryLocationId,
    serviceAreaIds: Array.from(new Set(values.serviceAreaIds)),
    eventTypeIds: Array.from(new Set(values.eventTypeIds)),
    amenityIds: Array.from(new Set(values.amenityIds)),

    contactPersonName: values.contactPersonName.trim() || undefined,
    contactPhone: values.contactPhone.trim() || undefined,
    contactEmail: values.contactEmail.trim() || undefined,
    contactWhatsapp: values.contactWhatsapp.trim() || undefined,
    websiteUrl: values.websiteUrl.trim() || undefined,
    showPhone: values.showPhone,
    showEmail: values.showEmail,
    showWhatsapp: values.showWhatsapp,
    showWebsite: values.showWebsite,

    addressLine1: values.addressLine1.trim() || undefined,
    addressLine2: values.addressLine2.trim() || undefined,
    postalCode: values.postalCode.trim() || undefined,
    latitude: numberOrNull(values.latitude),
    longitude: numberOrNull(values.longitude),

    priceMin: numberOrNull(values.priceMin),
    priceMax: numberOrNull(values.priceMax),
    priceUnit: values.priceUnit || null,
    capacityMin: numberOrNull(values.capacityMin),
    capacityMax: numberOrNull(values.capacityMax),

    services: values.services.map(serviceToPayload),
    packages: values.packages.map(packageToPayload),
    venueSpaces: values.venueSpaces.map(spaceToPayload),
  });
}

const NESTED_NUMBER_KEYS = [
  'priceFrom',
  'priceTo',
  'durationMinutes',
  'price',
  'minGuests',
  'maxGuests',
  'capacitySeated',
  'capacityStanding',
  'areaSqft',
] as const;

function normaliseNested(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const key of NESTED_NUMBER_KEYS) {
    if (key in out) out[key] = numberOrNull(out[key] as number | '' | null);
  }
  for (const key of ['description'] as const) {
    if (typeof out[key] === 'string' && (out[key] as string).trim() === '') {
      out[key] = undefined;
    }
  }
  for (const key of ['includes', 'inclusions', 'exclusions', 'layoutOptions'] as const) {
    if (Array.isArray(out[key])) out[key] = cleanTags(out[key] as string[]);
  }
  return out;
}

/**
 * Makes the raw form values look like the request body, so the *same* schema the
 * API route uses can validate the form. Without this, `''` would be coerced to
 * `0` and "leave the slug blank to auto-generate" would fail as "too short".
 */
export function normaliseForValidation(values: ListingFormValues): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };

  for (const key of TEXT_KEYS) {
    const value = out[key];
    if (typeof value === 'string' && value.trim() === '') out[key] = undefined;
    else if (typeof value === 'string') out[key] = value.trim();
  }

  for (const key of NUMBER_KEYS) {
    out[key] = numberOrNull(out[key] as number | '' | null);
  }

  if (out.priceUnit === '' || out.priceUnit === null) out.priceUnit = null;
  if (typeof out.name === 'string') out.name = out.name.trim();

  out.services = (values.services ?? []).map((row) =>
    normaliseNested(row as unknown as Record<string, unknown>),
  );
  out.packages = (values.packages ?? []).map((row) =>
    normaliseNested(row as unknown as Record<string, unknown>),
  );
  out.venueSpaces = (values.venueSpaces ?? []).map((row) =>
    normaliseNested(row as unknown as Record<string, unknown>),
  );

  return out;
}

export function buildListingSchema(mode: 'create' | 'update') {
  const base = mode === 'create' ? listingCreateSchema : listingUpdateSchema;
  return z.preprocess((input) => normaliseForValidation(input as ListingFormValues), base);
}

/**
 * The form validator, built from the *same* schema the API route uses.
 *
 * `schemaResolver` (Mantine 9) is the Standard Schema resolver; `zodResolver` no
 * longer exists. The schema is wrapped in `z.preprocess` so empty inputs are
 * normalised before validation — see `normaliseForValidation`.
 */
export function listingFormValidator(mode: 'create' | 'update') {
  return schemaResolver(buildListingSchema(mode), { sync: true });
}

export function emptyService(sortOrder: number): ListingServiceFormValue {
  return {
    name: '',
    description: '',
    priceFrom: '',
    priceTo: '',
    priceUnit: null,
    durationMinutes: '',
    includes: [],
    isActive: true,
    sortOrder,
  };
}

export function emptyPackage(sortOrder: number): ListingPackageFormValue {
  return {
    name: '',
    description: '',
    price: '',
    priceUnit: null,
    minGuests: '',
    maxGuests: '',
    inclusions: [],
    exclusions: [],
    isActive: true,
    sortOrder,
  };
}

export function emptySpace(sortOrder: number): VenueSpaceFormValue {
  return {
    name: '',
    description: '',
    capacitySeated: '',
    capacityStanding: '',
    areaSqft: '',
    isIndoor: true,
    isOutdoor: false,
    layoutOptions: [],
    sortOrder,
  };
}

export function emptyListingForm(): ListingFormValues {
  return {
    name: '',
    slug: '',
    tagline: '',
    description: '',
    about: '',

    primaryCategoryId: '',
    categoryIds: [],
    primaryLocationId: '',
    serviceAreaIds: [],
    eventTypeIds: [],
    amenityIds: [],

    contactPersonName: '',
    contactPhone: '',
    contactEmail: '',
    contactWhatsapp: '',
    websiteUrl: '',
    showPhone: false,
    showEmail: false,
    showWhatsapp: false,
    showWebsite: true,

    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    latitude: '',
    longitude: '',

    priceMin: '',
    priceMax: '',
    priceUnit: null,
    capacityMin: '',
    capacityMax: '',

    services: [],
    packages: [],
    venueSpaces: [],
  };
}
