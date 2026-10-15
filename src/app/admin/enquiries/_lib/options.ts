import 'server-only';
import { prisma } from '@/lib/db';
import type { SelectOption } from '@/app/admin/_lib/options';

/**
 * Select options that only the enquiry screens need.
 *
 * `categorySelectOptions`/`eventTypeSelectOptions` already live in
 * `app/admin/_lib/options.ts` and are reused from there; these two have no other
 * caller, so they stay next to the inbox rather than growing the shared module.
 */

/**
 * Active administrators, for the assignment control.
 *
 * Only `ACTIVE` admins are offered: the assign service refuses an inactive or
 * non-admin target, so offering one would be a control that can only fail.
 */
export async function assigneeSelectOptions(): Promise<SelectOption[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });

  return rows.map((row) => ({ value: row.id, label: row.name }));
}

/**
 * Listings that can carry a lead, for the "filter by business" control.
 *
 * Archived listings are excluded — they can no longer receive an enquiry. The
 * cap keeps the payload bounded; the control is searchable, and an
 * administrator filtering by a business that is not in the first 500 would be
 * looking at a directory far larger than this deployment is designed for.
 */
export async function listingFilterOptions(limit = 500): Promise<SelectOption[]> {
  const rows = await prisma.businessListing.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
    take: limit,
    select: { id: true, name: true },
  });

  return rows.map((row) => ({ value: row.id, label: row.name }));
}
