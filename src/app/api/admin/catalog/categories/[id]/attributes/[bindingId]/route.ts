import { apiHandler, jsonOk, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * DELETE /api/admin/catalog/categories/[id]/attributes/[bindingId] — unbind an
 * attribute from a category.
 *
 * Unbinding is refused while any listing in the category still has a value for
 * that attribute. Deleting the binding would otherwise silently orphan those
 * values: they would remain in the database, keep matching `ListingAttributeValue`
 * filters, and have no definition to render from.
 */
export const DELETE = apiHandler<{ id: string; bindingId: string }>(
  async (request, context: RouteContext<{ id: string; bindingId: string }>) => {
    const actor = await getAdminActorContext(request);
    const { id: categoryId, bindingId } = await context.params;
    const category = idSchema.parse(categoryId);
    const binding = idSchema.parse(bindingId);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.categoryAttribute.findFirst({
        where: { id: binding, categoryId: category },
        select: { id: true, attributeId: true, attribute: { select: { label: true } } },
      });
      if (!existing) throw new NotFoundError('Attribute binding');

      const valuesInUse = await tx.listingAttributeValue.count({
        where: {
          attributeId: existing.attributeId,
          listing: { categories: { some: { categoryId: category } } },
        },
      });
      if (valuesInUse > 0) {
        throw new ConflictError(
          `"${existing.attribute.label}" is still used by ${valuesInUse} listing(s) in this category. Clear those values before unbinding it.`,
          { valuesInUse },
        );
      }

      await tx.categoryAttribute.delete({ where: { id: binding } });

      await recordAudit(
        {
          action: 'attribute.unbound',
          entityType: 'CategoryAttribute',
          entityId: binding,
          summary: `Unbound "${existing.attribute.label}" from the category`,
          metadata: { categoryId: category, attributeId: existing.attributeId },
          context: toAuditContext(actor),
        },
        tx,
      );

      return { id: binding, unbound: true };
    });

    return jsonOk({ data: result });
  },
);
