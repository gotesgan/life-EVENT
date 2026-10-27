'use server';

import { redirect } from 'next/navigation';
import { getCurrentActor } from '@/lib/auth/actor';
import {
  emailSettingsSchema,
  metaSettingsSchema,
  siteSettingsSchema,
} from '@/lib/validation/settings';
import {
  updateEmailSettings,
  updateMetaSettings,
  updateSiteSettings,
} from '@/server/services/settings.service';
import { recordAudit } from '@/server/services/audit.service';
import { sendMetaTestEvent } from '@/server/services/meta.service';

/**
 * Settings actions.
 *
 * Each action re-checks the administrator role (a Server Action is its own POST
 * endpoint) and redirects back with a query notice rather than returning a value,
 * so the page can be a plain server component.
 */
async function requireAdminActor() {
  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous' || actor.user.role !== 'ADMIN') redirect('/sign-in?next=/admin');
  return actor.user;
}

export async function saveSiteSettingsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const parsed = siteSettingsSchema.safeParse({
    heroVideoUrl: String(formData.get('heroVideoUrl') ?? ''),
    heroVideoSegmentEndSeconds: formData.get('heroVideoSegmentEndSeconds'),
    contactEmail: String(formData.get('contactEmail') ?? ''),
    announcement: String(formData.get('announcement') ?? ''),
  });
  if (!parsed.success) redirect('/admin/settings?error=site');

  await updateSiteSettings(parsed.data, { id: actor.id, name: actor.name });
  redirect('/admin/settings?saved=site');
}

export async function saveEmailSettingsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const parsed = emailSettingsSchema.safeParse({
    fromAddress: String(formData.get('fromAddress') ?? ''),
    replyTo: String(formData.get('replyTo') ?? ''),
  });
  if (!parsed.success) redirect('/admin/settings?error=email');

  await updateEmailSettings(parsed.data, { id: actor.id, name: actor.name });
  redirect('/admin/settings?saved=email');
}

export async function saveMetaSettingsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const parsed = metaSettingsSchema.safeParse({
    enabled: formData.get('enabled') === 'on' ? 'true' : 'false',
    pixelId: String(formData.get('pixelId') ?? ''),
    testEventCode: String(formData.get('testEventCode') ?? ''),
    capiToken: formData.has('capiToken') ? String(formData.get('capiToken') ?? '') : undefined,
  });
  if (!parsed.success) redirect('/admin/settings?error=meta');

  await updateMetaSettings(parsed.data, { id: actor.id, name: actor.name });
  redirect('/admin/settings?saved=meta');
}

export async function sendMetaTestAction(): Promise<void> {
  const actor = await requireAdminActor();
  const result = await sendMetaTestEvent();

  await recordAudit({
    action: 'integration.meta_test_sent',
    entityType: 'app_setting',
    entityId: 'meta',
    summary: `Sent a Meta test event (${result.status})`,
    context: { actorUserId: actor.id, actorName: actor.name },
  });

  redirect(`/admin/settings?metaTest=${result.status}`);
}
