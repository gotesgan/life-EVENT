import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { categoryUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { refreshSearchTextForCategory } from '@/server/services/listing-search-text';
import {
  assertCategoryParent,
  buildChildPath,
  cascadeCategoryPath,
  reserveCategorySlug,
} from '@/app/api/admin/_lib/catalog';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/categories/[id]
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Slug uniqueness, the materialised `path` and descendant path repair
 * are handled by the helpers in `_lib/catalog.ts`; the response is an explicit
 * `select`, never a raw row.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, categoryUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({
        where: { id },
        select: { id: true, slug: true, name: true, path: true, parentId: true, isActive: true },
      });
      if (!existing) throw new NotFoundError('Category');

      const parentId = body.parentId !== undefined ? body.parentId : existing.parentId;
      let parentPath: string | null = null;
      if (parentId) {
        const parent = await assertCategoryParent(tx, id, parentId, existing.path);
        parentPath = parent.path;
      }

      const slug =
        body.slug !== undefined && body.slug !== existing.slug
          ? await reserveCategorySlug(tx, body.slug, id)
          : existing.slug;
      const path = buildChildPath(parentPath, slug);

      const row = await tx.category.update({
        where: { id },
        data: {
          slug,
          path,
          parentId,
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.shortDescription !== undefined
            ? { shortDescription: body.shortDescription ?? null }
            : {}),
          ...(body.description !== undefined ? { description: body.description ?? null } : {}),
          ...(body.iconKey !== undefined ? { iconKey: body.iconKey ?? null } : {}),
          ...(body.heroImageUrl !== undefined ? { heroImageUrl: body.heroImageUrl ?? null } : {}),
          ...(body.metaTitle !== undefined ? { metaTitle: body.metaTitle ?? null } : {}),
          ...(body.metaDescription !== undefined
            ? { metaDescription: body.metaDescription ?? null }
            : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: {
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
        },
      });

      if (path !== existing.path) {
        await cascadeCategoryPath(tx, existing.path, path);
      }

      const archived = existing.isActive && body.isActive === false;

      await recordAudit(
        {
          action: archived ? 'category.archived' : 'category.updated',
          entityType: 'Category',
          entityId: id,
          summary: archived ? `Archived category "${row.name}"` : `Updated category "${row.name}"`,
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
      await refreshSearchTextForCategory(id);
    }

    return jsonOk({ data: updated });
  },
);
