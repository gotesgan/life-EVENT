import { z } from 'zod';
import { optionalText, phoneSchema, requiredText } from './common';

/** A token arrives from a URL; it is opaque, random and single-use. */
export const vendorInviteTokenSchema = z
  .string()
  .trim()
  .min(20, 'This link is not complete')
  .max(200);

export const createVendorInviteSchema = z.object({
  /** Optional: an invite can be sent before the address is known. */
  email: z.string().trim().email().or(z.literal('')),
  applicationId: optionalText(40),
});
export type CreateVendorInviteInput = z.infer<typeof createVendorInviteSchema>;

/** The onboarding form a vendor fills in from the invite link. */
export const vendorOnboardingSchema = z.object({
  token: vendorInviteTokenSchema,
  businessName: requiredText(2, 160),
  /** Catalogue category slug, resolved against the live catalogue. */
  vendorType: z.string().trim().min(1, 'Choose what kind of vendor you are').max(120),
  /** Location slug (a city), resolved against the live catalogue. */
  citySlug: z.string().trim().min(1, 'Choose a city').max(120),
  contactName: requiredText(2, 120),
  contactPhone: phoneSchema,
  contactEmail: z.string().trim().email('Enter a valid email address'),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Start with https://'),
  description: requiredText(20, 4000),
  /** Optional first package; all fields can be omitted independently. */
  packageName: optionalText(120),
  packageDescription: optionalText(2000),
  packagePrice: z
    .union([z.literal(''), z.coerce.number().int().min(0).max(1_000_000_000)])
    .optional(),
  packagePriceUnit: z
    .enum(['PER_EVENT', 'PER_PERSON', 'PER_PLATE', 'PER_HOUR', 'PER_DAY', 'PER_PACKAGE'])
    .or(z.literal(''))
    .optional(),
  packageInclusions: optionalText(2000),
  menuImageUrl: z.string().trim().url().max(1000).or(z.literal('')).optional(),
  imageUrls: z.array(z.string().trim().url().max(1000)).max(10).optional(),
  /** Honeypot, same contract as the public short form. */
  companyWebsite: optionalText(200),
});
export type VendorOnboardingInput = z.infer<typeof vendorOnboardingSchema>;

export const revokeVendorInviteSchema = z.object({ id: z.string().min(1).max(40) });

/** The admin approving an application into a listing draft. */
export const approveVendorApplicationSchema = z.object({
  id: z.string().min(1).max(40),
  citySlug: z.string().trim().min(1).max(120),
});
