'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { getCurrentActor } from '@/lib/auth/actor';
import { adminVendorApplicationStatusSchema } from '@/lib/validation/vendor-application';
import {
  approveVendorApplicationSchema,
  createVendorInviteSchema,
  revokeVendorInviteSchema,
} from '@/lib/validation/vendor-invite';
import { adminSetVendorApplicationStatus } from '@/server/services/vendor-application.service';
import {
  approveVendorApplicationToListing,
  createVendorInvite,
  revokeVendorInvite,
} from '@/server/services/vendor-invite.service';

/**
 * Vendor back-office actions.
 *
 * Every action re-checks the administrator role: a Server Action is its own POST
 * endpoint, and the `/admin` layout gate does not run for it.
 */
async function requireAdminActor() {
  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous' || actor.user.role !== 'ADMIN') notFound();
  return actor;
}

const FLASH_COOKIE = 'vendor-invite-flash';

export async function setVendorApplicationStatusAction(formData: FormData): Promise<void> {
  await requireAdminActor();

  const id = String(formData.get('id') ?? '');
  const parsed = adminVendorApplicationStatusSchema.safeParse({
    status: formData.get('status'),
    note: formData.get('note') ?? undefined,
  });
  if (!id || !parsed.success) notFound();

  await adminSetVendorApplicationStatus(id, parsed.data.status, parsed.data.note ?? null);
  revalidatePath('/admin/vendor-applications');
}

/**
 * Creates a single-use onboarding link and flashes the one-time URL.
 *
 * The raw token is returned exactly once by the service and is stored only in an
 * HttpOnly, ten-minute cookie so the page can render it for copying. It is never
 * persisted in clear text.
 */
export async function createVendorInviteAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const parsed = createVendorInviteSchema.safeParse({
    email: formData.get('email') ?? '',
    applicationId: formData.get('applicationId') || undefined,
  });
  if (!parsed.success) notFound();

  const result = await createVendorInvite(
    { email: parsed.data.email || null, applicationId: parsed.data.applicationId ?? null },
    { id: actor.user.id, name: actor.user.name },
  );

  const store = await cookies();
  store.set(FLASH_COOKIE, result.link, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/admin/vendor-applications',
    maxAge: 60 * 10,
    secure: process.env.NODE_ENV === 'production',
  });

  revalidatePath('/admin/vendor-applications');
}

export async function dismissInviteFlashAction(): Promise<void> {
  await requireAdminActor();
  (await cookies()).delete(FLASH_COOKIE);
  revalidatePath('/admin/vendor-applications');
}

export async function revokeVendorInviteAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const parsed = revokeVendorInviteSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) notFound();

  await revokeVendorInvite(parsed.data.id, { id: actor.user.id, name: actor.user.name });
  revalidatePath('/admin/vendor-applications');
}

/** Approves an application and creates the draft listing, then opens that draft. */
export async function approveApplicationAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const parsed = approveVendorApplicationSchema.safeParse({
    id: formData.get('id'),
    citySlug: formData.get('citySlug'),
  });
  if (!parsed.success) notFound();

  const result = await approveVendorApplicationToListing(parsed.data, {
    id: actor.user.id,
    name: actor.user.name,
  });

  revalidatePath('/admin/vendor-applications');
  revalidatePath('/admin/listings');
  redirect(`/admin/listings/${result.listingId}`);
}
