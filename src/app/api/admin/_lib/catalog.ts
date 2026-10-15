import type { Prisma } from '@/generated/prisma/client';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { buildPath, disambiguateSlug, slugify } from '@/lib/slug';

/**
 * Catalogue write helpers.
 *
 * The catalogue has no write service, so these helpers exist to keep the small
 * amount of shared logic (slug uniqueness, materialised paths, parent-cycle
 * checks) out of the route handlers. Routes that need Prisma call it directly
 * and are commented as a deliberate exception.
 */

type Tx = Prisma.TransactionClient;

/** Slugifies `desired` and appends a numeric suffix until it is free. */
export async function reserveCategorySlug(
  tx: Tx,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const rows = await tx.category.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
    select: { slug: true },
  });
  return disambiguateSlug(slugify(desired), new Set(rows.map((row) => row.slug)));
}

export async function reserveLocationSlug(
  tx: Tx,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const rows = await tx.location.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
    select: { slug: true },
  });
  return disambiguateSlug(slugify(desired), new Set(rows.map((row) => row.slug)));
}

export async function reserveEventTypeSlug(tx: Tx, desired: string): Promise<string> {
  const rows = await tx.eventType.findMany({ select: { slug: true } });
  return disambiguateSlug(slugify(desired), new Set(rows.map((row) => row.slug)));
}

/** Materialised path: the parent path segments plus the node's own slug. */
export function buildChildPath(parentPath: string | null, slug: string): string {
  return buildPath([...(parentPath ? parentPath.split('/') : []), slug]);
}

/**
 * Rewrites every descendant path after a node's slug (and therefore path)
 * changes, deepest first so no intermediate value collides on the unique index.
 */
export async function cascadeCategoryPath(tx: Tx, oldPath: string, newPath: string): Promise<void> {
  const descendants = await tx.category.findMany({
    where: { path: { startsWith: `${oldPath}/` } },
    select: { id: true, path: true },
  });

  descendants.sort((a, b) => b.path.length - a.path.length);

  for (const descendant of descendants) {
    await tx.category.update({
      where: { id: descendant.id },
      data: { path: `${newPath}${descendant.path.slice(oldPath.length)}` },
    });
  }
}

export async function cascadeLocationPath(tx: Tx, oldPath: string, newPath: string): Promise<void> {
  const descendants = await tx.location.findMany({
    where: { path: { startsWith: `${oldPath}/` } },
    select: { id: true, path: true },
  });

  descendants.sort((a, b) => b.path.length - a.path.length);

  for (const descendant of descendants) {
    await tx.location.update({
      where: { id: descendant.id },
      data: { path: `${newPath}${descendant.path.slice(oldPath.length)}` },
    });
  }
}

/**
 * Verifies a requested parent is a real category that is neither the node
 * itself nor one of its descendants (which would create a cycle).
 */
export async function assertCategoryParent(
  tx: Tx,
  categoryId: string,
  parentId: string,
  ownPath: string,
): Promise<{ path: string }> {
  if (parentId === categoryId) {
    throw new ValidationError('A category cannot be its own parent');
  }

  const parent = await tx.category.findUnique({
    where: { id: parentId },
    select: { id: true, path: true },
  });
  if (!parent) throw new NotFoundError('Parent category');

  if (parent.path === ownPath || parent.path.startsWith(`${ownPath}/`)) {
    throw new ValidationError('A category cannot be moved beneath its own descendant');
  }

  return parent;
}

export async function assertLocationParent(
  tx: Tx,
  locationId: string,
  parentId: string,
  ownPath: string,
): Promise<{ path: string }> {
  if (parentId === locationId) {
    throw new ValidationError('A location cannot be its own parent');
  }

  const parent = await tx.location.findUnique({
    where: { id: parentId },
    select: { id: true, path: true },
  });
  if (!parent) throw new NotFoundError('Parent location');

  if (parent.path === ownPath || parent.path.startsWith(`${ownPath}/`)) {
    throw new ValidationError('A location cannot be moved beneath its own descendant');
  }

  return parent;
}
