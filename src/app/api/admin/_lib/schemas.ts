import { z } from 'zod';
import { optionalText } from '@/lib/validation/common';
import { adminEnquiryStatusSchema } from '@/lib/validation/enquiry';

/**
 * Route-level schemas that compose the shared validation vocabulary.
 *
 * Composed here rather than added to `src/lib/validation/**` so the service
 * contract stays untouched: these shapes exist only to carry a route parameter
 * into an existing service call.
 */

export const publicationActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive', 'restore']),
  reason: optionalText(400),
});

export const verificationActionSchema = z.object({
  action: z.enum(['verify', 'reject', 'reset']),
  reason: optionalText(400),
});

/**
 * The lead-status payload plus the optional `enquiryListingId` that narrows the
 * change to one provider lead. `adminEnquiryStatusSchema` itself is unchanged.
 */
export const adminLeadStatusSchema = adminEnquiryStatusSchema.extend({
  enquiryListingId: z.string().min(1).optional(),
});

/** Optional filter for the attribute-option list. */
export const attributeOptionListQuerySchema = z.object({
  attributeId: z.string().trim().min(1).max(64).optional(),
});
