import { z } from 'zod';

/**
 * Administrative actions recorded in `AuditLog`.
 *
 * Kept as a closed Zod enum in application code rather than a database enum:
 * audit actions are extended far more often than domain statuses, and a
 * logging table should never require a migration to add a new event type. The
 * closed set still means no arbitrary string can be written.
 */
export const AUDIT_ACTIONS = [
  // Listings
  'listing.created',
  'listing.updated',
  'listing.published',
  'listing.unpublished',
  'listing.archived',
  'listing.restored',
  'listing.verified',
  'listing.unverified',
  'listing.featured',
  'listing.unfeatured',
  'listing.attributes_updated',
  'listing.media_attached',
  'listing.media_uploaded',
  'listing.media_removed',
  'listing.media_verified',
  // Catalogue
  'category.created',
  'category.updated',
  'category.archived',
  'attribute.created',
  'attribute.updated',
  'attribute.bound',
  'attribute.unbound',
  'attribute_option.created',
  'attribute_option.updated',
  'location.created',
  'location.updated',
  'event_type.created',
  'event_type.updated',
  'amenity.created',
  'amenity.updated',
  // Enquiries
  'enquiry.assigned',
  'enquiry.unassigned',
  'enquiry.status_changed',
  'enquiry.note_added',
  'enquiry.contact_disclosed',
  'enquiry.flagged_duplicate',
  'enquiry.unflagged_duplicate',
  // Vendor onboarding + settings
  'vendor_invite.created',
  'vendor_invite.revoked',
  'vendor_invite.submitted',
  'vendor_application.approved_to_listing',
  'settings.updated',
  'integration.meta_test_sent',
  // Customers
  'customer.suspended',
  'customer.reactivated',
  'customer.deactivated',
  'customer.profile_updated',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: auditActionSchema.optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorUserId: z.string().trim().max(64).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
