import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { amenityUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { refreshSearchTextForAmenity } from '@/server/services/listing-search-text';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/amenities/[id] — update or deactivate an amenity.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Deactivation is a flag rather than a delete, because amenities are
 * referenced by live listings and removing the row would orphan them.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, amenityUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.amenity.findUnique({
        where: { id },
        select: { id: true, label: true },
      });
      if (!existing) throw new NotFoundError('Amenity');

      const row = await tx.amenity.update({
        where: { id },
        data: {
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.groupLabel !== undefined ? { groupLabel: body.groupLabel ?? null } : {}),
          ...(body.iconKey !== undefined ? { iconKey: body.iconKey ?? null } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: {
          id: true,
          code: true,
          label: true,
          groupLabel: true,
          iconKey: true,
          isActive: true,
          sortOrder: true,
        },
      });

      await recordAudit(
        {
          action: 'amenity.updated',
          entityType: 'Amenity',
          entityId: id,
          summary: `Updated amenity "${existing.label}"`,
          metadata: { fields: Object.keys(body) },
          context: toAuditContext(actor),
        },
        tx,
      );

      return row;
    });

    // `searchText` embeds catalogue names, so a rename must not leave every
    // listing's haystack holding the previous word. This runs after the rename
    // has committed, and only when the name actually changed.
    if (updated && body.label !== undefined) {
      await refreshSearchTextForAmenity(id);
    }

    return jsonOk({ data: updated });
  },
);
