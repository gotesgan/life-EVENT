import type { ContactMethod } from '@/generated/prisma/enums';

export type ContactMethodValue = (typeof ContactMethod)[keyof typeof ContactMethod];

/**
 * The three contact methods the domain supports, in one place.
 *
 * The account overview, the profile form and any future surface all read from
 * here, so a fourth method could never be added to the enum and silently missing
 * from one of them.
 */
export const CONTACT_METHOD_OPTIONS: ReadonlyArray<{
  value: ContactMethodValue;
  label: string;
}> = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone call' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

export function contactMethodLabel(value: ContactMethodValue): string {
  return CONTACT_METHOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
