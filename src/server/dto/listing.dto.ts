import type { PublicationStatus, VerificationStatus, PriceUnit } from '@/generated/prisma/enums';

/**
 * Public-facing projections.
 *
 * These mappers are the boundary that stops private database fields leaking to
 * the browser. Route handlers and Server Components return DTOs, never raw
 * Prisma rows, so adding a column to the schema can never accidentally expose
 * it.
 */

export interface ListingCardMedia {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface ListingCardHighlight {
  code: string;
  label: string;
  value: string;
}

export interface ListingCard {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  category: { name: string; slug: string } | null;
  location: { name: string; slug: string; type: string } | null;
  /** Pre-formatted so the card never has to know about price units. */
  priceLabel: string | null;
  /**
   * Structured price, exposed alongside the label so clients can sort, filter
   * or emit structured data without parsing a formatted currency string.
   */
  priceMin: number | null;
  priceMax: number | null;
  /** Unit the amounts are quoted in, so the card can render `PriceTag` exactly. */
  priceUnit: PriceUnit | null;
  capacityLabel: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  cover: ListingCardMedia | null;
  galleryCount: number;
  highlights: ListingCardHighlight[];
  /**
   * True when `name` is the anonymous stand-in ("Banquet hall in Andheri East")
   * rather than the business's real trading name.
   *
   * The name is withheld until the visitor has sent an enquiry for this listing
   * — see `src/lib/listing-privacy.ts`. The flag travels with the DTO so a card
   * can mark the masked state without re-deriving it, and the real name never
   * reaches the browser payload at all.
   */
  isNameHidden?: boolean;
}

export interface ListingServiceView {
  id: string;
  name: string;
  description: string | null;
  priceLabel: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceUnit: PriceUnit | null;
  durationMinutes: number | null;
  includes: string[];
}

export interface ListingPackageView {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  priceUnit: PriceUnit | null;
  priceLabel: string | null;
  minGuests: number | null;
  maxGuests: number | null;
  inclusions: string[];
  exclusions: string[];
}

export interface ListingSpaceView {
  id: string;
  name: string;
  description: string | null;
  capacitySeated: number | null;
  capacityStanding: number | null;
  areaSqft: number | null;
  isIndoor: boolean;
  isOutdoor: boolean;
  layoutOptions: string[];
}

export interface ListingAttributeGroupView {
  groupLabel: string | null;
  attributes: Array<{ code: string; label: string; value: string }>;
}

export interface ListingContactView {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  /** True when at least one channel exists but is withheld at this lead stage. */
  hasWithheldChannels: boolean;
  /** Shown instead of a raw number, so lead attribution is preserved. */
  message: string | null;
}

export interface ListingDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  about: string | null;
  publicationStatus: PublicationStatus;
  verificationStatus: VerificationStatus;
  isFeatured: boolean;
  publishedAt: Date | null;
  updatedAt: Date;

  primaryCategory: { name: string; slug: string } | null;
  categories: Array<{ name: string; slug: string }>;
  location: {
    name: string;
    slug: string;
    path: string;
    type: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;

  eventTypes: Array<{ name: string; slug: string }>;
  serviceAreas: Array<{ name: string; slug: string; type: string }>;
  amenities: Array<{ code: string; label: string; groupLabel: string | null }>;

  gallery: ListingCardMedia[];
  services: ListingServiceView[];
  packages: ListingPackageView[];
  spaces: ListingSpaceView[];
  attributeGroups: ListingAttributeGroupView[];

  priceLabel: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: PriceUnit | null;
  capacityLabel: string | null;

  contact: ListingContactView;

  /**
   * True when the trading name and contact channels are withheld pending an
   * enquiry. The profile renders a masked identity ("Banquet hall in Andheri
   * East") and keeps its published prices, capacity and facilities, because
   * those are the facts a visitor needs to decide whether to enquire.
   */
  isNameHidden?: boolean;
}

export interface SearchAppliedFilter {
  code: string;
  label: string;
  /** Human-readable current value(s), e.g. `Candid, Documentary`. */
  displayValue: string;
  /** Query string with only this filter removed. */
  removeHref: string;
}

export interface SearchFacetGroups {
  categories: Array<{ slug: string; name: string; listingCount: number }>;
  locations: Array<{ slug: string; name: string; type: string }>;
  eventTypes: Array<{ slug: string; name: string }>;
}

export interface ListingSearchResult {
  cards: ListingCard[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  appliedFilters: SearchAppliedFilter[];
  activeFilterCount: number;
  context: {
    category: { slug: string; name: string; path: string } | null;
    location: { slug: string; name: string; type: string } | null;
    query: string | null;
    sort: string;
    verifiedOnly: boolean;
  };
}
