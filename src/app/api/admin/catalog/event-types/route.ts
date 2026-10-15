import { apiHandler, jsonCreated, jsonOk, readJsonBody } from '@/lib/api/response';
import { eventTypeCreateSchema } from '@/lib/validation/catalog';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { reserveEventTypeSlug } from '@/app/api/admin/_lib/catalog';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Responses use explicit `select`s.
 */

const eventTypeSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  iconKey: true,
  isActive: true,
  sortOrder: true,
} as const;

/** GET /api/admin/catalog/event-types — all event types, inactive included. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);

  const rows = await prisma.eventType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: eventTypeSelect,
  });

  return jsonOk({ data: rows });
});

/** POST /api/admin/catalog/event-types — create an event type. */
export const POST = apiHandler(async (request) => {
  const actor = await getAdminActorContext(request);
  const body = await readJsonBody(request, eventTypeCreateSchema);

  const created = await prisma.$transaction(async (tx) => {
    const slug = await reserveEventTypeSlug(tx, body.slug ?? body.name);

    const row = await tx.eventType.create({
      data: {
        slug,
        name: body.name,
        description: body.description ?? null,
        iconKey: body.iconKey ?? null,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      },
      select: eventTypeSelect,
    });

    await recordAudit(
      {
        action: 'event_type.created',
        entityType: 'EventType',
        entityId: row.id,
        summary: `Created event type "${row.name}"`,
        context: toAuditContext(actor),
      },
      tx,
    );

    return row;
  });

  return jsonCreated({ data: created });
});
