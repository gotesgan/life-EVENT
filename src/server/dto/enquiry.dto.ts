import type { EnquiryStatus as EnquiryStatusEnum } from '@/generated/prisma/enums';
import type { ContactMethod } from '@/generated/prisma/enums';

type EnquiryStatusValue = (typeof EnquiryStatusEnum)[keyof typeof EnquiryStatusEnum];
type ContactMethodValue = (typeof ContactMethod)[keyof typeof ContactMethod];

/**
 * Customer-facing enquiry projections.
 *
 * The customer timeline is built from `EnquiryActivity` rows flagged
 * `isCustomerVisible`, and provider contact details are attached only when
 * `deriveContactDisclosure` allows them for that lead's status. Admin notes,
 * internal assignments and internal operational status names never appear here.
 */

export interface CustomerEnquiryListingView {
  listingId: string;
  name: string;
  slug: string;
  categoryName: string | null;
  locationName: string | null;
  statusLabel: string;
  statusDescription: string;
  contact: {
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    website: string | null;
    message: string | null;
  };
}

export interface CustomerTimelineEntry {
  id: string;
  type: string;
  at: Date;
  message: string | null;
  listingName: string | null;
}

export interface CustomerEnquirySummary {
  referenceCode: string;
  status: EnquiryStatusValue;
  statusLabel: string;
  statusDescription: string;
  createdAt: Date;
  eventDate: Date | null;
  eventDateFlexible: boolean;
  eventTypeName: string | null;
  guestCount: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  listings: CustomerEnquiryListingView[];
}

export interface CustomerEnquiryDetail extends CustomerEnquirySummary {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactMethod: ContactMethodValue;
  contactCityName: string | null;
  requirements: string | null;
  canCancel: boolean;
  timeline: CustomerTimelineEntry[];
}

/**
 * Public-safe tracking result. Deliberately narrower than the account view: it
 * is reachable with a reference code plus the contact email rather than a
 * session, so it exposes only what the sender already knows plus progress
 * wording — never internal notes, assignees or provider contact details.
 */
export interface TrackedEnquiryView {
  referenceCode: string;
  status: EnquiryStatusValue;
  statusLabel: string;
  statusDescription: string;
  createdAt: Date;
  eventDate: Date | null;
  listings: Array<{ name: string; slug: string; statusLabel: string }>;
}

// ---------------------------------------------------------------------------
// Admin projections
// ---------------------------------------------------------------------------

export interface AdminEnquiryListRow {
  id: string;
  referenceCode: string;
  status: EnquiryStatusValue;
  createdAt: Date;
  updatedAt: Date;
  contactName: string;
  /** Masked in list views; the full value is available on the detail view. */
  contactEmailMasked: string;
  contactPhoneMasked: string;
  eventTypeName: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  isPotentialDuplicate: boolean;
  customerUserId: string | null;
  assignment: {
    assignedAdminId: string | null;
    assignedAdminName: string | null;
  } | null;
  listings: Array<{
    enquiryListingId: string;
    listingId: string;
    name: string;
    slug: string;
    status: EnquiryStatusValue;
    /**
     * Whether the provider listing has a public page. Used to gate the admin
     * "View on site" action, because a draft has no page to open.
     */
    publicationStatus: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
    assignedAdminName: string | null;
    /** When this provider lead was assigned to an administrator. */
    assignedAt: Date | null;
    /** Stage timestamps, stamped by the status machine on each transition. */
    firstContactedAt: Date | null;
    sharedWithProviderAt: Date | null;
    convertedAt: Date | null;
    lostAt: Date | null;
    lostReason: string | null;
    providerResponseNote: string | null;
  }>;
}

export interface AdminEnquiryDetail extends AdminEnquiryListRow {
  contactEmail: string;
  contactPhone: string;
  contactMethod: ContactMethodValue;
  contactCityName: string | null;
  requirements: string | null;
  referralSource: string | null;
  consentPrivacy: boolean;
  consentPolicyVersion: string | null;
  consentedAt: Date | null;
  submittedIpHash: string | null;
  activities: Array<{
    id: string;
    type: string;
    at: Date;
    actorName: string | null;
    fromStatus: EnquiryStatusValue | null;
    toStatus: EnquiryStatusValue | null;
    message: string | null;
    isCustomerVisible: boolean;
    listingName: string | null;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    authorName: string | null;
    listingName: string | null;
  }>;
}

export interface AdminEnquiryMetrics {
  total: number;
  newLast7Days: number;
  byStatus: Array<{ status: EnquiryStatusValue; count: number }>;
  unassigned: number;
  flaggedDuplicates: number;
  conversionRate: number;
  topCategories: Array<{ name: string; slug: string; count: number }>;
}
