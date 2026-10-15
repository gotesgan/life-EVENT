import 'server-only';
import { prisma } from '@/lib/db';
import type { SelectOption } from '@/app/admin/_lib/options';

/**
 * Administrators who can appear as an audit actor.
 *
 * Inactive and suspended administrators are included: the log records who did
 * something, and filtering it must still be possible after that account was
 * later deactivated.
 */
export async function auditActorSelectOptions(): Promise<SelectOption[]> {
  const rows = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });

  return rows.map((row) => ({ value: row.id, label: `${row.name} · ${row.email}` }));
}

/**
 * Entity types the audit log actually writes.
 *
 * Kept as a literal list rather than a database `distinct` query: a filter
 * dropdown built from the current page of rows would change as the administrator
 * pages through the log, which is a confusing control. These are the
 * `entityType` values the services and catalogue routes pass to `recordAudit`.
 */
export const AUDIT_ENTITY_TYPES = [
  'BusinessListing',
  'Category',
  'AttributeDefinition',
  'CategoryAttribute',
  'AttributeOption',
  'Location',
  'EventType',
  'Amenity',
  'Enquiry',
  'User',
] as const;
