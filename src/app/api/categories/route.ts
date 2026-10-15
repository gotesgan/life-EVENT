import { apiHandler, jsonOk } from '@/lib/api/response';
import {
  listCategories,
  type CategoryNode,
  type CategorySummary,
} from '@/server/services/catalog.service';

/** Flattens the category tree into a directory-ready list. */
function toSummary(node: CategoryNode): CategorySummary {
  const { children, ...summary } = node;
  void children;
  return summary;
}

function flattenCategories(nodes: readonly CategoryNode[]): CategorySummary[] {
  const flat: CategorySummary[] = [];
  const walk = (list: readonly CategoryNode[]) => {
    for (const node of list) {
      flat.push(toSummary(node));
      walk(node.children);
    }
  };
  walk(nodes);
  return flat;
}

/**
 * GET /api/categories
 *
 * Public category directory. **Inactive categories are never returned here.**
 *
 * `includeInactive` used to be honoured on this unauthenticated route, which
 * meant disabled, unreleased or retired taxonomy was readable by anyone who
 * guessed the parameter — and location listing had the same hole via
 * `activeOnly=false`. The admin catalogue has its own route and needs the
 * inactive rows; the public surface does not.
 */
export const GET = apiHandler(async () => {
  const tree = await listCategories({ includeInactive: false });

  return jsonOk({ data: flattenCategories(tree), tree });
});
