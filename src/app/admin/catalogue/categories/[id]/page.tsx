import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Stack } from '@mantine/core';
import { PageHeader, SectionHeading, Surface, TableSkeleton } from '@/components/ui';
import { getCategoryAdminRow, listAttributeRows, listCategoryBindings } from '../../_lib/data';
import { categorySelectOptions } from '../../../_lib/options';
import { describeError } from '../../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { CategoryForm } from '@/components/admin/catalogue/CategoryForm';
import { CategoryAttributeEditor } from '@/components/admin/catalogue/CategoryAttributeEditor';

export const metadata = { title: 'Edit category' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Stack gap="lg">
      <Suspense fallback={<TableSkeleton rows={6} columns={2} />}>
        <EditCategoryContent id={id} />
      </Suspense>
    </Stack>
  );
}

async function EditCategoryContent({ id }: { id: string }) {
  // Request-time by definition: identified by a route parameter and read behind
  // the admin gate.
  await connection();

  let category: Awaited<ReturnType<typeof getCategoryAdminRow>>;
  let bindings: Awaited<ReturnType<typeof listCategoryBindings>>;
  let attributes: Awaited<ReturnType<typeof listAttributeRows>>;
  let parentOptions: Awaited<ReturnType<typeof categorySelectOptions>>;

  try {
    [category, bindings, attributes, parentOptions] = await Promise.all([
      getCategoryAdminRow(id),
      listCategoryBindings(id),
      listAttributeRows(),
      categorySelectOptions(true),
    ]);
  } catch (error) {
    return <RetryState title="Could not load this category" detail={describeError(error)} />;
  }

  if (!category) notFound();

  // A category cannot be its own parent; the API refuses it too.
  const selectableParents = parentOptions.filter((option) => option.value !== category.id);

  return (
    <>
      <PageHeader
        eyebrow="Catalogue · Categories"
        title={category.name}
        description={`The public URL is built from the materialised path: /${category.slug}. Moving the category rewrites that path and repairs its descendants.`}
        breadcrumbs={[
          { label: 'Catalogue', href: '/admin/catalogue/categories' },
          { label: 'Categories', href: '/admin/catalogue/categories' },
          { label: category.name },
        ]}
      />

      <Surface padding="md" tone="raised" as="section">
        <SectionHeading
          title="Category details"
          level={2}
          description="Name, placement, descriptions and the flags that control whether customers can see it."
        />
        <Stack gap="xs" mt="md">
          <Surface padding="sm" tone="muted">
            <SectionHeading title="Materialised path" level={3} />
            <p
              style={{
                marginTop: 'var(--mantine-spacing-xs)',
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 'var(--mantine-font-size-sm)',
                overflowWrap: 'anywhere',
              }}
            >
              {category.path}
            </p>
          </Surface>

          <CategoryForm mode="edit" category={category} parentOptions={selectableParents} />
        </Stack>
      </Surface>

      <Surface padding="md" tone="raised" as="section">
        <SectionHeading
          title="Attribute bindings"
          level={2}
          description="Which structured facts this category collects, and how each one behaves on the public site."
        />
        <div style={{ marginTop: 'var(--mantine-spacing-md)' }}>
          <CategoryAttributeEditor
            categoryId={category.id}
            bindings={bindings}
            attributes={attributes}
            boundAttributeIds={bindings.map((binding) => binding.attributeId)}
          />
        </div>
      </Surface>
    </>
  );
}
