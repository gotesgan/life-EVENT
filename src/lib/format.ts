/**
 * Presentation formatting helpers.
 *
 * Deliberately free of `server-only` and of any framework import so the same
 * functions are used by Server Components, Client Components and tests. That
 * guarantees a price or a date never renders differently in two places.
 */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return inr.format(amount);
}

export const PRICE_UNIT_LABELS = {
  PER_EVENT: 'per event',
  PER_PERSON: 'per person',
  PER_PLATE: 'per plate',
  PER_DAY: 'per day',
  PER_HOUR: 'per hour',
  PER_PACKAGE: 'per package',
} as const;

export type PriceUnitValue = keyof typeof PRICE_UNIT_LABELS;

export function formatPriceUnit(unit: PriceUnitValue | null | undefined): string | null {
  return unit ? PRICE_UNIT_LABELS[unit] : null;
}

export interface PriceRangeInput {
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: PriceUnitValue | string | null;
}

/**
 * Formats a published price range honestly.
 *
 * The reference research found that competitor sites routinely mis-render
 * unknown or negotiable prices (equal struck-through values, `Rs. 950 - 0`,
 * empty lines). This function returns `null` rather than a fake `₹0`, and only
 * shows a "From" or "Up to" prefix when one bound is genuinely known.
 */
export function formatPriceRange(input: PriceRangeInput): string | null {
  const { priceMin, priceMax, priceUnit } = input;
  const unit = formatPriceUnit(priceUnit as PriceUnitValue | null);

  const min = typeof priceMin === 'number' && priceMin > 0 ? priceMin : null;
  const max = typeof priceMax === 'number' && priceMax > 0 ? priceMax : null;

  const withUnit = (value: string) => (unit ? `${value} ${unit}` : value);

  if (min !== null && max !== null) {
    if (min === max) return withUnit(formatCurrency(min));
    return withUnit(`${formatCurrency(min)} – ${formatCurrency(max)}`);
  }
  if (min !== null) return withUnit(`From ${formatCurrency(min)}`);
  if (max !== null) return withUnit(`Up to ${formatCurrency(max)}`);
  return null;
}

export function formatCapacityRange(
  capacityMin: number | null,
  capacityMax: number | null,
): string | null {
  if (capacityMin && capacityMax && capacityMin !== capacityMax) {
    return `${capacityMin}–${capacityMax} guests`;
  }
  if (capacityMax) return `Up to ${capacityMax} guests`;
  if (capacityMin) return `From ${capacityMin} guests`;
  return null;
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string | null {
  const datePart = formatDate(value);
  if (!datePart) return null;
  const date = typeof value === 'string' ? new Date(value) : (value as Date);
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
  return `${datePart}, ${time}`;
}

export function formatRelative(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return formatDate(date) ?? '';
}

/** Truncates at a word boundary without cutting a word in half. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Masks an email for display in admin/audit contexts: `a***@example.com`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/**
 * Masks all but the last four digits of a phone number.
 *
 * Lives beside `maskEmail` so the two masking rules are read together: a
 * projection that masks one channel and not the other is the mistake this
 * arrangement makes visible.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `••••••${digits.slice(-4)}`;
}
