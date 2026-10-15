'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { postJson, patchJson, fieldErrorsFrom, notifyError, notifySuccess } from '../api';
import type { CategoryAdminRow } from '@/app/admin/catalogue/_lib/data';
import classes from './Catalogue.module.css';

export interface CategoryFormProps {
  mode: 'create' | 'edit';
  /** Required in `edit` mode. */
  category?: CategoryAdminRow;
  parentOptions: Array<{ value: string; label: string }>;
  onDone?: () => void;
  onCancel?: () => void;
}

interface FormState {
  name: string;
  slug: string;
  parentId: string | null;
  shortDescription: string;
  description: string;
  iconKey: string;
  heroImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  isActive: boolean;
  sortOrder: number | string;
}

/**
 * Create/edit a category.
 *
 * The `slug` is optional on create — the API derives one from the name and
 * ensures uniqueness — and the materialised `path` is never editable: it is
 * rebuilt from the parent by the route, which also repairs descendants when a
 * category moves.
 *
 * Empty optional text is omitted rather than sent: the update schema turns `''`
 * into `undefined`, so sending it would neither set nor clear anything, and
 * silently pretending otherwise would be worse than leaving the field alone.
 */
export function CategoryForm({
  mode,
  category,
  parentOptions,
  onDone,
  onCancel,
}: CategoryFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    parentId: category?.parentId ?? null,
    shortDescription: category?.shortDescription ?? '',
    description: category?.description ?? '',
    iconKey: category?.iconKey ?? '',
    heroImageUrl: category?.heroImageUrl ?? '',
    metaTitle: category?.metaTitle ?? '',
    metaDescription: category?.metaDescription ?? '',
    isActive: category?.isActive ?? true,
    sortOrder: category?.sortOrder ?? 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Drops keys whose value is an empty optional text. */
  function payload(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      parentId: form.parentId,
      isActive: form.isActive,
      sortOrder: form.sortOrder === '' ? 0 : Number(form.sortOrder),
    };

    if (form.slug.trim()) body.slug = form.slug.trim();

    const optionalText: Array<[keyof FormState, string]> = [
      ['shortDescription', 'shortDescription'],
      ['description', 'description'],
      ['iconKey', 'iconKey'],
      ['heroImageUrl', 'heroImageUrl'],
      ['metaTitle', 'metaTitle'],
      ['metaDescription', 'metaDescription'],
    ];
    for (const [stateKey, bodyKey] of optionalText) {
      const value = form[stateKey];
      if (typeof value === 'string' && value.trim().length > 0) body[bodyKey] = value.trim();
    }

    return body;
  }

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      if (mode === 'create') {
        await postJson('/api/admin/catalog/categories', payload());
        notifySuccess(`Category "${form.name.trim()}" created.`, 'Category saved');
      } else if (category) {
        await patchJson(`/api/admin/catalog/categories/${category.id}`, payload());
        notifySuccess(`Category "${form.name.trim()}" updated.`, 'Category saved');
      }
      router.refresh();
      if (onDone) onDone();
    } catch (error) {
      const fieldErrors = fieldErrorsFrom(error);
      setErrors(fieldErrors);
      notifyError(error, 'Category not saved');
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
          onChange={(event) => set('name', event.currentTarget.value)}
          error={errors.name}
          size="xs"
        />

        <TextInput
          label="Slug"
          description={
            mode === 'create'
              ? 'Optional — generated from the name'
              : 'Changing it rewrites the public URL'
          }
          value={form.slug}
          onChange={(event) => set('slug', event.currentTarget.value)}
          error={errors.slug}
          size="xs"
        />

        <Select
          label="Parent category"
          placeholder="Top level"
          data={parentOptions}
          value={form.parentId}
          onChange={(value) => set('parentId', value)}
          searchable
          clearable
          error={errors.parentId}
          size="xs"
        />

        <TextInput
          label="Icon key"
          description="Named icon used in the directory"
          value={form.iconKey}
          onChange={(event) => set('iconKey', event.currentTarget.value)}
          error={errors.iconKey}
          size="xs"
        />

        <NumberInput
          label="Sort order"
          description="Lower numbers appear first"
          min={0}
          max={999}
          value={form.sortOrder}
          onChange={(value) => set('sortOrder', value)}
          error={errors.sortOrder}
          size="xs"
        />

        <TextInput
          label="Hero image URL"
          value={form.heroImageUrl}
          onChange={(event) => set('heroImageUrl', event.currentTarget.value)}
          error={errors.heroImageUrl}
          size="xs"
        />

        <div className={classes.fullWidth}>
          <Textarea
            label="Short description"
            description="One line, used on directory cards."
            value={form.shortDescription}
            onChange={(event) => set('shortDescription', event.currentTarget.value)}
            error={errors.shortDescription}
            autosize
            minRows={2}
            maxLength={240}
            size="xs"
          />
        </div>

        <div className={classes.fullWidth}>
          <Textarea
            label="Description"
            description="The full category introduction."
            value={form.description}
            onChange={(event) => set('description', event.currentTarget.value)}
            error={errors.description}
            autosize
            minRows={4}
            maxLength={4000}
            size="xs"
          />
        </div>

        <TextInput
          label="Meta title"
          value={form.metaTitle}
          onChange={(event) => set('metaTitle', event.currentTarget.value)}
          error={errors.metaTitle}
          size="xs"
        />

        <TextInput
          label="Meta description"
          value={form.metaDescription}
          onChange={(event) => set('metaDescription', event.currentTarget.value)}
          error={errors.metaDescription}
          size="xs"
        />
      </div>

      <Switch
        label="Active"
        description="Inactive categories are hidden from the public directory but keep their listings."
        checked={form.isActive}
        onChange={(event) => set('isActive', event.currentTarget.checked)}
        size="xs"
      />

      <Text size="xs" c="dimmed">
        Optional text fields cannot be cleared once set — leave them as they are to keep the current
        value.
      </Text>

      <Group>
        <Button
          size="xs"
          loading={busy}
          disabled={form.name.trim().length < 2}
          onClick={() => void submit()}
        >
          {mode === 'create' ? 'Create category' : 'Save category'}
        </Button>
        {onCancel ? (
          <Button size="xs" variant="default" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
      </Group>
    </Stack>
  );
}
