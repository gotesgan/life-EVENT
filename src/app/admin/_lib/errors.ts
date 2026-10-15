import 'server-only';
import { isAppError } from '@/lib/errors';

/**
 * Server-side error text for admin pages.
 *
 * Services throw `AppError` subclasses with messages written for a person
 * ("Add at least one image before publishing…"), and those are exactly what an
 * administrator should read. Anything else is reported generically, so a stack
 * trace, SQL fragment or secret can never reach the browser.
 */
export function describeError(error: unknown): string {
  if (isAppError(error)) return error.message;
  return 'The server did not return a result. Try again in a moment.';
}

/** Coerces a page `searchParams` value to a single trimmed string. */
export function one(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
