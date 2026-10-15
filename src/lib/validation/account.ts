import { z } from 'zod';
import { ContactMethod } from '@/generated/prisma/enums';
import { optionalText, phoneSchema, requiredText } from '@/lib/validation/common';

/**
 * Customer account management.
 *
 * Deliberately narrow: `email`, `role` and `status` are not updatable here.
 * Email changes require a verification flow that the MVP does not ship, and
 * role/status are administrator-owned. Accepting them would let a customer
 * change their identity or their own permissions.
 */
export const customerProfileUpdateSchema = z.object({
  name: requiredText(2, 120).optional(),
  phone: phoneSchema.optional(),
  citySlug: z.string().trim().max(120).nullable().optional(),
  preferredContactMethod: z.enum(ContactMethod).optional(),
  marketingConsent: z.boolean().optional(),
});

export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateSchema>;

export const accountQuerySchema = z.object({}).default({});

export const contactPreferencesSchema = z.object({
  preferredContactMethod: z.enum(ContactMethod),
  marketingConsent: z.boolean(),
});

export type ContactPreferencesInput = z.infer<typeof contactPreferencesSchema>;

/** Used by the public "request a callback"-style contact form. */
export const contactMessageSchema = z.object({
  name: requiredText(2, 120),
  email: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .transform((value) => value.toLowerCase())
    .refine((value) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value), {
      message: 'Enter a valid email address',
    }),
  subject: optionalText(160),
  message: requiredText(10, 4000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
