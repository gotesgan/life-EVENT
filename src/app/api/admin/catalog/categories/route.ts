import { apiHandler, jsonOk } from '@/lib/api/response';
import { getAdminActorContext } from '@/app/api/admin/_lib/context';
import { prisma } from '@/lib/db';

/**
 * DELIBERATE EXCEPTION: direct Prisma access.
 *
 * The catalogue has no write/read service (only the public `catalog.service`
 * projections), so, by the brief, catalogue CRUD routes query Prisma directly
 * rather than growing a service that would only wrap trivial queries. Every
 * response still uses an explicit `select`, so no raw row or private column can
 * leak.
 */
const categorySelect = {
  id: true,
  slug: true,
  name: true,
  path: true,
  parentId: true,
  shortDescription: true,
  description: true,
  iconKey: true,
  heroImageUrl: true,
  metaTitle: true,
  metaDescription: true,
  isActive: true,
  sortOrder: true,
} as const;

/** GET /api/admin/catalog/categories — the full category tree, inactive included. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);

  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: categorySelect,
  });

  return jsonOk({ data: rows });
});
