import {
  apiHandler,
  jsonCreated,
  jsonOk,
  parseInput,
  readJsonBody,
  searchParamsToObject,
} from '@/lib/api/response';
import { attributeOptionCreateSchema } from '@/lib/validation/catalog';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/server/services/audit.service';
import { attributeOptionListQuerySchema } from '@/app/api/admin/_lib/schemas';
import { getAdminActorContext, toAuditContext } from '@/app/api/admin/_lib/context';

/**
 * DELIBERATE EXCEPTION: direct Prisma access — the catalogue has no write
 * service. Responses use explicit `select`s.
 */

const optionSelect = {
  id: true,
  attributeId: true,
  value: true,
  label: true,
  sortOrder: true,
  isActive: true,
} as const;

/** GET /api/admin/catalog/attribute-options — optionally scoped to an attribute. */
export const GET = apiHandler(async (request) => {
  await getAdminActorContext(request);
  const { attributeId } = parseInput(attributeOptionListQuerySchema, searchParamsToObject(request));

  const rows = await prisma.attributeOption.findMany({
    where: attributeId ? { attributeId } : {},
    orderBy: [{ attributeId: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    select: optionSelect,
  });

  return jsonOk({ data: rows });
});

/** POST /api/admin/catalog/attribute-options — add an option to an attribute. */
export const POST = apiHandler(async (request) => {
  const actor = await getAdminActorContext(request);
  const body = await readJsonBody(request, attributeOptionCreateSchema);

  const created = await prisma.$transaction(async (tx) => {
    const attribute = await tx.attributeDefinition.findUnique({
      where: { id: body.attributeId },
      select: { id: true, label: true },
    });
    if (!attribute) throw new NotFoundError('Attribute');

    const existing = await tx.attributeOption.findUnique({
      where: { attributeId_value: { attributeId: body.attributeId, value: body.value } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('That option value already exists for this attribute');
    }

    const row = await tx.attributeOption.create({
      data: {
        attributeId: body.attributeId,
        value: body.value,
        label: body.label,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
      select: optionSelect,
    });

    await recordAudit(
      {
        action: 'attribute_option.created',
        entityType: 'AttributeOption',
        entityId: row.id,
        summary: `Added option "${row.label}" to "${attribute.label}"`,
        context: toAuditContext(actor),
      },
      tx,
    );

    return row;
  });

  return jsonCreated({ data: created });
});
