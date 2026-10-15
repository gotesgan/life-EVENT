import { createHash, randomBytes } from 'node:crypto';
import type { EnquiryStatusValue } from '@/server/domain/enquiry-status';
import { isProviderShared } from '@/server/domain/enquiry-status';

/** Lowercase + trim. The canonical form stored and matched on. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalises a phone number to digits for *matching only*.
 *
 * Indian numbers are stored and compared by their last 10 digits so that
 * `+91 98765 43210`, `098765-43210` and `9876543210` are recognised as the same
 * contact for duplicate detection, while the original formatting the customer
 * typed is preserved in `Enquiry.contactPhone`.
 */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function areSameContact(
  a: { email?: string | null; phone?: string | null },
  b: { email?: string | null; phone?: string | null },
): boolean {
  const emailMatch =
    Boolean(a.email) && Boolean(b.email) && normaliseEmail(a.email!) === normaliseEmail(b.email!);

  const phoneA = a.phone ? normalisePhone(a.phone) : '';
  const phoneB = b.phone ? normalisePhone(b.phone) : '';
  const phoneMatch = phoneA.length >= 10 && phoneA === phoneB;

  return emailMatch || phoneMatch;
}

/**
 * IP addresses are never stored. A salted hash is enough to rate-limit and to
 * correlate abuse without retaining personal data.
 */
export function hashIp(ip: string | null | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

/** Stable hash of a request payload, used to detect idempotency-key misuse. */
export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/** Deterministic JSON stringify (object keys sorted) so hashes are stable. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);

  return `{${entries.join(',')}}`;
}

/** Human-facing enquiry reference, e.g. `LE-7K3M9QP2`. */
export function generateReferenceCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return `LE-${code}`;
}

export interface ContactDisclosureInput {
  contactPhone: string | null;
  contactEmail: string | null;
  contactWhatsapp: string | null;
  websiteUrl: string | null;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;
}

export interface DisclosedContact {
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  /** True when at least one value was withheld from this viewer. */
  hasWithheldChannels: boolean;
}

/**
 * Decides which provider contact channels a given viewer may see.
 *
 * Two independent gates:
 *  1. The per-channel `show*` flag the administrator set on the listing.
 *  2. The lead stage. A channel that is *not* published publicly is disclosed
 *     only once the customer's lead has actually been shared with the provider,
 *     because handing over a private phone number before then would let anyone
 *     harvest contacts without a real enquiry.
 *
 * `leadStatus` is `null` for a visitor with no lead against this listing.
 */
export function deriveContactDisclosure(
  listing: ContactDisclosureInput,
  leadStatus: EnquiryStatusValue | null,
): DisclosedContact {
  const shared = leadStatus ? isProviderShared(leadStatus) : false;

  const gate = (published: boolean, value: string | null): string | null => {
    if (!value) return null;
    if (published) return value;
    return shared ? value : null;
  };

  const phone = gate(listing.showPhone, listing.contactPhone);
  const email = gate(listing.showEmail, listing.contactEmail);
  const whatsapp = gate(listing.showWhatsapp, listing.contactWhatsapp);
  const website = gate(listing.showWebsite, listing.websiteUrl);

  const anyPrivateConfigured =
    (!listing.showPhone && Boolean(listing.contactPhone)) ||
    (!listing.showEmail && Boolean(listing.contactEmail)) ||
    (!listing.showWhatsapp && Boolean(listing.contactWhatsapp)) ||
    (!listing.showWebsite && Boolean(listing.websiteUrl));

  const hasWithheldChannels = anyPrivateConfigured && !shared;

  return { phone, email, whatsapp, website, hasWithheldChannels };
}
