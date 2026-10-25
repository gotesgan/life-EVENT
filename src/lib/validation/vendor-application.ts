import { z } from 'zod';
import { optionalText, phoneSchema, requiredText } from './common';

/**
 * Vendor self-registration.
 *
 * Four fields, and only four: the brief for this form is "name, type of vendor,
 * contact number, description". Anything else (GST number, catalogue documents,
 * pricing) belongs to the onboarding that follows an accepted application, not
 * to the first contact — a long form at the top of the funnel is how a
 * marketplace loses the supply side it is trying to recruit.
 */
export const createVendorApplicationSchema = z.object({
  businessName: requiredText(2, 160),
  /** A catalogue category slug; the service resolves it before storing. */
  vendorType: z.string().trim().min(1, 'Choose what kind of vendor you are').max(120),
  contactPhone: phoneSchema,
  description: requiredText(20, 2000),

  /**
   * Honeypot. A real browser never fills this because the field is visually
   * hidden, unlabelled and skipped by the tab order; automated submissions
   * usually do. A filled field is answered with a normal-looking success and
   * nothing is stored, so a bot has nothing to learn from the reply.
   */
  companyWebsite: optionalText(200),
});

export type CreateVendorApplicationInput = z.infer<typeof createVendorApplicationSchema>;

/** Back-office list filters. */
export const adminVendorApplicationQuerySchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'APPROVED', 'REJECTED']).optional(),
  q: z.string().trim().max(120).optional(),
});

export type AdminVendorApplicationQuery = z.infer<typeof adminVendorApplicationQuerySchema>;

export const adminVendorApplicationStatusSchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'APPROVED', 'REJECTED']),
  note: optionalText(1000),
});

export type AdminVendorApplicationStatusInput = z.infer<typeof adminVendorApplicationStatusSchema>;
