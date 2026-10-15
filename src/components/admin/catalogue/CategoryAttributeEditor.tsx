'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { patchJson, postJson, fieldErrorsFrom, notifyError, notifySuccess } from '../api';
import { FILTER_CONTROL_LABELS, ATTRIBUTE_DATA_TYPE_LABELS, labelFor } from '../status';
import type { AttributeAdminRow, CategoryBindingRow } from '@/app/admin/catalogue/_lib/data';
import classes from './Catalogue.module.css';

export interface CategoryAttributeEditorProps {
  categoryId: string;
  bindings: CategoryBindingRow[];
  attributes: AttributeAdminRow[];
  /** Codes already bound, so the add control never offers a duplicate. */
  boundAttributeIds: string[];
}

interface FlagDefinition {
  key: FlagKey;
  label: string;
  /** Shown once in the legend, in a full sentence. */
  meaning: string;
  /** Short reminder next to the switch itself. */
  short: string;
  /** Present when the API cannot persist this flag yet. */
  unsupported?: string;
}

type FlagKey =
  | 'isRequired'
  | 'isFilterable'
  | 'isSearchable'
  | 'isVisibleOnProfile'
  | 'isComparable'
  | 'showOnCard';

const FLAGS: readonly FlagDefinition[] = [
  {
    key: 'isRequired',
    label: 'Required',
    meaning:
      'A listing in this category cannot be saved without a value. Use it for the facts every provider in the category must state, such as capacity for a venue.',
    short: 'Value must be supplied',
  },
  {
    key: 'isFilterable',
    label: 'Filterable',
    meaning:
      'The attribute is published as a filter on search and category pages. This is the flag that turns an attribute definition into a visible filter, and it is applied through inheritance by subcategories.',
    short: 'Appears as a filter',
  },
  {
    key: 'isSearchable',
    label: 'Searchable',
    meaning:
      'The value is included in the text index for the category, so a customer typing a word that appears only in this attribute can still find the listing.',
    short: 'Included in search text',
  },
  {
    key: 'isVisibleOnProfile',
    label: 'Visible on profile',
    meaning:
      'The attribute is displayed on the public listing page, in the listing\u2019s detail sections. Turning it off keeps the data for internal use only.',
    short: 'Shown on the public page',
  },
  {
    key: 'isComparable',
    label: 'Comparable',
    meaning:
      'The attribute takes part in side-by-side comparison between listings in this category. Only meaningful for attributes that share a unit or a closed option list.',
    short: 'Used in comparisons',
  },
  {
    key: 'showOnCard',
    label: 'Show on card',
    meaning:
      'The attribute is printed on the listing card in search results, where space is scarce. Reserve it for the one or two facts that decide a click.',
    short: 'Shown on result cards',
  },
];

const FILTER_CONTROL_OPTIONS = Object.entries(FILTER_CONTROL_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/**
 * Attribute bindings for one category.
 *
 * This screen is what makes "new categories and filters without code changes"
 * real: binding an attribute to a category with `isFilterable` is what makes the
 * public search API return it as a filter, and the frontend renders whatever the
 * API returns. Every flag is therefore explained in place — an administrator
 * cannot be expected to infer the difference between "filterable", "searchable"
 * and "visible on profile" from three unlabelled switches.
 *
 * Updates go to `PATCH /api/admin/catalog/category-attributes/[id]`, one request
 * per binding and only for the fields that changed, so a large binding set
 * cannot be overwritten wholesale by a half-filled form.
 */
export function CategoryAttributeEditor({
  categoryId,
  bindings,
  attributes,
  boundAttributeIds,
}: CategoryAttributeEditorProps) {
  const [newAttributeId, setNewAttributeId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const router = useRouter();

  const available = attributes
    .filter((attribute) => !boundAttributeIds.includes(attribute.id))
    .map((attribute) => ({
      value: attribute.id,
      label: `${attribute.label} · ${labelFor(ATTRIBUTE_DATA_TYPE_LABELS, attribute.dataType)}`,
    }));

  async function addBinding() {
    if (!newAttributeId) return;
    setAdding(true);
    setAddError(null);
    try {
      await postJson(`/api/admin/catalog/categories/${categoryId}/attributes`, {
        attributeId: newAttributeId,
        isRequired: false,
        isFilterable: false,
        isSearchable: false,
        isVisibleOnProfile: true,
        isComparable: false,
        sortOrder: 0,
      });
      notifySuccess('Attribute bound to this category.', 'Binding added');
      setNewAttributeId(null);
      router.refresh();
    } catch (error) {
      setAddError(fieldErrorsFrom(error).attributeId ?? null);
      notifyError(error, 'Attribute not bound');
    } finally {
      setAdding(false);
    }
  }

  return (
    <Stack gap="md">
      <Alert
        variant="light"
        color="brand"
        icon={<IconInfoCircle size={16} stroke={1.5} />}
        title="What each flag does"
      >
        <dl className={classes.legend}>
          {FLAGS.map((flag) => (
            <div key={flag.key}>
              <dt className={classes.legendTerm}>{flag.label}</dt>
              <dd className={classes.legendValue}>{flag.meaning}</dd>
            </div>
          ))}
        </dl>
      </Alert>

      <div className={classes.overrideGrid}>
        <Select
          label="Bind an attribute"
          placeholder={
            available.length === 0 ? 'Every attribute is already bound' : 'Choose an attribute'
          }
          data={available}
          value={newAttributeId}
          onChange={setNewAttributeId}
          searchable
          disabled={available.length === 0}
          error={addError}
          size="xs"
        />
        <Button
          size="xs"
          leftSection={<IconPlus size={15} stroke={1.5} />}
          loading={adding}
          disabled={!newAttributeId}
          onClick={() => void addBinding()}
        >
          Add binding
        </Button>
      </div>

      {bindings.length === 0 ? (
        <Text size="sm" c="dimmed">
          No attributes are bound to this category. Bind one to give its listings structured facts
          and, if you mark it filterable, a filter on the public search page.
        </Text>
      ) : (
        <Stack gap="sm">
          {bindings.map((binding) => (
            <BindingCard key={binding.id} binding={binding} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function BindingCard({ binding }: { binding: CategoryBindingRow }) {
  const router = useRouter();
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({
    isRequired: binding.isRequired,
    isFilterable: binding.isFilterable,
    isSearchable: binding.isSearchable,
    isVisibleOnProfile: binding.isVisibleOnProfile,
    isComparable: binding.isComparable,
    showOnCard: binding.showOnCard ?? false,
  });
  const [filterControl, setFilterControl] = useState<string | null>(binding.filterControl);
  const [groupLabel, setGroupLabel] = useState(binding.groupLabel ?? '');
  const [sortOrder, setSortOrder] = useState<number | string>(binding.sortOrder);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await patchJson(`/api/admin/catalog/category-attributes/${binding.id}`, {
        isRequired: flags.isRequired,
        isFilterable: flags.isFilterable,
        isSearchable: flags.isSearchable,
        isVisibleOnProfile: flags.isVisibleOnProfile,
        isComparable: flags.isComparable,
        // `null` clears the override and lets the control be derived from the
        // attribute's data type again.
        filterControl,
        sortOrder: sortOrder === '' ? 0 : Number(sortOrder),
        ...(groupLabel.trim() ? { groupLabel: groupLabel.trim() } : {}),
      });
      notifySuccess(`Binding for "${binding.attributeLabel}" saved.`, 'Binding updated');
      router.refresh();
    } catch (error) {
      notifyError(error, 'Binding not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={classes.bindingCard}>
      <div className={classes.bindingHead}>
        <Stack gap={2}>
          <Group gap="xs" wrap="wrap">
            <Text size="sm" fw={600}>
              {binding.attributeLabel}
            </Text>
            <Badge variant="light" size="sm">
              {labelFor(ATTRIBUTE_DATA_TYPE_LABELS, binding.dataType)}
            </Badge>
            <Text className={classes.code} c="dimmed">
              {binding.attributeCode}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {binding.optionsCount} configured {binding.optionsCount === 1 ? 'option' : 'options'}
          </Text>
        </Stack>

        <Button size="xs" loading={busy} onClick={() => void save()}>
          Save binding
        </Button>
      </div>

      <div className={classes.flagGrid}>
        {FLAGS.map((flag) => {
          const disabled = Boolean(flag.unsupported);
          const control = (
            <Switch
              label={flag.label}
              description={disabled ? flag.unsupported : flag.short}
              checked={flags[flag.key]}
              disabled={disabled}
              onChange={(event) =>
                setFlags((current) => ({ ...current, [flag.key]: event.currentTarget.checked }))
              }
              size="xs"
            />
          );

          return disabled ? (
            <Tooltip key={flag.key} label={flag.unsupported ?? ''} withArrow multiline w={260}>
              <div>{control}</div>
            </Tooltip>
          ) : (
            <div key={flag.key}>{control}</div>
          );
        })}
      </div>

      <div className={classes.overrideGrid}>
        <Select
          label="Filter control override"
          description="Leave empty to derive it from the data type"
          placeholder="Derived"
          data={FILTER_CONTROL_OPTIONS}
          value={filterControl}
          onChange={setFilterControl}
          clearable
          size="xs"
        />
        <TextInput
          label="Group label"
          description="Heading the attribute sits under on the profile"
          value={groupLabel}
          onChange={(event) => setGroupLabel(event.currentTarget.value)}
          size="xs"
        />
        <NumberInput
          label="Sort order"
          min={0}
          max={999}
          value={sortOrder}
          onChange={setSortOrder}
          size="xs"
        />
      </div>
    </div>
  );
}
