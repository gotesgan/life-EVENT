import 'server-only';
import {
  listAmenities,
  listCategories,
  listEventTypes,
  listLocations,
} from '@/server/services/catalog.service';
import type { CategoryNode } from '@/server/services/catalog.service';

/**
 * Select options for the admin forms.
 *
 * Every option list the back office renders comes from a public catalogue
 * service, so a category or location can never be offered twice under two
 * labels in two screens. Indentation is derived from the materialised `path`
 * rather than passed in, which keeps the tree readable in a flat `Select`.
 */

export interface SelectOption {
  value: string;
  label: string;
}

function flattenCategories(nodes: readonly CategoryNode[]): SelectOption[] {
  const options: SelectOption[] = [];

  const walk = (list: readonly CategoryNode[]) => {
    for (const node of list) {
      const depth = node.path.split('/').filter(Boolean).length - 1;
      options.push({
        value: node.id,
        label: `${'— '.repeat(Math.max(depth, 0))}${node.name}`,
      });
      if (node.children.length > 0) walk(node.children);
    }
  };

  walk(nodes);
  return options;
}

export async function categorySelectOptions(includeInactive = false): Promise<SelectOption[]> {
  const tree = await listCategories({ includeInactive });
  return flattenCategories(tree);
}

export async function locationSelectOptions(activeOnly = true): Promise<SelectOption[]> {
  const rows = await listLocations({ activeOnly });
  return rows.map((row) => ({
    value: row.id,
    label: `${row.name} · ${row.type.toLowerCase()}`,
  }));
}

export async function eventTypeSelectOptions(): Promise<SelectOption[]> {
  const rows = await listEventTypes();
  return rows.map((row) => ({ value: row.id, label: row.name }));
}

export interface AmenityOption extends SelectOption {
  groupLabel: string | null;
}

export async function amenitySelectOptions(): Promise<AmenityOption[]> {
  const rows = await listAmenities();
  return rows.map((row) => ({
    value: row.id,
    label: row.groupLabel ? `${row.groupLabel} · ${row.label}` : row.label,
    groupLabel: row.groupLabel,
  }));
}
