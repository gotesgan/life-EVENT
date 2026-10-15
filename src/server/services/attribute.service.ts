import 'server-only';
import { prisma } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { AttributeValueInput } from '@/lib/validation/listing';
import type { AttributeDataTypeValue } from '@/server/domain/search-filters';
import { recordAudit } from '@/server/services/audit.service';
import { refreshListingSearchText } from '@/server/services/listing-search-text';
import type { AdminActorContext } from '@/server/services/listing.service';

/**
 * The configurable attribute system.
 *
 * Administrators define attributes globally and bind them to categories with
 * per-category behaviour. This module is what turns that configuration into
 * (a) the editor an administrator fills in and (b) the validation that keeps
 * stored values consistent with their definitions.
 */

export interface AttributeEditorField {
  attributeId: string;
  code: string;
  label: string;
  dataType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SINGLE_SELECT' | 'MULTI_SELECT';
  unit: string | null;
  helpText: string | null;
  groupLabel: string | null;
  isRequired: boolean;
  filterControl: string;
  minNumber: number | null;
  maxNumber: number | null;
  maxLength: number | null;
  options: Array<{ value: string; label: string }>;
}

/**
 * The attribute fields an administrator should see for a listing.
 *
 * Inherits bindings from ancestor categories and lets the most specific
 * category win for the same attribute, matching how filters are resolved.
 */
export async function getAttributeEditorFields(
  categoryIds: readonly string[],
): Promise<AttributeEditorField[]> {
  if (categoryIds.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: [...categoryIds] } },
    select: { id: true, path: true },
  });

  const paths = new Set<string>();
  for (const category of categories) {
    const segments = category.path.split('/').filter(Boolean);
    for (let index = 0; index < segments.length; index += 1) {
      paths.add(segments.slice(0, index + 1).join('/'));
    }
  }

  const ancestorIds = (
    await prisma.category.findMany({
      where: { path: { in: [...paths] } },
      select: { id: true, path: true },
    })
  ).sort((a, b) => a.path.length - b.path.length);

  const order = new Map(ancestorIds.map((category, index) => [category.id, index]));

  const bindings = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: ancestorIds.map((category) => category.id) } },
    include: {
      attribute: {
        include: { options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  const byCode = new Map<string, { binding: (typeof bindings)[number]; rank: number }>();

  for (const binding of bindings) {
    const rank = order.get(binding.categoryId) ?? 0;
    const existing = byCode.get(binding.attribute.code);
    if (!existing || rank >= existing.rank) {
      byCode.set(binding.attribute.code, { binding, rank });
    }
  }

  return [...byCode.values()]
    .filter(({ binding }) => binding.isVisibleOnProfile || binding.isRequired)
    .sort(
      (a, b) =>
        a.binding.sortOrder - b.binding.sortOrder ||
        a.binding.attribute.label.localeCompare(b.binding.attribute.label),
    )
    .map(({ binding }) => {
      const { attribute } = binding;
      return {
        attributeId: attribute.id,
        code: attribute.code,
        label: attribute.label,
        dataType: attribute.dataType,
        unit: attribute.unit,
        helpText: attribute.helpText,
        groupLabel: binding.groupLabel,
        isRequired: binding.isRequired,
        filterControl: binding.filterControl ?? attribute.dataType,
        minNumber: attribute.minNumber,
        maxNumber: attribute.maxNumber,
        maxLength: attribute.maxLength,
        options: attribute.options.map((option) => ({
          value: option.value,
          label: option.label,
        })),
      };
    });
}

/** The input column a given attribute type is allowed to use. */
function expectedColumnFor(dataType: AttributeDataTypeValue): string {
  switch (dataType) {
    case 'NUMBER':
      return 'valueNumber';
    case 'BOOLEAN':
      return 'valueBoolean';
    case 'DATE':
      return 'valueDate';
    case 'SINGLE_SELECT':
      return 'optionValue';
    case 'MULTI_SELECT':
      return 'optionValues';
    case 'TEXT':
    default:
      return 'valueText';
  }
}

function isBlank(value: AttributeValueInput): boolean {
  return (
    (value.valueText === null || value.valueText === undefined || value.valueText === '') &&
    (value.valueNumber === null || value.valueNumber === undefined) &&
    (value.valueBoolean === null || value.valueBoolean === undefined) &&
    (value.valueDate === null || value.valueDate === undefined) &&
    (value.optionValue === null || value.optionValue === undefined || value.optionValue === '') &&
    (value.optionValues === undefined || value.optionValues.length === 0)
  );
}

/**
 * Validates submitted attribute values against their definitions.
 *
 * The request schema can only check that the payload is well-formed; whether a
 * `valueNumber` is *allowed* depends on the attribute's declared data type, and
 * whether an option value exists depends on the option catalogue. That is this
 * function's job.
 */
export async function validateAttributeValues(
  fields: readonly AttributeEditorField[],
  values: readonly AttributeValueInput[],
): Promise<Map<string, AttributeValueInput>> {
  const fieldById = new Map(fields.map((field) => [field.attributeId, field]));
  const resolved = new Map<string, AttributeValueInput>();

  const unknown = values.filter((value) => !fieldById.has(value.attributeId));
  if (unknown.length > 0) {
    throw new ValidationError('Some attributes do not apply to this listing\u2019s categories', {
      attributeIds: unknown.map((value) => value.attributeId),
    });
  }

  for (const value of values) {
    const field = fieldById.get(value.attributeId)!;
    const issues: string[] = [];

    // Reject a value supplied in a column that does not match the attribute's
    // declared data type. Without this, `{ valueNumber: 42 }` sent for a
    // BOOLEAN attribute would be accepted and then silently written as null,
    // so the caller would believe the value was saved.
    const suppliedColumns: Array<{
      column: string;
      present: boolean;
      matches: boolean;
    }> = [
      {
        column: 'valueText',
        present: value.valueText != null && value.valueText !== '',
        matches: field.dataType === 'TEXT',
      },
      {
        column: 'valueNumber',
        present: value.valueNumber != null,
        matches: field.dataType === 'NUMBER',
      },
      {
        column: 'valueBoolean',
        present: value.valueBoolean != null,
        matches: field.dataType === 'BOOLEAN',
      },
      {
        column: 'valueDate',
        present: value.valueDate != null,
        matches: field.dataType === 'DATE',
      },
      {
        column: 'optionValue',
        present: Boolean(value.optionValue),
        matches: field.dataType === 'SINGLE_SELECT',
      },
      {
        column: 'optionValues',
        present: (value.optionValues?.length ?? 0) > 0,
        matches: field.dataType === 'MULTI_SELECT',
      },
    ];

    const mismatched = suppliedColumns.filter((column) => column.present && !column.matches);
    if (mismatched.length > 0) {
      issues.push(
        `is a ${field.dataType} attribute and must be supplied using ${expectedColumnFor(
          field.dataType,
        )}, not ${mismatched.map((column) => column.column).join(' or ')}`,
      );
    }

    switch (field.dataType) {
      case 'NUMBER': {
        if (value.valueNumber !== null && value.valueNumber !== undefined) {
          if (field.minNumber !== null && value.valueNumber < field.minNumber) {
            issues.push(`must be at least ${field.minNumber}`);
          }
          if (field.maxNumber !== null && value.valueNumber > field.maxNumber) {
            issues.push(`must be at most ${field.maxNumber}`);
          }
        }
        break;
      }

      case 'SINGLE_SELECT': {
        if (value.optionValue) {
          const allowed = new Set(field.options.map((option) => option.value));
          if (!allowed.has(value.optionValue)) issues.push('is not a valid option');
        }
        if (value.optionValues && value.optionValues.length > 1) {
          issues.push('accepts only one value');
        }
        break;
      }

      case 'MULTI_SELECT': {
        const chosen = value.optionValues ?? [];
        const allowed = new Set(field.options.map((option) => option.value));
        const invalid = chosen.filter((item) => !allowed.has(item));
        if (invalid.length > 0) issues.push(`contains unknown options: ${invalid.join(', ')}`);
        break;
      }

      case 'TEXT': {
        if (
          value.valueText &&
          field.maxLength !== null &&
          value.valueText.length > field.maxLength
        ) {
          issues.push(`must be at most ${field.maxLength} characters`);
        }
        break;
      }

      case 'DATE':
      case 'BOOLEAN':
      default:
        break;
    }

    if (issues.length > 0) {
      throw new ValidationError(`"${field.label}" ${issues.join('; ')}`, {
        attributeCode: field.code,
      });
    }

    if (!isBlank(value)) resolved.set(value.attributeId, value);
  }

  const missingRequired = fields
    .filter((field) => field.isRequired && !resolved.has(field.attributeId))
    .map((field) => ({ code: field.code, label: field.label }));

  if (missingRequired.length > 0) {
    throw new ValidationError(
      `Required information is missing: ${missingRequired.map((field) => field.label).join(', ')}`,
      { missingRequired },
    );
  }

  return resolved;
}

/**
 * Replaces a listing's attribute values.
 *
 * Runs as a delete-then-insert inside one transaction: a partial merge would
 * leave stale values behind when an administrator clears a field, which would
 * then keep matching filters the listing no longer satisfies.
 */
export async function adminSetListingAttributeValues(params: {
  listingId: string;
  values: AttributeValueInput[];
  actor: AdminActorContext;
}) {
  const { listingId, values, actor } = params;

  return prisma.$transaction(async (tx) => {
    const listing = await tx.businessListing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        name: true,
        categories: { select: { categoryId: true } },
      },
    });
    if (!listing) throw new NotFoundError('Listing');

    const categoryIds = listing.categories.map((row) => row.categoryId);
    const fields = await getAttributeEditorFields(categoryIds);
    const resolved = await validateAttributeValues(fields, values);

    await tx.listingAttributeValue.deleteMany({ where: { listingId } });

    const rows: Array<Record<string, unknown>> = [];

    for (const [attributeId, value] of resolved) {
      const field = fields.find((item) => item.attributeId === attributeId)!;

      let optionId: string | null = null;
      let optionIds: string[] = [];
      let valueText = value.valueText ?? null;

      if (field.dataType === 'SINGLE_SELECT' && value.optionValue) {
        const option = await tx.attributeOption.findFirst({
          where: { attributeId, value: value.optionValue },
          select: { id: true, label: true },
        });
        optionId = option?.id ?? null;
        // Mirror the label into valueText so text search and simple display
        // work without an extra join.
        valueText = option?.label ?? valueText;
      }

      if (field.dataType === 'MULTI_SELECT' && value.optionValues?.length) {
        const options = await tx.attributeOption.findMany({
          where: { attributeId, value: { in: value.optionValues } },
          select: { id: true, label: true },
        });
        optionIds = options.map((option) => option.id);
        valueText = options.map((option) => option.label).join(', ');
      }

      rows.push({
        listingId,
        attributeId,
        valueText,
        valueNumber: field.dataType === 'NUMBER' ? (value.valueNumber ?? null) : null,
        valueBoolean: field.dataType === 'BOOLEAN' ? (value.valueBoolean ?? null) : null,
        valueDate: field.dataType === 'DATE' && value.valueDate ? new Date(value.valueDate) : null,
        optionId,
        optionIds,
      });
    }

    if (rows.length > 0) {
      await tx.listingAttributeValue.createMany({
        data: rows as never,
      });
    }

    await refreshListingSearchText(listingId, tx);

    await recordAudit(
      {
        action: 'listing.attributes_updated',
        entityType: 'BusinessListing',
        entityId: listingId,
        summary: `Updated ${rows.length} attribute value(s)`,
        metadata: { count: rows.length, codes: [...resolved.keys()].length },
        context: {
          actorUserId: actor.userId,
          actorName: actor.name,
          ipHash: actor.ipHash ?? null,
          userAgent: actor.userAgent ?? null,
        },
      },
      tx,
    );

    return { updated: rows.length };
  });
}
