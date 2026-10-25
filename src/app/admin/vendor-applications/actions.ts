'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { getCurrentActor } from '@/lib/auth/actor';
import { adminVendorApplicationStatusSchema } from '@/lib/validation/vendor-application';
import { adminSetVendorApplicationStatus } from '@/server/services/vendor-application.service';

/**
 * Moves one vendor application through the review pipeline.
 *
 * A Server Action rather than a route handler because the only caller is the
 * form in the back office, and the page must re-render with the new status
 * afterwards. The admin check is repeated here even though the `/admin` layout
 * already gates the page: an action is a POST endpoint of its own, and the
 * layout's gate does not run for it.
 */
export async function setVendorApplicationStatusAction(formData: FormData): Promise<void> {
  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous' || actor.user.role !== 'ADMIN') notFound();

  const id = String(formData.get('id') ?? '');
  const parsed = adminVendorApplicationStatusSchema.safeParse({
    status: formData.get('status'),
  });
  if (!id || !parsed.success) notFound();

  await adminSetVendorApplicationStatus(id, parsed.data.status, null);
  revalidatePath('/admin/vendor-applications');
}
