import type { AttributeEditorFieldModel, AttributeFieldValueMap } from './types';

/**
 * Editor state → `PUT /api/admin/listings/[id]/attributes` payload.
 *
 * Blank fields are still sent: the attribute service decides what is empty and
 * deletes everything before re-inserting, so sending an empty value is how a
 * value gets cleared. That is the opposite of the listing update, where an empty
 * optional text cannot be cleared through the API at all.
 */

export interface AttributeValueInput {
  attributeId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueDate?: string | null;
  optionValue?: string | null;
  optionValues?: string[];
}

export function toAttributePayload(
  fields: readonly AttributeEditorFieldModel[],
  values: AttributeFieldValueMap,
): AttributeValueInput[] {
  return fields.map((field) => {
    const state = values[field.attributeId];
    const base: AttributeValueInput = { attributeId: field.attributeId };
    if (!state) return base;

    switch (state.kind) {
      case 'NUMBER': {
        const parsed = state.value === '' || state.value === null ? null : Number(state.value);
        return {
          ...base,
          valueNumber: parsed !== null && Number.isFinite(parsed) ? parsed : null,
        };
      }
      case 'BOOLEAN':
        return { ...base, valueBoolean: state.value };
      case 'DATE':
        return { ...base, valueDate: state.value };
      case 'SINGLE_SELECT':
        return { ...base, optionValue: state.value };
      case 'MULTI_SELECT':
        return { ...base, optionValues: state.value };
      case 'TEXT':
      default:
        return { ...base, valueText: state.value.trim() === '' ? null : state.value.trim() };
    }
  });
}
