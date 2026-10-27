import { z } from 'zod';
import { optionalText } from './common';

/**
 * Admin-editable settings.
 *
 * These are the values an operator may change without a deploy: the home hero,
 * the outbound email identity, and the Meta integration. Secrets never travel
 * back to the browser — the Meta token is submitted write-only and stored
 * encrypted.
 */

export const siteSettingsSchema = z.object({
  heroVideoUrl: z.string().url().or(z.literal('')),
  heroVideoSegmentEndSeconds: z.coerce.number().min(1).max(120),
  contactEmail: z.string().email().or(z.literal('')),
  announcement: optionalText(280),
});

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

export const emailSettingsSchema = z.object({
  fromAddress: z.string().min(3).max(200),
  replyTo: z.string().email().or(z.literal('')),
});

export type EmailSettingsInput = z.infer<typeof emailSettingsSchema>;

export const metaSettingsSchema = z.object({
  enabled: z.union([z.literal('true'), z.literal('false')]).transform((value) => value === 'true'),
  pixelId: z
    .string()
    .trim()
    .max(32)
    .refine((value) => value === '' || /^\d{8,20}$/.test(value), 'A Pixel ID is numeric'),
  testEventCode: z
    .string()
    .trim()
    .max(40)
    .refine(
      (value) => value === '' || /^[A-Z0-9_]{2,40}$/i.test(value),
      'Use the code from Events Manager',
    ),
  /**
   * Write-only. An empty value means "keep the stored token" so an operator can
   * change the pixel ID without re-pasting the secret; a single dash clears it.
   */
  capiToken: z.string().max(500).optional(),
});

export type MetaSettingsInput = z.infer<typeof metaSettingsSchema>;

export const SETTING_KEYS = ['site', 'email', 'meta'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
