import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { getServerEnv } from '@/lib/env';
import type {
  EmailSettingsInput,
  MetaSettingsInput,
  SiteSettingsInput,
} from '@/lib/validation/settings';
import { recordAudit } from './audit.service';

/**
 * Application settings.
 *
 * Stored as one JSON row per area (`site`, `email`, `meta`) so an operator can
 * change the hero, the email identity or the Meta integration without a deploy,
 * and so adding a field needs no migration. Defaults come from the environment,
 * which keeps a fresh install and the e2e suite working with no admin action.
 */

export interface SiteSettings {
  heroVideoUrl: string;
  heroVideoSegmentEndSeconds: number;
  contactEmail: string | null;
  announcement: string | null;
}

export interface EmailSettings {
  fromAddress: string;
  replyTo: string | null;
}

/** What pages may read: no secrets. */
export interface MetaSettings {
  enabled: boolean;
  pixelId: string | null;
  testEventCode: string | null;
}

/** What the sender may read: the decrypted token, or the env fallback. */
export interface MetaRuntimeSettings extends MetaSettings {
  capiToken: string | null;
  graphVersion: string;
}

export interface AppSettings {
  site: SiteSettings;
  email: EmailSettings;
  meta: MetaSettings;
}

/** The hero clip the site shipped with; the admin form edits it. */
const DEFAULT_HERO_VIDEO_URL =
  'https://pub-4669c5f1fbd346d6994920d5422e4d3f.r2.dev/video/hero-loop.mp4';
const DEFAULT_HERO_SEGMENT_END = 9;

export function defaultSiteSettings(): SiteSettings {
  return {
    heroVideoUrl: DEFAULT_HERO_VIDEO_URL,
    heroVideoSegmentEndSeconds: DEFAULT_HERO_SEGMENT_END,
    contactEmail: null,
    announcement: null,
  };
}

export function defaultEmailSettings(): EmailSettings {
  return { fromAddress: getServerEnv().EMAIL_FROM, replyTo: null };
}

export function defaultMetaSettings(): MetaSettings {
  const env = getServerEnv();
  return {
    enabled: Boolean(env.META_PIXEL_ID && env.META_CAPI_TOKEN),
    pixelId: env.META_PIXEL_ID ?? null,
    testEventCode: env.META_TEST_EVENT_CODE ?? null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ['site', 'email', 'meta'] } },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const site = asRecord(byKey.get('site'));
  const email = asRecord(byKey.get('email'));
  const meta = asRecord(byKey.get('meta'));

  const siteDefaults = defaultSiteSettings();
  const emailDefaults = defaultEmailSettings();
  const metaDefaults = defaultMetaSettings();

  return {
    site: {
      heroVideoUrl:
        typeof site.heroVideoUrl === 'string' ? site.heroVideoUrl : siteDefaults.heroVideoUrl,
      heroVideoSegmentEndSeconds:
        typeof site.heroVideoSegmentEndSeconds === 'number'
          ? site.heroVideoSegmentEndSeconds
          : siteDefaults.heroVideoSegmentEndSeconds,
      contactEmail: typeof site.contactEmail === 'string' ? site.contactEmail : null,
      announcement: typeof site.announcement === 'string' ? site.announcement : null,
    },
    email: {
      fromAddress:
        typeof email.fromAddress === 'string' && email.fromAddress.length > 0
          ? email.fromAddress
          : emailDefaults.fromAddress,
      replyTo: typeof email.replyTo === 'string' && email.replyTo.length > 0 ? email.replyTo : null,
    },
    meta: {
      enabled: typeof meta.enabled === 'boolean' ? meta.enabled : metaDefaults.enabled,
      pixelId:
        typeof meta.pixelId === 'string' && meta.pixelId ? meta.pixelId : metaDefaults.pixelId,
      testEventCode:
        typeof meta.testEventCode === 'string' && meta.testEventCode
          ? meta.testEventCode
          : metaDefaults.testEventCode,
    },
  };
}

/** Settings plus the decrypted CAPI token, for the server-side sender only. */
export async function getMetaRuntimeSettings(): Promise<MetaRuntimeSettings> {
  const env = getServerEnv();
  const settings = await getSettings();
  const row = await prisma.appSetting.findUnique({ where: { key: 'meta' } });
  const stored = asRecord(row?.value);

  const encrypted = typeof stored.capiToken === 'string' ? stored.capiToken : null;
  const decrypted = encrypted ? decryptSecret(encrypted, env.BETTER_AUTH_SECRET) : null;

  return {
    ...settings.meta,
    capiToken: decrypted ?? env.META_CAPI_TOKEN ?? null,
    graphVersion: env.META_GRAPH_VERSION,
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return (await getSettings()).site;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  return (await getSettings()).email;
}

export async function getMetaSettings(): Promise<MetaSettings> {
  return (await getSettings()).meta;
}

async function writeSetting(
  key: 'site' | 'email' | 'meta',
  value: Prisma.InputJsonObject,
  actor: { id: string; name: string },
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  await recordAudit({
    action: 'settings.updated',
    entityType: 'app_setting',
    entityId: key,
    summary: `Updated ${key} settings`,
    metadata: { key },
    context: { actorUserId: actor.id, actorName: actor.name },
  });
}

export async function updateSiteSettings(
  input: SiteSettingsInput,
  actor: { id: string; name: string },
): Promise<void> {
  await writeSetting(
    'site',
    {
      heroVideoUrl: input.heroVideoUrl,
      heroVideoSegmentEndSeconds: input.heroVideoSegmentEndSeconds,
      contactEmail: input.contactEmail || null,
      announcement: input.announcement ?? null,
    },
    actor,
  );
}

export async function updateEmailSettings(
  input: EmailSettingsInput,
  actor: { id: string; name: string },
): Promise<void> {
  await writeSetting(
    'email',
    { fromAddress: input.fromAddress, replyTo: input.replyTo || null },
    actor,
  );
}

export async function updateMetaSettings(
  input: MetaSettingsInput,
  actor: { id: string; name: string },
): Promise<void> {
  const env = getServerEnv();
  const existing = await prisma.appSetting.findUnique({ where: { key: 'meta' } });
  const stored = asRecord(existing?.value);

  let encryptedToken =
    typeof stored.capiToken === 'string' && stored.capiToken ? stored.capiToken : null;

  if (input.capiToken !== undefined) {
    if (input.capiToken === '-') {
      encryptedToken = null;
    } else if (input.capiToken.trim().length > 0) {
      encryptedToken = encryptSecret(input.capiToken.trim(), env.BETTER_AUTH_SECRET);
    }
  }

  await writeSetting(
    'meta',
    {
      enabled: input.enabled,
      pixelId: input.pixelId || null,
      testEventCode: input.testEventCode || null,
      capiToken: encryptedToken,
    },
    actor,
  );
}
