import { apiHandler, jsonCreated, jsonOk, readJsonBody } from '@/lib/api/response';
import { locationCreateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { buildChildPath, reserveLocationSlug } from '@/app/api/admin/_lib/catalog';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. The materialised `path` is maintained by `_lib/catalog.ts`.
 */

const locationSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  path: true,
  parentId: true,
  latitude: true,
  longitude: true,
  heroImageUrl: true,
  description: true,
  isActive: true,
  sortOrder: true,
} as const;

/** GET /api/admin/catalog/locations — all locations, inactive included. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);

  const rows = await prisma.location.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: locationSelect,
  });

  return jsonOk({ data: rows });
});

/** POST /api/admin/catalog/locations — create a location node. */
export const POST = apiHandler(async (request) => {
  const actor = await getAdminActorContext(request);
  const body = await readJsonBody(request, locationCreateSchema);

  const created = await prisma.$transaction(async (tx) => {
    let parentPath: string | null = null;
    if (body.parentId) {
      const parent = await tx.location.findUnique({
        where: { id: body.parentId },
        select: { path: true },
      });
      if (!parent) throw new NotFoundError('Parent location');
      parentPath = parent.path;
    }

    const slug = await reserveLocationSlug(tx, body.slug ?? body.name);
    const path = buildChildPath(parentPath, slug);

    const row = await tx.location.create({
      data: {
        slug,
        path,
        name: body.name,
        type: body.type,
        parentId: body.parentId ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        heroImageUrl: body.heroImageUrl ?? null,
        description: body.description ?? null,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      },
      select: locationSelect,
    });

    await recordAudit(
      {
        action: 'location.created',
        entityType: 'Location',
        entityId: row.id,
        summary: `Created location "${row.name}"`,
        context: toAuditContext(actor),
      },
      tx,
    );

    return row;
  });

  return jsonCreated({ data: created });
});
