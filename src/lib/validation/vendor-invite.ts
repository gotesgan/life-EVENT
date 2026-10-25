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
