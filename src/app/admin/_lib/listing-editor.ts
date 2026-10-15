import 'server-only';
import { getAttributeEditorFields } from '@/server/services/attribute.service';
import { adminGetListing } from '@/server/services/listing.service';
import { attributeOptionValueIndex } from './catalog-data';
import type {
  AttributeEditorFieldModel,
  AttributeFieldValue,
  AttributeFieldValueMap,
  ListingEditorMediaModel,
  ListingEditorModel,
  ListingFormValues,
} from '@/components/admin/listing-editor/types';

/**
 * Assembles everything the listing editor needs in one server round trip.
 *
 * The raw service payload contains storage keys, uploader ids and other columns
 * the browser has no reason to hold, so it is projected down to the editor's own
 * model here rather than being passed through wholesale.
 */

function toIsoDate(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function emptyAttributeValue(dataType: AttributeEditorFieldModel['dataType']): AttributeFieldValue {
  switch (dataType) {
    case 'NUMBER':
      return { kind: 'NUMBER', value: '' };
    case 'BOOLEAN':
      return { kind: 'BOOLEAN', value: false };
    case 'DATE':
      return { kind: 'DATE', value: null };
    case 'SINGLE_SELECT':
      return { kind: 'SINGLE_SELECT', value: null };
    case 'MULTI_SELECT':
      return { kind: 'MULTI_SELECT', value: [] };
    case 'TEXT':
    default:
      return { kind: 'TEXT', value: '' };
  }
}

export async function loadListingEditor(id: string): Promise<ListingEditorModel> {
  const listing = await adminGetListing(id);
  const categoryIds = listing.categories.map((link) => link.categoryId);

  const [fields, optionIndex] = await Promise.all([
    getAttributeEditorFields(categoryIds),
    attributeOptionValueIndex(),
  ]);

  const attributeFields: AttributeEditorFieldModel[] = fields.map((field) => ({
    attributeId: field.attributeId,
    code: field.code,
    label: field.label,
    dataType: field.dataType,
    unit: field.unit,
    helpText: field.helpText,
    groupLabel: field.groupLabel,
    isRequired: field.isRequired,
    minNumber: field.minNumber,
    maxNumber: field.maxNumber,
    maxLength: field.maxLength,
    options: field.options,
  }));

  const storedByAttribute = new Map(
    listing.attributeValues.map((value) => [value.attributeId, value]),
  );

  const attributeValues: AttributeFieldValueMap = {};
  for (const field of attributeFields) {
    const stored = storedByAttribute.get(field.attributeId);
    if (!stored) {
      attributeValues[field.attributeId] = emptyAttributeValue(field.dataType);
      continue;
    }

    const valuesForAttribute = optionIndex.get(field.attributeId);

    switch (field.dataType) {
      case 'NUMBER':
        attributeValues[field.attributeId] = {
          kind: 'NUMBER',
          value: stored.valueNumber ?? '',
        };
        break;
      case 'BOOLEAN':
        attributeValues[field.attributeId] = {
          kind: 'BOOLEAN',
          value: stored.valueBoolean ?? false,
        };
        break;
      case 'DATE':
        attributeValues[field.attributeId] = {
          kind: 'DATE',
          value: toIsoDate(stored.valueDate),
        };
        break;
      case 'SINGLE_SELECT':
        attributeValues[field.attributeId] = {
          kind: 'SINGLE_SELECT',
          value: stored.optionId ? (valuesForAttribute?.get(stored.optionId) ?? null) : null,
        };
        break;
      case 'MULTI_SELECT':
        attributeValues[field.attributeId] = {
          kind: 'MULTI_SELECT',
          value: (stored.optionIds ?? [])
            .map((optionId) => valuesForAttribute?.get(optionId))
            .filter((value): value is string => typeof value === 'string'),
        };
        break;
      case 'TEXT':
      default:
        attributeValues[field.attributeId] = {
          kind: 'TEXT',
          value: stored.valueText ?? '',
        };
        break;
    }
  }

  const media: ListingEditorMediaModel[] = listing.media.map((item) => ({
    id: item.id,
    publicUrl: item.publicUrl,
    altText: item.altText,
    isCover: item.isCover,
    sortOrder: item.sortOrder,
    status: item.status,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
  }));

  const values: ListingFormValues = {
    name: listing.name,
    slug: listing.slug,
    tagline: listing.tagline ?? '',
    description: listing.description ?? '',
    about: listing.about ?? '',

    primaryCategoryId: listing.primaryCategoryId,
    categoryIds: listing.categories
      .filter((link) => !link.isPrimary)
      .map((link) => link.categoryId),
    primaryLocationId: listing.primaryLocationId,
    serviceAreaIds: listing.serviceAreas.map((row) => row.locationId),
    eventTypeIds: listing.eventTypes.map((row) => row.eventTypeId),
    amenityIds: listing.amenities.map((row) => row.amenityId),

    contactPersonName: listing.contactPersonName ?? '',
    contactPhone: listing.contactPhone ?? '',
    contactEmail: listing.contactEmail ?? '',
    contactWhatsapp: listing.contactWhatsapp ?? '',
    websiteUrl: listing.websiteUrl ?? '',
    showPhone: listing.showPhone,
    showEmail: listing.showEmail,
    showWhatsapp: listing.showWhatsapp,
    showWebsite: listing.showWebsite,

    addressLine1: listing.addressLine1 ?? '',
    addressLine2: listing.addressLine2 ?? '',
    postalCode: listing.postalCode ?? '',
    latitude: listing.latitude ?? '',
    longitude: listing.longitude ?? '',

    priceMin: listing.priceMin ?? '',
    priceMax: listing.priceMax ?? '',
    priceUnit: listing.priceUnit,
    capacityMin: listing.capacityMin ?? '',
    capacityMax: listing.capacityMax ?? '',

    services: listing.services.map((service) => ({
      name: service.name,
      description: service.description ?? '',
      priceFrom: service.priceFrom ?? '',
      priceTo: service.priceTo ?? '',
      priceUnit: service.priceUnit,
      durationMinutes: service.durationMinutes ?? '',
      includes: service.includes,
      isActive: service.isActive,
      sortOrder: service.sortOrder,
    })),
    packages: listing.packages.map((pack) => ({
      name: pack.name,
      description: pack.description ?? '',
      price: pack.price ?? '',
      priceUnit: pack.priceUnit,
      minGuests: pack.minGuests ?? '',
      maxGuests: pack.maxGuests ?? '',
      inclusions: pack.inclusions,
      exclusions: pack.exclusions,
      isActive: pack.isActive,
      sortOrder: pack.sortOrder,
    })),
    venueSpaces: listing.venueSpaces.map((space) => ({
      name: space.name,
      description: space.description ?? '',
      capacitySeated: space.capacitySeated ?? '',
      capacityStanding: space.capacityStanding ?? '',
      areaSqft: space.areaSqft ?? '',
      isIndoor: space.isIndoor,
      isOutdoor: space.isOutdoor,
      layoutOptions: space.layoutOptions,
      sortOrder: space.sortOrder,
    })),
  };

  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    publicationStatus: listing.publicationStatus,
    verificationStatus: listing.verificationStatus,
    isFeatured: listing.isFeatured,
    values,
    media,
    attributeFields,
    attributeValues,
  };
}
