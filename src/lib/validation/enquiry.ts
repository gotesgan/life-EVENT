import { z } from 'zod';
import { EnquiryStatus, ContactMethod } from '@/generated/prisma/enums';
import {
  emailSchema,
  idSchema,
  isoDateSchema,
  moneySchema,
  optionalText,
  phoneSchema,
  requiredText,
} from '@/lib/validation/common';

const enquiryStatusSchema = z.enum(EnquiryStatus);
const contactMethodSchema = z.enum(ContactMethod);

/** Policy version the customer accepted. Bump when the policy text changes. */
export const PRIVACY_POLICY_VERSION = '2026-02-01';

/**
 * Enquiry submission.
 *
 * `listings` carries slugs rather than ids so a shared link or a re-submitted
 * form cannot reference a draft listing by guessing a database identifier; the
 * service resolves each slug and requires it to be published.
 */
export const createEnquirySchema = z
  .object({
    listings: z
      .array(z.string().trim().min(1).max(140))
      .min(1, 'Choose at least one business')
      .max(10, 'You can enquire with up to 10 businesses at once')
      .transform((values) => Array.from(new Set(values))),

    contactName: requiredText(2, 120),
    contactEmail: emailSchema,
    contactPhone: phoneSchema,
    contactCitySlug: z.string().trim().max(120).optional(),
    contactMethod: contactMethodSchema.default('EMAIL'),

    eventTypeSlug: z.string().trim().max(120).optional(),
    eventDate: isoDateSchema.optional(),
    eventDateFlexible: z.boolean().default(true),
    guestCount: z.coerce.number().int().min(1).max(200_000).optional(),
    budgetMin: moneySchema.optional(),
    budgetMax: moneySchema.optional(),
    requirements: optionalText(4000),
    referralSource: optionalText(120),

    consentPrivacy: z.literal(true, {
      message: 'Please accept the privacy terms before sending your enquiry',
    }),
    consentPolicyVersion: z.string().trim().max(20).default(PRIVACY_POLICY_VERSION),

    /**
     * Honeypot. A real browser never fills this because the field is visually
     * hidden, is not labelled and is skipped by the tab order; automated
     * submissions usually do.
     *
     * It is deliberately **not** constrained to an empty string: a `max(0)` rule
     * would turn a bot's filled field into a 400, which both tells the bot it
     * was detected and makes the SPAM-triage branch in `createEnquiry()`
     * unreachable. Instead the value is accepted and the service stores the
     * enquiry with status `SPAM`, returning a normal-looking 201.
     */
    companyWebsite: z.string().max(200).optional(),
  })
  .refine(
    (value) =>
      value.budgetMin == null || value.budgetMax == null || value.budgetMin <= value.budgetMax,
    { message: 'Minimum budget cannot be higher than maximum budget', path: ['budgetMax'] },
  );

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

/** Customer's own enquiry list. */
export const customerEnquiryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: enquiryStatusSchema.optional(),
});

export type CustomerEnquiryQuery = z.infer<typeof customerEnquiryQuerySchema>;

/**
 * Guest progress tracking. Requires the reference code *and* the contact email,
 * so knowing one does not reveal anything about the other.
 */
export const trackEnquirySchema = z.object({
  referenceCode: z
    .string()
    .trim()
    .min(6)
    .max(24)
    .transform((value) => value.toUpperCase()),
  email: emailSchema,
});

export type TrackEnquiryInput = z.infer<typeof trackEnquirySchema>;

export const cancelEnquirySchema = z.object({
  reason: optionalText(400),
});

export const enquiryReferenceParamSchema = z.object({
  referenceCode: z
    .string()
    .trim()
    .min(6)
    .max(24)
    .transform((value) => value.toUpperCase()),
});

// ---------------------------------------------------------------------------
// Admin lead management
// ---------------------------------------------------------------------------

export const adminEnquiryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  status: enquiryStatusSchema.optional(),
  assignedAdminId: z.union([idSchema, z.literal('unassigned')]).optional(),
  categoryId: idSchema.optional(),
  listingId: idSchema.optional(),
  eventTypeId: idSchema.optional(),
  flaggedDuplicate: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .optional(),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export type AdminEnquiryQuery = z.infer<typeof adminEnquiryQuerySchema>;

/**
 * Status changes on a single provider lead. The allowed transitions are
 * enforced by `assertTransition()` in server/domain/enquiry-status.ts — the
 * schema only checks that the requested value is a real status.
 */
export const adminEnquiryStatusSchema = z.object({
  status: enquiryStatusSchema,
  note: optionalText(1000),
  /** Whether the status change appears in the customer's own timeline. */
  isCustomerVisible: z.boolean().default(true),
  lostReason: optionalText(400),
  providerResponseNote: optionalText(2000),
});

export type AdminEnquiryStatusInput = z.infer<typeof adminEnquiryStatusSchema>;

export const adminEnquiryAssignSchema = z.object({
  /** `null` unassigns the lead. */
  assignedAdminId: idSchema.nullable(),
  scope: z.enum(['lead', 'enquiry']).default('lead'),
  note: optionalText(500),
});

export type AdminEnquiryAssignInput = z.infer<typeof adminEnquiryAssignSchema>;

export const adminNoteCreateSchema = z.object({
  body: requiredText(2, 4000),
  enquiryListingId: idSchema.optional(),
  /** Promotes the note into the customer-visible activity timeline. */
  shareWithCustomer: z.boolean().default(false),
});

export type AdminNoteCreateInput = z.infer<typeof adminNoteCreateSchema>;

export const adminDuplicateFlagSchema = z.object({
  isPotentialDuplicate: z.boolean(),
  note: optionalText(1000),
});

export const adminCustomerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  role: z.enum(['CUSTOMER', 'ADMIN']).optional(),
});

export type AdminCustomerQuery = z.infer<typeof adminCustomerQuerySchema>;

export const adminCustomerUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: optionalText(400),
});

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().trim().max(60).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorUserId: z.string().trim().max(64).optional(),
});
