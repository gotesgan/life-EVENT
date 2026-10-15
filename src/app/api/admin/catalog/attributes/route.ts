import { apiHandler, jsonCreated, jsonOk, readJsonBody } from '@/lib/api/response';
import { attributeDefinitionCreateSchema } from '@/lib/validation/catalog';
import { ConflictError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Responses use explicit `select`s.
 */

const attributeSelect = {
  id: true,
  code: true,
  label: true,
  dataType: true,
  unit: true,
  helpText: true,
  placeholder: true,
  minNumber: true,
  maxNumber: true,
  maxLength: true,
  isGlobal: true,
  sortOrder: true,
  options: {
    orderBy: { sortOrder: 'asc' },
    select: { id: true, value: true, label: true, sortOrder: true, isActive: true },
  },
} as const;

/** GET /api/admin/catalog/attributes — definitions with their options. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);

  const rows = await prisma.attributeDefinition.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: attributeSelect,
  });

  return jsonOk({ data: rows });
});

/** POST /api/admin/catalog/attributes — create an attribute definition. */
export const POST = apiHandler(async (request) => {
  const actor = await getAdminActorContext(request);
  const body = await readJsonBody(request, attributeDefinitionCreateSchema);

  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.attributeDefinition.findUnique({
      where: { code: body.code },
      select: { id: true },
    });
    if (existing) throw new ConflictError('An attribute with that code already exists');

    const row = await tx.attributeDefinition.create({
      data: {
        code: body.code,
        label: body.label,
        dataType: body.dataType,
        unit: body.unit ?? null,
        helpText: body.helpText ?? null,
        placeholder: body.placeholder ?? null,
        minNumber: body.minNumber ?? null,
        maxNumber: body.maxNumber ?? null,
        maxLength: body.maxLength ?? null,
        isGlobal: body.isGlobal,
        sortOrder: body.sortOrder,
      },
      select: attributeSelect,
    });

    await recordAudit(
      {
        action: 'attribute.created',
        entityType: 'AttributeDefinition',
        entityId: row.id,
        summary: `Created attribute "${row.label}"`,
        context: toAuditContext(actor),
      },
      tx,
    );

    return row;
  });

  return jsonCreated({ data: created });
});
