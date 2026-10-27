import 'server-only';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { sha256Hex } from '@/lib/crypto';
import { getMetaRuntimeSettings } from './settings.service';

/**
 * Meta Conversions API.
 *
 * The browser pixel and this sender describe the same events: both carry the
 * same `event_id`, and Meta deduplicates them within 48 hours. The browser event
 * is the primary signal; this is the one that survives adblockers, ITP and
 * server-rendered conversions.
 *
 * Two rules are deliberate:
 *
 *  - **Nothing throws into the business operation.** An enquiry must commit even
 *    if Meta is down or the token is wrong. Every attempt is recorded in
 *    `MetaEventLog`, so a failure is visible in the admin panel rather than lost.
 *  - **Only hashed identity leaves the server.** Email, phone and name are
 *    normalised then SHA-256'd. No plaintext PII is sent to Meta from here.
 */

export interface MetaUserInput {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  /** Any stable server-side id; hashed before sending. */
  externalId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface MetaEventInput {
  eventName: 'Lead' | 'CompleteRegistration' | 'ViewContent' | 'Contact' | 'CustomizeProduct';
  eventId: string;
  user: MetaUserInput;
  customData?: Record<string, string | number | boolean | string[]>;
  sourceUrl?: string | null;
  enquiryId?: string | null;
  /** CRM milestones are sent with `system_generated`, web conversions with `website`. */
  actionSource?: 'website' | 'system_generated';
}

function hashed(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? sha256Hex(trimmed.toLowerCase()) : undefined;
}

function hashedPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return undefined;
  const international = digits.length === 10 ? `91${digits}` : digits;
  return sha256Hex(international);
}

function splitName(name: string | null | undefined): { first?: string; last?: string } {
  if (!name) return {};
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return { first: hashed(first), last: hashed(last) };
}

async function requestContext(): Promise<{ fbc?: string; fbp?: string; sourceUrl?: string }> {
  try {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    return {
      fbc: cookieStore.get('_fbc')?.value ?? undefined,
      fbp: cookieStore.get('_fbp')?.value ?? undefined,
      sourceUrl: headerStore.get('referer') ?? undefined,
    };
  } catch {
    // Called outside a request scope (unit tests): no browser context available.
    return {};
  }
}

interface MetaResponse {
  events_received?: number;
  error?: { message?: string; type?: string };
}

export async function sendMetaEvent(input: MetaEventInput): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
  const settings = await getMetaRuntimeSettings();

  if (!settings.enabled || !settings.pixelId || !settings.capiToken) {
    return recordMetaLog(input, 'SKIPPED', null, 'Meta is not configured');
  }

  const context = await requestContext();
  const name = splitName(input.user.name);

  const userData: Record<string, unknown> = {
    em: [hashed(input.user.email)].filter(Boolean),
    ph: [hashedPhone(input.user.phone)].filter(Boolean),
    fn: [name.first].filter(Boolean),
    ln: [name.last].filter(Boolean),
    ct: [hashed(input.user.city)].filter(Boolean),
    country: [hashed(input.user.country ?? 'in')].filter(Boolean),
    external_id: [hashed(input.user.externalId)].filter(Boolean),
    client_ip_address: input.user.ipAddress ?? undefined,
    client_user_agent: input.user.userAgent ?? undefined,
    fbc: context.fbc,
    fbp: context.fbp,
  };

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.sourceUrl ?? context.sourceUrl ?? undefined,
        action_source: input.actionSource ?? 'website',
        user_data: userData,
        custom_data: input.customData ?? undefined,
      },
    ],
    ...(settings.testEventCode ? { test_event_code: settings.testEventCode } : {}),
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${settings.graphVersion}/${settings.pixelId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.capiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as MetaResponse;

    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      await recordMetaLog(input, 'FAILED', response.status, message);
      return 'FAILED';
    }

    await recordMetaLog(input, 'SENT', response.status, null);
    return 'SENT';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordMetaLog(input, 'FAILED', null, message);
    return 'FAILED';
  }
}

async function recordMetaLog(
  input: MetaEventInput,
  status: 'SENT' | 'FAILED' | 'SKIPPED',
  httpStatus: number | null,
  error: string | null,
): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
  try {
    await prisma.metaEventLog.create({
      data: {
        eventName: input.eventName,
        eventId: input.eventId,
        status,
        httpStatus,
        error: error?.slice(0, 500) ?? null,
        enquiryId: input.enquiryId ?? null,
      },
    });
  } catch (logError) {
    console.error('[meta] could not record event log', logError);
  }
  return status;
}

/** The single conversion this marketplace is optimising for. */
export async function sendMetaLeadEvent(input: {
  enquiryId: string;
  referenceCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  city?: string | null;
  eventDate?: Date | null;
  listings: { id: string; name: string }[];
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await sendMetaEvent({
    eventName: 'Lead',
    eventId: input.referenceCode,
    enquiryId: input.enquiryId,
    user: {
      email: input.customerEmail,
      phone: input.customerPhone,
      name: input.customerName,
      city: input.city,
      country: 'in',
      externalId: input.customerEmail,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
    customData: {
      content_type: 'product',
      content_ids: input.listings.map((listing) => listing.id),
      content_name: input.listings.map((listing) => listing.name).join(', '),
      currency: 'INR',
      ...(input.eventDate ? { event_date: input.eventDate.toISOString().slice(0, 10) } : {}),
    },
  });
}

/** Sends a harmless test event so an operator can verify the integration. */
export async function sendMetaTestEvent(): Promise<{
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  message: string;
}> {
  const settings = await getMetaRuntimeSettings();
  if (!settings.enabled || !settings.pixelId || !settings.capiToken) {
    return {
      status: 'SKIPPED',
      message: 'Meta is not configured: add a Pixel ID and Conversions API token first.',
    };
  }

  const status = await sendMetaEvent({
    eventName: 'Lead',
    eventId: `admin-test-${Date.now()}`,
    user: { email: 'admin@lifeevents.example', country: 'in' },
    customData: { content_name: 'Admin test event', currency: 'INR' },
    actionSource: 'website',
  });

  return {
    status,
    message:
      status === 'SENT'
        ? 'Test event accepted. Check Events Manager → Test events.'
        : 'Meta rejected the test event. Check the token, pixel ID and event log.',
  };
}
