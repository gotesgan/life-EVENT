import type { AttributeDataType } from '@/generated/prisma/enums';
import { formatCurrency, formatDate } from '@/lib/format';

export type AttributeDataTypeValue = (typeof AttributeDataType)[keyof typeof AttributeDataType];

export interface AttributeDisplaySource {
  dataType: AttributeDataTypeValue;
  unit: string | null;
  /**
   * `id` is required to render multi-select values: `ListingAttributeValue.optionIds`
   * holds option **ids** (that is what the relation and the GIN index use), so a map
   * keyed only by `value` can never resolve them.
   */
  options: Array<{ id?: string; value: string; label: string }>;
}

export interface AttributeValueSource {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueDate: Date | null;
  option: { value: string; label: string } | null;
  optionIds: string[];
}

/**
 * Turns a typed attribute value into the string a person reads.
 *
 * Centralised so the same attribute renders identically on a search card, a
 * listing profile and an admin table — the three places a value can appear.
 * Returns `null` when the listing has no value for the attribute, so callers
 * omit the row instead of printing a blank label.
 */
export function formatAttributeValue(
  attribute: AttributeDisplaySource,
  value: AttributeValueSource | null | undefined,
): string | null {
  if (!value) return null;

  const labelById = new Map(
    attribute.options
      .filter((option): option is { id: string; value: string; label: string } =>
        Boolean(option.id),
      )
      .map((option) => [option.id, option.label]),
  );

  switch (attribute.dataType) {
    case 'NUMBER': {
      if (value.valueNumber === null) return null;
      const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(
        value.valueNumber,
      );
      return attribute.unit ? `${formatted} ${attribute.unit}` : formatted;
    }

    case 'BOOLEAN': {
      if (value.valueBoolean === null) return null;
      return value.valueBoolean ? 'Yes' : 'No';
    }

    case 'DATE':
      return value.valueDate ? formatDate(value.valueDate) : null;

    case 'SINGLE_SELECT':
      if (value.option) return value.option.label;
      return value.valueText ?? null;

    case 'MULTI_SELECT': {
      if (value.optionIds.length === 0) return value.valueText ?? null;

      const labels = value.optionIds.map((id) => labelById.get(id));
      if (labels.every((label): label is string => Boolean(label))) return labels.join(', ');

      // If an id cannot be resolved (an option was deleted, or the caller did not
      // select option ids), fall back to the stored display text. Never fall back
      // to the raw id: that leaks an internal identifier to anonymous visitors and
      // is unreadable besides.
      return value.valueText ?? null;
    }

    case 'TEXT':
    default:
      return value.valueText ?? null;
  }
}

/** Compact form used on search cards, where space is tight. */
export function formatAttributeValueCompact(
  attribute: AttributeDisplaySource,
  value: AttributeValueSource | null | undefined,
  maxItems = 2,
): string | null {
  const full = formatAttributeValue(attribute, value);
  if (!full) return null;

  if (attribute.dataType === 'NUMBER' && attribute.unit === 'INR') {
    return full.replace(/^₹/, '₹');
  }

  if (attribute.dataType !== 'MULTI_SELECT') return full;

  const parts = full.split(', ');
  if (parts.length <= maxItems) return full;
  return `${parts.slice(0, maxItems).join(', ')} +${parts.length - maxItems}`;
}

/** Compact money label for a numeric attribute whose unit is INR. */
export function formatMoneyCompact(amount: number): string {
  return formatCurrency(amount);
}
