'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { DataTable, StatusBadge } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { postJson, fieldErrorsFrom, notifyError, notifySuccess } from '../api';
import type { AmenityAdminRow } from '@/app/admin/catalogue/_lib/data';
import classes from './Catalogue.module.css';

export interface AmenitiesAdminProps {
  rows: AmenityAdminRow[];
}

/**
 * Amenities.
 *
 * Creation only, for the same reason as event types: the catalogue API exposes
 * `POST /api/admin/catalog/amenities` and nothing else.
 */
export function AmenitiesAdmin({ rows }: AmenitiesAdminProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const columns: ReadonlyArray<DataTableColumn<AmenityAdminRow>> = [
    {
      key: 'label',
      header: 'Amenity',
      width: 240,
      render: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={550}>
            {row.label}
          </Text>
          <Text size="xs" c="dimmed" className={classes.code}>
            {row.code}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'group',
      header: 'Group',
      width: 180,
      render: (row) => (
        <Text size="sm" c={row.groupLabel ? undefined : 'dimmed'}>
          {row.groupLabel ?? 'Ungrouped'}
        </Text>
      ),
    },
    {
      key: 'icon',
      header: 'Icon key',
      width: 150,
      render: (row) => (
        <Text size="sm" c={row.iconKey ? undefined : 'dimmed'}>
          {row.iconKey ?? '—'}
        </Text>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      width: 110,
      render: (row) => (
        <StatusBadge tone={row.isActive ? 'success' : 'neutral'} size="sm">
          {row.isActive ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      key: 'sort',
      header: 'Sort',
      width: 90,
      align: 'end',
      render: (row) => (
        <Badge variant="light" size="sm" color="stone">
          {row.sortOrder}
        </Badge>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} stroke={1.5} />} onClick={open}>
          New amenity
        </Button>
      </Group>

      <Modal opened={opened} onClose={close} title="New amenity" centered radius="lg">
        <AmenityCreateForm onDone={close} onCancel={close} />
      </Modal>

      <DataTable
        caption="Amenities"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        minWidth={880}
        emptyState={
          <Text size="sm" c="dimmed">
            No amenities yet.
          </Text>
        }
      />
    </Stack>
  );
}

function AmenityCreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: '',
    label: '',
    groupLabel: '',
    iconKey: '',
    isActive: true,
    sortOrder: 0 as number | string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      await postJson('/api/admin/catalog/amenities', {
        code: form.code.trim(),
        label: form.label.trim(),
        isActive: form.isActive,
        sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
        ...(form.groupLabel.trim() ? { groupLabel: form.groupLabel.trim() } : {}),
        ...(form.iconKey.trim() ? { iconKey: form.iconKey.trim() } : {}),
      });
      notifySuccess(`Amenity "${form.label.trim()}" created.`, 'Amenity saved');
      router.refresh();
      onDone();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      notifyError(error, 'Amenity not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Label"
        required
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
        description="Lowercase key, e.g. valet_parking"
        value={form.code}
        onChange={(event) =>
          setForm((current) => ({ ...current, code: event.currentTarget.value }))
        }
        error={errors.code}
        size="xs"
      />
      <TextInput
        label="Group label"
        description="Heading the amenity is listed under"
        value={form.groupLabel}
        onChange={(event) =>
          setForm((current) => ({ ...current, groupLabel: event.currentTarget.value }))
        }
        error={errors.groupLabel}
        size="xs"
      />
      <TextInput
        label="Icon key"
        value={form.iconKey}
        onChange={(event) =>
          setForm((current) => ({ ...current, iconKey: event.currentTarget.value }))
        }
        error={errors.iconKey}
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
      <Switch
        label="Active"
        checked={form.isActive}
        onChange={(event) =>
          setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))
        }
        size="xs"
      />
      <Group>
        <Button
          size="xs"
          loading={busy}
          disabled={form.label.trim().length < 2 || form.code.trim().length < 1}
          onClick={() => void submit()}
        >
          Create amenity
        </Button>
        <Button size="xs" variant="default" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
