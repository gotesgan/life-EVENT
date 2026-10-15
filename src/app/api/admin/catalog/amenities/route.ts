import { apiHandler, jsonCreated, jsonOk, readJsonBody } from '@/lib/api/response';
import { amenityCreateSchema } from '@/lib/validation/catalog';
import { ConflictError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Responses use explicit `select`s.
 */

const amenitySelect = {
  id: true,
  code: true,
  label: true,
  groupLabel: true,
  iconKey: true,
  isActive: true,
  sortOrder: true,
} as const;

/** GET /api/admin/catalog/amenities — all amenities, inactive included. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);

  const rows = await prisma.amenity.findMany({
    orderBy: [{ groupLabel: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    select: amenitySelect,
  });

  return jsonOk({ data: rows });
});

/** POST /api/admin/catalog/amenities — create an amenity. */
export const POST = apiHandler(async (request) => {
  const actor = await getAdminActorContext(request);
  const body = await readJsonBody(request, amenityCreateSchema);

  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.amenity.findUnique({
      where: { code: body.code },
      select: { id: true },
    });
    if (existing) throw new ConflictError('An amenity with that code already exists');

    const row = await tx.amenity.create({
      data: {
        code: body.code,
        label: body.label,
        groupLabel: body.groupLabel ?? null,
        iconKey: body.iconKey ?? null,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      },
      select: amenitySelect,
    });

    await recordAudit(
      {
        action: 'amenity.created',
        entityType: 'Amenity',
        entityId: row.id,
        summary: `Created amenity "${row.label}"`,
        context: toAuditContext(actor),
      },
      tx,
    );

    return row;
  });

  return jsonCreated({ data: created });
});
