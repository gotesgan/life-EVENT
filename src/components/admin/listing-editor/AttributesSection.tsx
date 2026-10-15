'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  LoadingOverlay,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react';
import { AdminApiError, notifySuccess, putJson } from '../api';
import { toAttributePayload } from './attributes';
import type { AttributeEditorFieldModel, AttributeFieldValueMap } from './types';

export interface AttributesSectionProps {
  listingId: string;
  fields: AttributeEditorFieldModel[];
  initialValues: AttributeFieldValueMap;
  onSaved?: () => void;
}

interface FieldError {
  attributeCode: string;
  message: string;
}

/**
 * Category-driven attribute editor.
 *
 * The controls come entirely from `getAttributeEditorFields(categoryIds)` — the
 * attribute system is what makes "new categories and filters without code
 * changes" real, so this screen must never hard-code a field. Values are saved on
 * their own endpoint (`PUT .../attributes`) because the service replaces the
 * whole value set, and because a missing required attribute is an error about
 * this section, not about the listing basics.
 */
export function AttributesSection({
  listingId,
  fields,
  initialValues,
  onSaved,
}: AttributesSectionProps) {
  const [values, setValues] = useState<AttributeFieldValueMap>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, AttributeEditorFieldModel[]>();
    for (const field of fields) {
      const key = field.groupLabel?.trim() || 'Listing details';
      const list = map.get(key) ?? [];
      list.push(field);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [fields]);

  function update(attributeId: string, next: AttributeFieldValueMap[string]) {
    setValues((current) => ({ ...current, [attributeId]: next }));
    setFieldError((current) => (current?.attributeCode === attributeId ? null : current));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setFieldError(null);
    try {
      await putJson(`/api/admin/listings/${listingId}/attributes`, {
        values: toAttributePayload(fields, values),
      });
      notifySuccess('Attribute values saved.', 'Listing attributes');
      onSaved?.();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'The attribute values could not be saved.';
      setError(message);

      // The service reports which attribute was rejected, so the failure can be
      // attached to the field that caused it rather than only shown at the top.
      if (caught instanceof AdminApiError) {
        const details = caught.details as { attributeCode?: string } | undefined;
        if (details?.attributeCode) {
          setFieldError({ attributeCode: details.attributeCode, message });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  if (fields.length === 0) {
    return (
      <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} stroke={1.5} />}>
        <Text size="sm">
          This listing&rsquo;s categories have no attributes bound to them. Bind attributes to the
          category under <strong>Catalogue → Categories</strong> and they will appear here.
        </Text>
      </Alert>
    );
  }

  return (
    <Stack gap="lg" style={{ position: 'relative' }}>
      <LoadingOverlay visible={saving} zIndex={5} overlayProps={{ blur: 1 }} />

      <Alert variant="light" color="accent" icon={<IconInfoCircle size={18} stroke={1.5} />}>
        <Text size="sm">
          These fields come from the categories this listing belongs to. Marking one required here
          reflects the category binding — change that in the catalogue, not per listing.
        </Text>
      </Alert>

      {error ? (
        <Alert variant="light" color="red" title="Attributes were not saved" role="alert">
          {error}
        </Alert>
      ) : null}

      {groups.map(([groupLabel, groupFields]) => (
        <section key={groupLabel}>
          <Title order={4} mb="sm">
            {groupLabel}
          </Title>
          <Stack gap="md">
            {groupFields.map((field) => {
              const state = values[field.attributeId];
              const isErrored = fieldError?.attributeCode === field.code;
              const description = [field.helpText, field.unit ? `Measured in ${field.unit}` : null]
                .filter(Boolean)
                .join(' · ');

              const label = (
                <Group gap={6} component="span">
                  <span>{field.label}</span>
                  {field.isRequired ? (
                    <Badge size="xs" radius="sm" variant="light" color="brand">
                      Required
                    </Badge>
                  ) : null}
                </Group>
              );

              const common = {
                label,
                description: description || undefined,
                error: isErrored ? fieldError?.message : undefined,
                withAsterisk: field.isRequired,
              } as const;

              switch (field.dataType) {
                case 'NUMBER': {
                  const numberState =
                    state?.kind === 'NUMBER'
                      ? state
                      : { kind: 'NUMBER' as const, value: '' as const };
                  return (
                    <NumberInput
                      key={field.attributeId}
                      {...common}
                      min={field.minNumber ?? undefined}
                      max={field.maxNumber ?? undefined}
                      rightSection={
                        field.unit ? (
                          <Text size="xs" c="dimmed">
                            {field.unit}
                          </Text>
                        ) : undefined
                      }
                      rightSectionWidth={field.unit ? 70 : undefined}
                      value={numberState.value}
                      onChange={(value) =>
                        update(field.attributeId, {
                          kind: 'NUMBER',
                          value: value === '' ? '' : Number(value),
                        })
                      }
                    />
                  );
                }

                case 'BOOLEAN': {
                  const boolState =
                    state?.kind === 'BOOLEAN' ? state : { kind: 'BOOLEAN' as const, value: false };
                  return (
                    <Switch
                      key={field.attributeId}
                      label={label}
                      description={description || undefined}
                      checked={boolState.value}
                      onChange={(event) =>
                        update(field.attributeId, {
                          kind: 'BOOLEAN',
                          value: event.currentTarget.checked,
                        })
                      }
                    />
                  );
                }

                case 'DATE': {
                  const dateState =
                    state?.kind === 'DATE' ? state : { kind: 'DATE' as const, value: null };
                  return (
                    <DatePickerInput
                      key={field.attributeId}
                      {...common}
                      placeholder="Pick a date"
                      valueFormat="MMM D, YYYY"
                      clearable
                      value={dateState.value}
                      onChange={(value) =>
                        update(field.attributeId, { kind: 'DATE', value: value ?? null })
                      }
                    />
                  );
                }

                case 'SINGLE_SELECT': {
                  const selectState =
                    state?.kind === 'SINGLE_SELECT'
                      ? state
                      : { kind: 'SINGLE_SELECT' as const, value: null };
                  return (
                    <Select
                      key={field.attributeId}
                      {...common}
                      data={field.options}
                      searchable
                      clearable
                      value={selectState.value}
                      onChange={(value) =>
                        update(field.attributeId, { kind: 'SINGLE_SELECT', value: value ?? null })
                      }
                    />
                  );
                }

                case 'MULTI_SELECT': {
                  const multiState =
                    state?.kind === 'MULTI_SELECT'
                      ? state
                      : { kind: 'MULTI_SELECT' as const, value: [] };
                  return (
                    <MultiSelect
                      key={field.attributeId}
                      {...common}
                      data={field.options}
                      searchable
                      clearable
                      value={multiState.value}
                      onChange={(value) =>
                        update(field.attributeId, { kind: 'MULTI_SELECT', value })
                      }
                    />
                  );
                }

                case 'TEXT':
                default: {
                  const textState =
                    state?.kind === 'TEXT' ? state : { kind: 'TEXT' as const, value: '' };
                  return (
                    <TextInput
                      key={field.attributeId}
                      {...common}
                      maxLength={field.maxLength ?? undefined}
                      value={textState.value}
                      onChange={(event) =>
                        update(field.attributeId, {
                          kind: 'TEXT',
                          value: event.currentTarget.value,
                        })
                      }
                    />
                  );
                }
              }
            })}
          </Stack>
        </section>
      ))}

      <Group justify="flex-end">
        <Button
          leftSection={<IconDeviceFloppy size={16} stroke={1.5} />}
          loading={saving}
          onClick={() => void save()}
        >
          Save attributes
        </Button>
      </Group>
    </Stack>
  );
}
