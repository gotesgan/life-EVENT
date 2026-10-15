import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { attributeOptionUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/attribute-options/[id] — update or deactivate an option.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Deactivating hides the option from new listings while leaving
 * existing values intact.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, attributeOptionUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.attributeOption.findUnique({
        where: { id },
        select: { id: true, label: true },
      });
      if (!existing) throw new NotFoundError('Attribute option');

      const row = await tx.attributeOption.update({
        where: { id },
        data: {
          ...(body.value !== undefined ? { value: body.value } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
        select: {
          id: true,
          attributeId: true,
          value: true,
          label: true,
          sortOrder: true,
          isActive: true,
        },
      });

      await recordAudit(
        {
          action: 'attribute_option.updated',
          entityType: 'AttributeOption',
          entityId: id,
          summary: `Updated attribute option "${existing.label}"`,
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
