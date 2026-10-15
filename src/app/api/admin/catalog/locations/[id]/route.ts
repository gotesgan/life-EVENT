import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { locationUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { refreshSearchTextForLocation } from '@/server/services/listing-search-text';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/locations/[id] — update or deactivate a location.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. `path` is derived from the parent chain on the server and is never
 * accepted from the client, because it is what makes subtree queries a single
 * indexed range scan.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, locationUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.location.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!existing) throw new NotFoundError('Location');

      const row = await tx.location.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.type !== undefined ? { type: body.type } : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId ?? null } : {}),
          ...(body.latitude !== undefined ? { latitude: body.latitude ?? null } : {}),
          ...(body.longitude !== undefined ? { longitude: body.longitude ?? null } : {}),
          ...(body.heroImageUrl !== undefined ? { heroImageUrl: body.heroImageUrl ?? null } : {}),
          ...(body.description !== undefined ? { description: body.description ?? null } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          path: true,
          parentId: true,
          latitude: true,
          longitude: true,
          isActive: true,
          sortOrder: true,
        },
      });

      await recordAudit(
        {
          action: 'location.updated',
          entityType: 'Location',
          entityId: id,
          summary: `Updated location "${existing.name}"`,
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
    if (updated && body.name !== undefined) {
      await refreshSearchTextForLocation(id);
    }

    return jsonOk({ data: updated });
  },
);
