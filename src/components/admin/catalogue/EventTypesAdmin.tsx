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
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';
import { DataTable, StatusBadge } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { postJson, fieldErrorsFrom, notifyError, notifySuccess } from '../api';
import type { EventTypeAdminRow } from '@/app/admin/catalogue/_lib/data';
import classes from './Catalogue.module.css';

export interface EventTypesAdminProps {
  rows: EventTypeAdminRow[];
}

/**
 * Event types.
 *
 * Creation only: the catalogue API has no update route for event types yet, so
 * the table is read-only apart from the create dialog. Showing a disabled edit
 * button would hint at behaviour that does not exist.
 */
export function EventTypesAdmin({ rows }: EventTypesAdminProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const columns: ReadonlyArray<DataTableColumn<EventTypeAdminRow>> = [
    {
      key: 'name',
      header: 'Event type',
      width: 220,
      render: (row) => (
        <Stack gap={2}>
          <Text size="sm" fw={550}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed" className={classes.code}>
            /{row.slug}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <Text size="sm" c={row.description ? undefined : 'dimmed'}>
          {row.description ?? '—'}
        </Text>
      ),
    },
    {
      key: 'icon',
      header: 'Icon key',
      width: 140,
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
          New event type
        </Button>
      </Group>

      <Modal opened={opened} onClose={close} title="New event type" centered radius="lg">
        <EventTypeCreateForm onDone={close} onCancel={close} />
      </Modal>

      <DataTable
        caption="Event types"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        minWidth={860}
        emptyState={
          <Text size="sm" c="dimmed">
            No event types yet.
          </Text>
        }
      />
    </Stack>
  );
}

function EventTypeCreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
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
      await postJson('/api/admin/catalog/event-types', {
        name: form.name.trim(),
        isActive: form.isActive,
        sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.iconKey.trim() ? { iconKey: form.iconKey.trim() } : {}),
      });
      notifySuccess(`Event type "${form.name.trim()}" created.`, 'Event type saved');
      router.refresh();
      onDone();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      notifyError(error, 'Event type not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        required
        value={form.name}
        onChange={(event) =>
          setForm((current) => ({ ...current, name: event.currentTarget.value }))
        }
        error={errors.name}
        size="xs"
      />
      <TextInput
        label="Slug"
        description="Optional — generated from the name"
        value={form.slug}
        onChange={(event) =>
          setForm((current) => ({ ...current, slug: event.currentTarget.value }))
        }
        error={errors.slug}
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
      <Textarea
        label="Description"
        value={form.description}
        onChange={(event) =>
          setForm((current) => ({ ...current, description: event.currentTarget.value }))
        }
        error={errors.description}
        autosize
        minRows={3}
        maxLength={400}
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
          disabled={form.name.trim().length < 2}
          onClick={() => void submit()}
        >
          Create event type
        </Button>
        <Button size="xs" variant="default" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
