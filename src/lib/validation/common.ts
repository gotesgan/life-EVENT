import { z } from 'zod';

/** Shared primitives so identifier and pagination rules cannot drift. */

export const idSchema = z.string().trim().min(1).max(64);
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase slug such as "banquet-halls"');

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value), {
    message: 'Enter a valid email address',
  });

/**
 * Phone numbers are stored with the formatting the customer typed, and are only
 * matched on their digits (see server/domain/contact.ts).
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(24)
  .refine((value) => value.replace(/\D/g, '').length >= 10, {
    message: 'Enter a phone number with at least 10 digits',
  });

/** ISO calendar date (`YYYY-MM-DD`) parsed as UTC midnight. */
export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), { message: 'Enter a valid date' });

export const optionalIsoDateSchema = isoDateSchema.optional();

/** Non-negative whole rupees / counts. */
export const moneySchema = z.coerce.number().int().min(0).max(1_000_000_000);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const requiredText = (min: number, max: number) => z.string().trim().min(min).max(max);

export const booleanFlagSchema = z
  .union([z.boolean(), z.literal('true'), z.literal('false')])
  .transform((value) => value === true || value === 'true');

export const cuidListSchema = (max = 50) =>
  z
    .array(idSchema)
    .max(max)
    .transform((values) => Array.from(new Set(values)));
