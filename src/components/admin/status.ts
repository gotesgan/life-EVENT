import type { StatusTone, StatusVariant } from '@/components/ui/StatusBadge';

/**
 * Tone, variant and label maps for every enum the back office displays.
 *
 * These live in one module so a status never gets two different colours in two
 * screens (which is what makes an admin panel feel improvised). Tones are
 * semantic names from the shared `StatusBadge`, never hue names — no component
 * in `src/components/admin/**` names a colour.
 *
 * Two rules from `docs/marketplace-styling-guide.md` §6 shape every map below:
 *
 * 1. **A status badge never uses `--app-brand`.** That token is the action
 *    colour; a badge wearing it makes "this is a state" indistinguishable from
 *    "this does something". `brand` is therefore absent from every map here.
 *    New/urgent states take `accent`, progress takes `neutral`, terminal-good
 *    takes `success`, terminal-bad takes `danger`.
 * 2. **The soft variant is the default.** Solid fills are reserved for the two
 *    states that are genuinely terminal or genuinely need attention (`NEW` and
 *    `CONVERTED`), so a screen of twenty rows does not become a wall of colour.
 * 3. **Colour is never the only channel.** Every badge that renders these maps
 *    also carries a text label, and the status-bearing ones carry `dot`.
 */

function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export const PUBLICATION_TONES: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  UNPUBLISHED: 'warning',
  ARCHIVED: 'neutral',
};

export const PUBLICATION_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  UNPUBLISHED: 'Unpublished',
  ARCHIVED: 'Archived',
};

export const VERIFICATION_TONES: Record<string, StatusTone> = {
  UNVERIFIED: 'neutral',
  PENDING: 'accent',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

export const VERIFICATION_LABELS: Record<string, string> = {
  UNVERIFIED: 'Unverified',
  PENDING: 'Verification pending',
  VERIFIED: 'Verified',
  REJECTED: 'Verification rejected',
};

export const ENQUIRY_TONES: Record<string, StatusTone> = {
  // Accent, not brand: "needs attention" is the amber tone, and the blue is
  // spent on the buttons that actually move the lead (§6.4).
  NEW: 'accent',
  CONTACTED: 'neutral',
  QUALIFIED: 'success',
  SHARED_WITH_PROVIDER: 'success',
  CONVERTED: 'success',
  LOST: 'danger',
  CANCELLED: 'neutral',
  DUPLICATE: 'warning',
  SPAM: 'neutral',
};

/**
 * Variant per lead status. Soft is the default; only the two states that are
 * genuinely urgent or genuinely terminal earn a saturated fill (§6.5.5).
 */
export const ENQUIRY_VARIANTS: Record<string, StatusVariant> = {
  NEW: 'solid',
  CONVERTED: 'solid',
  SPAM: 'outline',
};

export const ENQUIRY_LABELS: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  SHARED_WITH_PROVIDER: 'Shared with provider',
  CONVERTED: 'Converted',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
  DUPLICATE: 'Duplicate',
  SPAM: 'Spam',
};

export const CUSTOMER_TONES: Record<string, StatusTone> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'neutral',
};

/**
 * `ADMIN` is `accent`, not `brand`: the role badge states a fact about an
 * account, and the action colour is not available to a badge (§6.4).
 */
export const ROLE_TONES: Record<string, StatusTone> = {
  ADMIN: 'accent',
  CUSTOMER: 'neutral',
};

export const MEDIA_TONES: Record<string, StatusTone> = {
  READY: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
};

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  COUNTRY: 'Country',
  STATE: 'State',
  CITY: 'City',
  LOCALITY: 'Locality',
};

export const ATTRIBUTE_DATA_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  BOOLEAN: 'Yes / no',
  DATE: 'Date',
  SINGLE_SELECT: 'Single select',
  MULTI_SELECT: 'Multi select',
};

export const FILTER_CONTROL_LABELS: Record<string, string> = {
  CHECKBOX: 'Checkbox list',
  RADIO: 'Radio list',
  MULTI_SELECT: 'Multi select',
  SINGLE_SELECT: 'Single select',
  RANGE: 'Numeric range',
  SLIDER: 'Slider',
  BOOLEAN: 'Toggle',
  DATE: 'Date',
  TEXT: 'Free text',
};

export const CONTACT_METHOD_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  WHATSAPP: 'WhatsApp',
};

/**
 * Activity types shown in the enquiry history.
 *
 * The label is the operational wording, not the customer-facing one: this list
 * only ever renders in the admin panel, where "Assigned" is the useful word.
 */
export const ENQUIRY_ACTIVITY_LABELS: Record<string, string> = {
  CREATED: 'Enquiry received',
  STATUS_CHANGED: 'Status changed',
  ASSIGNED: 'Assigned',
  UNASSIGNED: 'Unassigned',
  NOTE_ADDED: 'Note added',
  CUSTOMER_UPDATED: 'Enquiry updated',
  CONTACT_DISCLOSED: 'Contact details shared',
  DUPLICATE_FLAGGED: 'Duplicate flagged',
  PROVIDER_RESPONSE_RECORDED: 'Provider response recorded',
  CANCELLED_BY_CUSTOMER: 'Cancelled by customer',
};

/** User-account statuses (moderation). Distinct from the enquiry-status map of
 * the same concept in `server/domain/enquiry-status.ts`, which is customer
 * wording for a *lead*, not an account. */
export const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};

export function labelFor(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—';
  return map[value] ?? humanise(value);
}

export function titleCaseUnderscored(value: string): string {
  return humanise(value);
}
