import { apiHandler, jsonOk, readJsonBody, type RouteContext } from '@/lib/api/response';
import { idSchema } from '@/lib/validation/common';
import { attributeDefinitionUpdateSchema } from '@/lib/validation/catalog';
import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * PATCH /api/admin/catalog/attributes/[id] — update an attribute definition.
 *
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Changing `dataType` affects how existing values are interpreted, so
 * the audit entry records the previous type alongside the new one.
 */
export const PATCH = apiHandler<{ id: string }>(
  async (request, context: RouteContext<{ id: string }>) => {
    const actor = await getAdminActorContext(request);
    const id = idSchema.parse((await context.params).id);
    const body = await readJsonBody(request, attributeDefinitionUpdateSchema);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.attributeDefinition.findUnique({
        where: { id },
        select: { id: true, label: true },
      });
      if (!existing) throw new NotFoundError('Attribute');

      const row = await tx.attributeDefinition.update({
        where: { id },
        data: {
          ...(body.code !== undefined ? { code: body.code } : {}),
          ...(body.label !== undefined ? { label: body.label } : {}),
          ...(body.dataType !== undefined ? { dataType: body.dataType } : {}),
          ...(body.unit !== undefined ? { unit: body.unit ?? null } : {}),
          ...(body.helpText !== undefined ? { helpText: body.helpText ?? null } : {}),
          ...(body.placeholder !== undefined ? { placeholder: body.placeholder ?? null } : {}),
          ...(body.minNumber !== undefined ? { minNumber: body.minNumber ?? null } : {}),
          ...(body.maxNumber !== undefined ? { maxNumber: body.maxNumber ?? null } : {}),
          ...(body.maxLength !== undefined ? { maxLength: body.maxLength ?? null } : {}),
          ...(body.isGlobal !== undefined ? { isGlobal: body.isGlobal } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        select: {
          id: true,
          code: true,
          label: true,
          dataType: true,
          unit: true,
          helpText: true,
          minNumber: true,
          maxNumber: true,
          isGlobal: true,
          sortOrder: true,
        },
      });

      await recordAudit(
        {
          action: 'attribute.updated',
          entityType: 'AttributeDefinition',
          entityId: id,
          summary: `Updated attribute "${existing.label}"`,
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
