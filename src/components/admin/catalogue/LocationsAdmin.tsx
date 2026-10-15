'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
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
import { StatusBadge } from '@/components/ui';
import { postJson, fieldErrorsFrom, notifyError, notifySuccess } from '../api';
import { LOCATION_TYPE_LABELS, labelFor } from '../status';
import type { LocationAdminRow } from '@/app/admin/catalogue/_lib/data';
import classes from './Catalogue.module.css';

export interface LocationsAdminProps {
  rows: LocationAdminRow[];
}

const TYPE_OPTIONS = Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function orderFor(type: string): number {
  return ['COUNTRY', 'STATE', 'CITY', 'LOCALITY'].indexOf(type);
}

interface TreeNode {
  row: LocationAdminRow;
  children: TreeNode[];
}

/**
 * Location hierarchy.
 *
 * The tree is assembled from the flat rows by `parentId` rather than trusting
 * the order they arrive in, and each node prints its materialised `path`
 * read-only — that column is derived by the API and editing it by hand would
 * corrupt every descendant's prefix.
 *
 * Nodes can be created here. Changing an existing node's type or parent, or
 * deleting one, has no API route yet, so no control pretends to do it.
 */
export function LocationsAdmin({ rows }: LocationsAdminProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const tree = useMemo(() => {
    const byId = new Map<string, TreeNode>();
    for (const row of rows) byId.set(row.id, { row, children: [] });

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      const parent = node.row.parentId ? byId.get(node.row.parentId) : undefined;
      if (parent && orderFor(parent.row.type) < orderFor(node.row.type)) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort(
        (a, b) => a.row.sortOrder - b.row.sortOrder || a.row.name.localeCompare(b.row.name),
      );
      for (const node of nodes) sortNodes(node.children);
    };
    sortNodes(roots);
    return roots;
  }, [rows]);

  const parentOptions = rows.map((row) => ({
    value: row.id,
    label: `${'— '.repeat(row.path.split('/').filter(Boolean).length - 1)}${row.name} · ${labelFor(LOCATION_TYPE_LABELS, row.type)}`,
  }));

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} stroke={1.5} />} onClick={open}>
          New location
        </Button>
      </Group>

      <Modal opened={opened} onClose={close} title="New location" centered radius="lg" size="lg">
        <LocationCreateForm parentOptions={parentOptions} onDone={close} onCancel={close} />
      </Modal>

      {tree.length === 0 ? (
        <Text size="sm" c="dimmed">
          No locations yet. Start with a country, then add its states and cities.
        </Text>
      ) : (
        <LocationList nodes={tree} />
      )}
    </Stack>
  );
}

function LocationList({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className={classes.treeList}>
      {nodes.map((node) => (
        <li key={node.row.id}>
          <div className={classes.treeRow}>
            <div className={classes.treeMain}>
              <div className={classes.treeTitle}>
                <Text size="sm" fw={600}>
                  {node.row.name}
                </Text>
                <StatusBadge tone="neutral" size="sm">
                  {labelFor(LOCATION_TYPE_LABELS, node.row.type)}
                </StatusBadge>
                <StatusBadge tone={node.row.isActive ? 'success' : 'neutral'} size="sm">
                  {node.row.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
              </div>
              <div className={classes.treeMeta}>
                <span>/{node.row.slug}</span>
                <span>
                  {node.row.latitude !== null && node.row.longitude !== null
                    ? `${node.row.latitude.toFixed(4)}, ${node.row.longitude.toFixed(4)}`
                    : 'No coordinates'}
                </span>
                <span>sort {node.row.sortOrder}</span>
                {node.row.parentName ? <span>parent: {node.row.parentName}</span> : null}
              </div>
              <span className={classes.path}>{node.row.path}</span>
            </div>
          </div>

          {node.children.length > 0 ? (
            <div className={classes.treeListNested}>
              <LocationList nodes={node.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function LocationCreateForm({
  parentOptions,
  onDone,
  onCancel,
}: {
  parentOptions: Array<{ value: string; label: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    slug: '',
    type: 'CITY',
    parentId: null as string | null,
    latitude: '' as number | string,
    longitude: '' as number | string,
    heroImageUrl: '',
    description: '',
    isActive: true,
    sortOrder: 0 as number | string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      await postJson('/api/admin/catalog/locations', {
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId,
        isActive: form.isActive,
        sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        ...(form.latitude === '' ? {} : { latitude: Number(form.latitude) }),
        ...(form.longitude === '' ? {} : { longitude: Number(form.longitude) }),
        ...(form.heroImageUrl.trim() ? { heroImageUrl: form.heroImageUrl.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      });
      notifySuccess(`Location "${form.name.trim()}" created.`, 'Location saved');
      router.refresh();
      onDone();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      notifyError(error, 'Location not saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      <div className={classes.formGrid}>
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
        <Select
          label="Type"
          data={TYPE_OPTIONS}
          value={form.type}
          onChange={(value) => setForm((current) => ({ ...current, type: value ?? 'CITY' }))}
          error={errors.type}
          size="xs"
        />
        <Select
          label="Parent"
          placeholder="Top level"
          data={parentOptions}
          value={form.parentId}
          onChange={(value) => setForm((current) => ({ ...current, parentId: value }))}
          searchable
          clearable
          error={errors.parentId}
          size="xs"
        />
        <NumberInput
          label="Latitude"
          description="−90 to 90"
          min={-90}
          max={90}
          decimalScale={6}
          value={form.latitude}
          onChange={(value) => setForm((current) => ({ ...current, latitude: value }))}
          error={errors.latitude}
          size="xs"
        />
        <NumberInput
          label="Longitude"
          description="−180 to 180"
          min={-180}
          max={180}
          decimalScale={6}
          value={form.longitude}
          onChange={(value) => setForm((current) => ({ ...current, longitude: value }))}
          error={errors.longitude}
          size="xs"
        />
        <TextInput
          label="Hero image URL"
          value={form.heroImageUrl}
          onChange={(event) =>
            setForm((current) => ({ ...current, heroImageUrl: event.currentTarget.value }))
          }
          error={errors.heroImageUrl}
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
            label="Description"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.currentTarget.value }))
            }
            error={errors.description}
            autosize
            minRows={3}
            maxLength={2000}
            size="xs"
          />
        </div>
      </div>

      <Switch
        label="Active"
        description="Inactive locations are hidden from the public directory."
        checked={form.isActive}
        onChange={(event) =>
          setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))
        }
        size="xs"
      />

      <Text size="xs" c="dimmed">
        The materialised path is generated from the parent chain and cannot be edited.
      </Text>

      <Group>
        <Button
          size="xs"
          loading={busy}
          disabled={form.name.trim().length < 2}
          onClick={() => void submit()}
        >
          Create location
        </Button>
        <Button size="xs" variant="default" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
