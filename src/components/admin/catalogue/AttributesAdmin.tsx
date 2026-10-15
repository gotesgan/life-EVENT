'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { postJson, fieldErrorsFrom, notifyError, notifySuccess } from '../api';
import { ATTRIBUTE_DATA_TYPE_LABELS, labelFor } from '../status';
import type { AttributeAdminRow } from '@/app/admin/catalogue/_lib/data';
import classes from './Catalogue.module.css';

export interface AttributesAdminProps {
  rows: AttributeAdminRow[];
}

const DATA_TYPE_OPTIONS = Object.entries(ATTRIBUTE_DATA_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Attribute definitions and their option lists.
 *
 * An attribute definition is reusable across categories; the per-category
 * behaviour (filterable, required, …) is configured on the category's binding
 * editor, not here. Options only exist for the select-shaped data types, so the
 * add-option form is offered only there.
 *
 * Definitions cannot be edited or deleted yet — the catalogue API exposes
 * creation only — so the UI offers exactly that rather than buttons that would
 * return 405.
 */
export function AttributesAdmin({ rows }: AttributesAdminProps) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} stroke={1.5} />} onClick={open}>
          New attribute
        </Button>
      </Group>

      <Modal opened={opened} onClose={close} title="New attribute" centered radius="lg" size="lg">
        <AttributeCreateForm onDone={close} onCancel={close} />
      </Modal>

      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No attributes defined yet. Create one, then bind it to a category to make it a filter.
        </Text>
      ) : (
        <Accordion variant="separated" radius="md" chevronPosition="left">
          {rows.map((row) => (
            <AccordionItem key={row.id} value={row.id}>
              <AccordionControl>
                <Group gap="xs" wrap="wrap">
                  <Text size="sm" fw={600}>
                    {row.label}
                  </Text>
                  <Badge variant="light" size="sm">
                    {labelFor(ATTRIBUTE_DATA_TYPE_LABELS, row.dataType)}
                  </Badge>
                  <Text className={classes.code} c="dimmed">
                    {row.code}
                  </Text>
                  {row.isGlobal ? (
                    <Badge variant="light" size="sm" color="accent">
                      Global
                    </Badge>
                  ) : null}
                  <Text size="xs" c="dimmed">
                    {row.bindingCount} {row.bindingCount === 1 ? 'category' : 'categories'} ·{' '}
                    {row.options.length} {row.options.length === 1 ? 'option' : 'options'}
                  </Text>
                </Group>
              </AccordionControl>

              <AccordionPanel>
                <Stack gap="sm">
                  <dl className={classes.legend}>
                    <div>
                      <dt className={classes.legendTerm}>Help text</dt>
                      <dd className={classes.legendValue}>{row.helpText ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className={classes.legendTerm}>Unit</dt>
                      <dd className={classes.legendValue}>{row.unit ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className={classes.legendTerm}>Range</dt>
                      <dd className={classes.legendValue}>
                        {(row.minNumber ?? row.maxNumber)
                          ? `${row.minNumber ?? '—'} to ${row.maxNumber ?? '—'}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className={classes.legendTerm}>Max length</dt>
                      <dd className={classes.legendValue}>{row.maxLength ?? '—'}</dd>
                    </div>
                  </dl>

                  {row.dataType === 'SINGLE_SELECT' || row.dataType === 'MULTI_SELECT' ? (
                    <>
                      <Text size="xs" fw={600} className={classes.legendTerm}>
                        Options
                      </Text>
                      {row.options.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          No options yet. A select attribute with no options cannot be answered.
                        </Text>
                      ) : (
                        <div>
                          {row.options.map((option) => (
                            <div key={option.id} className={classes.optionRow}>
                              <Group gap="xs" wrap="wrap">
                                <Text size="sm">{option.label}</Text>
                                <Text className={classes.code} c="dimmed">
                                  {option.value}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  sort {option.sortOrder}
                                </Text>
                              </Group>
                              <Badge
                                variant="light"
                                size="sm"
                                color={option.isActive ? 'sage' : 'stone'}
                              >
                                {option.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                      <AttributeOptionForm attributeId={row.id} />
                    </>
                  ) : null}
                </Stack>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}

function AttributeCreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: '',
    label: '',
    dataType: 'TEXT',
    unit: '',
    helpText: '',
    placeholder: '',
    minNumber: '' as number | string,
    maxNumber: '' as number | string,
    maxLength: '' as number | string,
    isGlobal: false,
    sortOrder: 0 as number | string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      await postJson('/api/admin/catalog/attributes', {
        code: form.code.trim(),
        label: form.label.trim(),
        dataType: form.dataType,
        isGlobal: form.isGlobal,
        sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
        ...(form.unit.trim() ? { unit: form.unit.trim() } : {}),
        ...(form.helpText.trim() ? { helpText: form.helpText.trim() } : {}),
        ...(form.placeholder.trim() ? { placeholder: form.placeholder.trim() } : {}),
        ...(form.minNumber === '' ? {} : { minNumber: Number(form.minNumber) }),
        ...(form.maxNumber === '' ? {} : { maxNumber: Number(form.maxNumber) }),
        ...(form.maxLength === '' ? {} : { maxLength: Number(form.maxLength) }),
      });
      notifySuccess(`Attribute "${form.label.trim()}" created.`, 'Attribute saved');
      router.refresh();
      onDone();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      notifyError(error, 'Attribute not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      <div className={classes.formGrid}>
        <TextInput
          label="Label"
          required
          description="What administrators and customers read"
          value={form.label}
          onChange={(event) =>
            setForm((current) => ({ ...current, label: event.currentTarget.value }))
          }
          error={errors.label}
          size="xs"
        />
        <TextInput
          label="Code"
          required
          description="Lowercase identifier used by the search API, e.g. seating_capacity"
          value={form.code}
          onChange={(event) =>
            setForm((current) => ({ ...current, code: event.currentTarget.value }))
          }
          error={errors.code}
          size="xs"
        />
        <Select
          label="Data type"
          data={DATA_TYPE_OPTIONS}
          value={form.dataType}
          onChange={(value) => setForm((current) => ({ ...current, dataType: value ?? 'TEXT' }))}
          error={errors.dataType}
          size="xs"
        />
        <TextInput
          label="Unit"
          description="e.g. guests, hours"
          value={form.unit}
          onChange={(event) =>
            setForm((current) => ({ ...current, unit: event.currentTarget.value }))
          }
          error={errors.unit}
          size="xs"
        />
        <NumberInput
          label="Minimum value"
          value={form.minNumber}
          onChange={(value) => setForm((current) => ({ ...current, minNumber: value }))}
          error={errors.minNumber}
          size="xs"
        />
        <NumberInput
          label="Maximum value"
          value={form.maxNumber}
          onChange={(value) => setForm((current) => ({ ...current, maxNumber: value }))}
          error={errors.maxNumber}
          size="xs"
        />
        <NumberInput
          label="Max text length"
          min={1}
          max={2000}
          value={form.maxLength}
          onChange={(value) => setForm((current) => ({ ...current, maxLength: value }))}
          error={errors.maxLength}
          size="xs"
        />
        <NumberInput
          label="Sort order"
          min={0}
          max={999}
          value={form.sortOrder}
          onChange={(value) => setForm((current) => ({ ...current, sortOrder: value }))}
          error={errors.sortOrder}
          size="xs"
        />
        <div className={classes.fullWidth}>
          <Textarea
            label="Help text"
            description="Shown to administrators filling the value in."
            value={form.helpText}
            onChange={(event) =>
              setForm((current) => ({ ...current, helpText: event.currentTarget.value }))
            }
            error={errors.helpText}
            autosize
            minRows={2}
            maxLength={240}
            size="xs"
          />
        </div>
        <div className={classes.fullWidth}>
          <TextInput
            label="Placeholder"
            value={form.placeholder}
            onChange={(event) =>
              setForm((current) => ({ ...current, placeholder: event.currentTarget.value }))
            }
            error={errors.placeholder}
            size="xs"
          />
        </div>
      </div>

      <Switch
        label="Global attribute"
        description="Available to every category without an explicit binding."
        checked={form.isGlobal}
        onChange={(event) =>
          setForm((current) => ({ ...current, isGlobal: event.currentTarget.checked }))
        }
        size="xs"
      />

      <Group>
        <Button
          size="xs"
          loading={busy}
          disabled={form.label.trim().length < 2 || form.code.trim().length < 2}
          onClick={() => void submit()}
        >
          Create attribute
        </Button>
        <Button size="xs" variant="default" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}

function AttributeOptionForm({ attributeId }: { attributeId: string }) {
  const router = useRouter();
  const [option, setOption] = useState({
    value: '',
    label: '',
    sortOrder: 0 as number | string,
    isActive: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/admin/catalog/attribute-options', {
        attributeId,
        value: option.value.trim(),
        label: option.label.trim(),
        sortOrder: option.sortOrder === '' ? 0 : Number(option.sortOrder),
        isActive: option.isActive,
      });
      notifySuccess(`Option "${option.label.trim()}" added.`, 'Option saved');
      setOption({ value: '', label: '', sortOrder: 0, isActive: true });
      router.refresh();
    } catch (submitError) {
      setError(fieldErrorsFrom(submitError).value ?? null);
      notifyError(submitError, 'Option not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={classes.overrideGrid}>
      <TextInput
        label="New option label"
        value={option.label}
        onChange={(event) =>
          setOption((current) => ({ ...current, label: event.currentTarget.value }))
        }
        size="xs"
      />
      <TextInput
        label="Option value"
        description="Lowercase key stored with the listing"
        value={option.value}
        onChange={(event) =>
          setOption((current) => ({ ...current, value: event.currentTarget.value }))
        }
        error={error}
        size="xs"
      />
      <NumberInput
        label="Sort order"
        min={0}
        max={999}
        value={option.sortOrder}
        onChange={(value) => setOption((current) => ({ ...current, sortOrder: value }))}
        size="xs"
      />
      <Switch
        label="Active"
        checked={option.isActive}
        onChange={(event) =>
          setOption((current) => ({ ...current, isActive: event.currentTarget.checked }))
        }
        size="xs"
      />
      <Button
        size="xs"
        variant="default"
        loading={busy}
        disabled={option.label.trim().length === 0 || option.value.trim().length === 0}
        onClick={() => void submit()}
      >
        Add option
      </Button>
    </div>
  );
}
