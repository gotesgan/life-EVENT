/**
 * The shape of a listing the pipeline is about to write.
 *
 * `build.mts` produces it, `import.mts` consumes it, and `images.mts` produces
 * the media half. It lives here so neither script has to import the other.
 */

export interface VenuePhoto {
  file: string;
  publicUrl: string;
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
  alt: string;
  sourceUrl: string;
}

export type MediaManifest = Record<string, VenuePhoto[]>;

export interface ImportedPackage {
  name: string;
  description: string;
  price: number | null;
  priceUnit: string | null;
  minGuests: number | null;
  maxGuests: number | null;
  inclusions: string[];
  exclusions: string[];
}

export interface ImportedService {
  name: string;
  description: string;
  priceFrom: number | null;
  priceTo: number | null;
  priceUnit: string | null;
  durationMinutes: number | null;
  includes: string[];
}

export interface ImportedSpace {
  name: string;
  description: string;
  capacitySeated: number | null;
  capacityStanding: number | null;
  areaSqft: number | null;
  isIndoor: boolean;
  isOutdoor: boolean;
  layoutOptions: string[];
}

export interface ImportedAttribute {
  code: string;
  number?: number;
  boolean?: boolean;
  optionValue?: string;
  optionValues?: string[];
}

export interface ImportedListing {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  about: string;
  primaryCategorySlug: string;
  secondaryCategorySlugs: string[];
  primaryLocationSlug: string;
  serviceAreaSlugs: string[];
  eventTypeSlugs: string[];
  publicationStatus: 'DRAFT' | 'PUBLISHED';
  verificationStatus: 'UNVERIFIED' | 'PENDING';
  isFeatured: boolean;
  publishedAt: string | null;
  contactPersonName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactWhatsapp: string | null;
  websiteUrl: string | null;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  amenityCodes: string[];
  services: ImportedService[];
  packages: ImportedPackage[];
  venueSpaces: ImportedSpace[];
  attributes: ImportedAttribute[];
  media: VenuePhoto[];
  provenance: {
    websiteUrl: string | null;
    finalUrl: string | null;
    scrapeStatus: string;
    scrapedAt: string | null;
    workbooks: { workbook: string; sheet: string; row: number }[];
    notes: string | null;
  };
}
