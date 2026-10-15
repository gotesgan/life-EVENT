import Link from '@/components/ui/ClientLink';
import { Button, Group, Text } from '@mantine/core';
import { StatusBadge } from '@/components/ui';
import type { CategoryNode } from '@/server/services/catalog.service';
import classes from './Catalogue.module.css';

export interface CategoryTreeProps {
  nodes: CategoryNode[];
}

/**
 * The category tree with real listing counts.
 *
 * Counts come from `listCategories`, which rolls a published listing in a
 * subcategory up into every ancestor — so "Venues" reads as populated when only
 * "Banquet halls" has listings, which is what an administrator expects to see.
 *
 * A single recursive `<ul>` is used rather than an indenting flat list: the
 * nesting is real information, and a screen reader announces the depth.
 */
export function CategoryTree({ nodes }: CategoryTreeProps) {
  if (nodes.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No categories yet. Create the first one to start building the directory.
      </Text>
    );
  }

  return <CategoryList nodes={nodes} />;
}

function CategoryList({ nodes }: CategoryTreeProps) {
  return (
    <ul className={classes.treeList}>
      {nodes.map((node) => (
        <li key={node.id}>
          <div className={classes.treeRow}>
            <div className={classes.treeMain}>
              <div className={classes.treeTitle}>
                <Text
                  component={Link}
                  href={`/admin/catalogue/categories/${node.id}`}
                  size="sm"
                  fw={600}
                >
                  {node.name}
                </Text>
                <StatusBadge tone={node.isActive ? 'success' : 'neutral'} size="sm">
                  {node.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
                {node.children.length > 0 ? (
                  <Text size="xs" c="dimmed">
                    {node.children.length} {node.children.length === 1 ? 'child' : 'children'}
                  </Text>
                ) : null}
              </div>
              <div className={classes.treeMeta}>
                <span>/{node.slug}</span>
                <span>
                  {node.listingCount} published {node.listingCount === 1 ? 'listing' : 'listings'}
                </span>
                <span>sort {node.sortOrder}</span>
              </div>
              <span className={classes.path}>{node.path}</span>
            </div>

            <Group gap="xs">
              <Button
                component={Link}
                href={`/admin/catalogue/categories/${node.id}`}
                variant="default"
                size="compact-xs"
              >
                Edit
              </Button>
            </Group>
          </div>

          {node.children.length > 0 ? (
            <div className={classes.treeListNested}>
              <CategoryList nodes={node.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
