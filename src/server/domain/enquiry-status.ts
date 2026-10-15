import { EnquiryStatus } from '@/generated/prisma/enums';
import { ConflictError } from '@/lib/errors';

export type EnquiryStatusValue = (typeof EnquiryStatus)[keyof typeof EnquiryStatus];

/**
 * The controlled lead lifecycle. An admin cannot invent a status: the column is
 * a Postgres enum and the allowed moves are listed here.
 *
 * Rationale for the non-obvious edges:
 *  - `CONVERTED` is only reachable from `SHARED_WITH_PROVIDER`, so the platform
 *    can never record a conversion for a lead the provider never received.
 *  - `LOST` can be reopened to `QUALIFIED` — leads do come back.
 *  - `DUPLICATE` and `SPAM` can be returned to `NEW`, so a mistaken triage
 *    decision is correctable rather than permanent.
 *  - `CONVERTED` and `CANCELLED` are final.
 */
export const ALLOWED_TRANSITIONS: Record<EnquiryStatusValue, readonly EnquiryStatusValue[]> = {
  NEW: [
    EnquiryStatus.CONTACTED,
    EnquiryStatus.QUALIFIED,
    EnquiryStatus.CANCELLED,
    EnquiryStatus.DUPLICATE,
    EnquiryStatus.SPAM,
  ],
  CONTACTED: [
    EnquiryStatus.QUALIFIED,
    EnquiryStatus.LOST,
    EnquiryStatus.CANCELLED,
    EnquiryStatus.DUPLICATE,
    EnquiryStatus.SPAM,
  ],
  QUALIFIED: [EnquiryStatus.SHARED_WITH_PROVIDER, EnquiryStatus.LOST, EnquiryStatus.CANCELLED],
  SHARED_WITH_PROVIDER: [EnquiryStatus.CONVERTED, EnquiryStatus.LOST, EnquiryStatus.CANCELLED],
  CONVERTED: [],
  LOST: [EnquiryStatus.QUALIFIED],
  CANCELLED: [],
  DUPLICATE: [EnquiryStatus.NEW],
  SPAM: [EnquiryStatus.NEW],
};

export const TERMINAL_STATUSES: readonly EnquiryStatusValue[] = [
  EnquiryStatus.CONVERTED,
  EnquiryStatus.CANCELLED,
];

/** Statuses in which the provider has been given the customer's details. */
export const PROVIDER_SHARED_STATUSES: readonly EnquiryStatusValue[] = [
  EnquiryStatus.SHARED_WITH_PROVIDER,
  EnquiryStatus.CONVERTED,
];

/** Statuses that a customer may not move the lead out of. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly EnquiryStatusValue[] = [
  EnquiryStatus.NEW,
  EnquiryStatus.CONTACTED,
  EnquiryStatus.QUALIFIED,
];

export function canTransition(from: EnquiryStatusValue, to: EnquiryStatusValue): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EnquiryStatusValue, to: EnquiryStatusValue): void {
  if (from === to) return;
  if (!canTransition(from, to)) {
    throw new ConflictError(`A lead cannot move from ${from} to ${to}`, {
      from,
      to,
      allowed: ALLOWED_TRANSITIONS[from],
    });
  }
}

export function isTerminal(status: EnquiryStatusValue): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isProviderShared(status: EnquiryStatusValue): boolean {
  return PROVIDER_SHARED_STATUSES.includes(status);
}

export function canCustomerCancel(status: EnquiryStatusValue): boolean {
  return CUSTOMER_CANCELLABLE_STATUSES.includes(status);
}

const CLOSED_OUT_SET: readonly EnquiryStatusValue[] = [
  EnquiryStatus.LOST,
  EnquiryStatus.CANCELLED,
  EnquiryStatus.DUPLICATE,
  EnquiryStatus.SPAM,
];

/**
 * Derives the overall enquiry status from its per-provider leads.
 *
 * This pure function is the single source of truth for the denormalised
 * `Enquiry.status` column, so the stored value can always be recomputed and can
 * never drift from the child rows. (ADR-9 in docs/system-design.md.)
 */
export function deriveEnquiryStatus(
  childStatuses: readonly EnquiryStatusValue[],
): EnquiryStatusValue {
  if (childStatuses.length === 0) return EnquiryStatus.NEW;

  if (childStatuses.some((s) => s === EnquiryStatus.CONVERTED)) return EnquiryStatus.CONVERTED;

  if (childStatuses.every((s) => s === EnquiryStatus.CANCELLED)) return EnquiryStatus.CANCELLED;

  // Spam and duplicate are separate triage queues: an administrator reviewing
  // spam must not have to look in the duplicate queue. A fully spam lead
  // therefore collapses to SPAM and a fully duplicated one to DUPLICATE; only a
  // mixed set reports DUPLICATE.
  if (childStatuses.every((s) => s === EnquiryStatus.SPAM)) return EnquiryStatus.SPAM;
  if (childStatuses.every((s) => s === EnquiryStatus.DUPLICATE)) return EnquiryStatus.DUPLICATE;
  if (childStatuses.every((s) => s === EnquiryStatus.DUPLICATE || s === EnquiryStatus.SPAM)) {
    return EnquiryStatus.DUPLICATE;
  }

  if (childStatuses.every((s) => CLOSED_OUT_SET.includes(s))) return EnquiryStatus.LOST;

  if (childStatuses.some((s) => s === EnquiryStatus.SHARED_WITH_PROVIDER)) {
    return EnquiryStatus.SHARED_WITH_PROVIDER;
  }
  if (childStatuses.some((s) => s === EnquiryStatus.QUALIFIED)) return EnquiryStatus.QUALIFIED;
  if (childStatuses.some((s) => s === EnquiryStatus.CONTACTED)) return EnquiryStatus.CONTACTED;

  return EnquiryStatus.NEW;
}

/**
 * Customer-facing wording. Internal operational vocabulary ("qualified",
 * "shared with provider") must never reach a customer, so the customer
 * projection uses these labels instead of the enum value.
 */
export const CUSTOMER_STATUS_LABELS: Record<EnquiryStatusValue, string> = {
  NEW: 'Sent to the business',
  CONTACTED: 'Business has been contacted',
  QUALIFIED: 'In discussion',
  SHARED_WITH_PROVIDER: 'Shared with the business',
  CONVERTED: 'Booked',
  LOST: 'Closed',
  CANCELLED: 'Cancelled',
  DUPLICATE: 'Closed',
  SPAM: 'Closed',
};

export const CUSTOMER_STATUS_DESCRIPTIONS: Record<EnquiryStatusValue, string> = {
  NEW: 'Your enquiry has reached our team. We are checking the business is available and a good fit.',
  CONTACTED: 'We have contacted the business and are waiting for their response.',
  QUALIFIED: 'The business is a good fit and is preparing details for you.',
  SHARED_WITH_PROVIDER:
    'Your details have been shared with the business. They will contact you directly.',
  CONVERTED: 'You confirmed this booking. Congratulations!',
  LOST: 'This enquiry was closed. You can send a new enquiry at any time.',
  CANCELLED: 'You cancelled this enquiry.',
  DUPLICATE: 'This enquiry was merged with another request you sent.',
  SPAM: 'This enquiry was closed.',
};

/** Statuses an admin sees in the inbox, in workflow order. */
export const ADMIN_STATUS_ORDER: readonly EnquiryStatusValue[] = [
  EnquiryStatus.NEW,
  EnquiryStatus.CONTACTED,
  EnquiryStatus.QUALIFIED,
  EnquiryStatus.SHARED_WITH_PROVIDER,
  EnquiryStatus.CONVERTED,
  EnquiryStatus.LOST,
  EnquiryStatus.CANCELLED,
  EnquiryStatus.DUPLICATE,
  EnquiryStatus.SPAM,
];
