import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { eventTypeUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { refreshSearchTextForEventType } from '@/server/services/listing-search-text';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/event-types/[id] — update or deactivate an event type.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, eventTypeUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.eventType.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!existing) throw new NotFoundError('Event type');

      const row = await tx.eventType.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.description !== undefined ? { description: body.description ?? null } : {}),
          ...(body.iconKey !== undefined ? { iconKey: body.iconKey ?? null } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconKey: true,
          isActive: true,
          sortOrder: true,
        },
      });

      await recordAudit(
        {
          action: 'event_type.updated',
          entityType: 'EventType',
          entityId: id,
          summary: `Updated event type "${existing.name}"`,
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
      await refreshSearchTextForEventType(id);
    }

    return jsonOk({ data: updated });
  },
);
