import { Suspense } from 'react';
import { connection } from 'next/server';
import { Stack } from '@mantine/core';
import { PageHeader, SectionHeading, Surface, TableSkeleton } from '@/components/ui';
import { listCategories } from '@/server/services/catalog.service';
import { categorySelectOptions } from '../../_lib/options';
import { describeError } from '../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { CategoryTree } from '@/components/admin/catalogue/CategoryTree';
import { CategoryCreateButton } from '@/components/admin/catalogue/CategoryCreateButton';

export const metadata = { title: 'Categories' };

export default function AdminCategoriesPage() {
  return (
    <Stack gap="lg">
      <Suspense fallback={<TableSkeleton rows={8} columns={2} />}>
        <CategoriesContent />
      </Suspense>
    </Stack>
  );
}

async function CategoriesContent() {
  // Request-time by definition: the panel is authenticated and the tree carries
  // per-category listing counts that must not be frozen at build time.
  await connection();

  let tree: Awaited<ReturnType<typeof listCategories>>;
  let parentOptions: Awaited<ReturnType<typeof categorySelectOptions>>;
  try {
    [tree, parentOptions] = await Promise.all([
      listCategories({ includeInactive: true }),
      categorySelectOptions(true),
    ]);
  } catch (error) {
    return <RetryState title="Could not load the category tree" detail={describeError(error)} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="The directory structure customers browse. Categories are data, not code: creating one here is what makes it appear on the public site."
        actions={<CategoryCreateButton parentOptions={parentOptions} />}
      />

      <Surface padding="md" tone="raised" as="section">
        <SectionHeading
          title="Category tree"
          level={2}
          description="Listing counts include every published listing in the category and its descendants."
        />
        <div style={{ marginTop: 'var(--mantine-spacing-md)' }}>
          <CategoryTree nodes={tree} />
        </div>
      </Surface>
    </>
  );
}
