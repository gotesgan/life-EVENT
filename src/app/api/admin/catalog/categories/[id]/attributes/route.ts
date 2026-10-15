import { apiHandler, jsonCreated, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { categoryAttributeBindSchema } from '@/lib/validation/catalog';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * POST /api/admin/catalog/categories/[id]/attributes — bind an attribute to a
 * category.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. The response is an explicit projection.
 */
export const POST = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const categoryId = idSchema.parse((await context.params).id);
    const input = await readJsonBody(request, categoryAttributeBindSchema);

    const binding = await prisma.$transaction(async (tx) => {
      const [category, attribute] = await Promise.all([
        tx.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true } }),
        tx.attributeDefinition.findUnique({
          where: { id: input.attributeId },
          select: { id: true, code: true, label: true },
        }),
      ]);
      if (!category) throw new NotFoundError('Category');
      if (!attribute) throw new NotFoundError('Attribute');

      const existing = await tx.categoryAttribute.findUnique({
        where: { categoryId_attributeId: { categoryId, attributeId: attribute.id } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError('That attribute is already bound to this category', {
          categoryAttributeId: existing.id,
        });
      }

      const row = await tx.categoryAttribute.create({
        data: { categoryId, ...input },
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
          entityId: row.id,
          summary: `Bound attribute "${attribute.label}" to category "${category.name}"`,
          metadata: { categoryId, attributeCode: attribute.code },
          context: toAuditContext(actor),
        },
        tx,
      );

      return row;
    });

    return jsonCreated({ data: binding });
  },
);
