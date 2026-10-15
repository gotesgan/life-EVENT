import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { categoryAttributeUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/category-attributes/[id] — update a binding.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, categoryAttributeUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.categoryAttribute.findUnique({
        where: { id },
        select: { id: true, attribute: { select: { label: true } } },
      });
      if (!existing) throw new NotFoundError('Attribute binding');

      const row = await tx.categoryAttribute.update({
        where: { id },
        data: {
          ...(body.isRequired !== undefined ? { isRequired: body.isRequired } : {}),
          ...(body.isFilterable !== undefined ? { isFilterable: body.isFilterable } : {}),
          ...(body.isSearchable !== undefined ? { isSearchable: body.isSearchable } : {}),
          ...(body.isVisibleOnProfile !== undefined
            ? { isVisibleOnProfile: body.isVisibleOnProfile }
            : {}),
          ...(body.isComparable !== undefined ? { isComparable: body.isComparable } : {}),
          ...(body.showOnCard !== undefined ? { showOnCard: body.showOnCard } : {}),
          ...(body.filterControl !== undefined
            ? { filterControl: body.filterControl ?? null }
            : {}),
          ...(body.groupLabel !== undefined ? { groupLabel: body.groupLabel ?? null } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: {
          id: true,
          categoryId: true,
          attributeId: true,
          isRequired: true,
          isFilterable: true,
          isSearchable: true,
          isVisibleOnProfile: true,
          isComparable: true,
          showOnCard: true,
          filterControl: true,
          groupLabel: true,
          sortOrder: true,
        },
      });

      await recordAudit(
        {
          action: 'attribute.bound',
          entityType: 'CategoryAttribute',
          entityId: id,
          summary: `Updated the binding for "${existing.attribute.label}"`,
          metadata: { fields: Object.keys(body) },
          context: toAuditContext(actor),
        },
        tx,
      );

      return row;
    });

    return jsonOk({ data: updated });
  },
);
