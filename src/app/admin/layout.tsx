import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentActor } from '@/lib/auth/actor';
import { adminListEnquiries } from '@/server/services/admin-enquiry.service';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * The admin segment's authorization gate.
 *
 * Two decisions are deliberate:
 *
 * 1. **Nothing is rendered before the actor is resolved.** An anonymous visitor
 *    is redirected to sign-in with a `next` value, and a signed-in *customer* is
 *    answered with `notFound()` rather than a "forbidden" page — a 403-style
 *    screen confirms that `/admin` exists, which is information a non-admin has
 *    no reason to be given. The route is indistinguishable from a typo.
 * 2. **`instant = false`.** `cacheComponents: true` is enabled, and this layout
 *    reads the session at the top level because it must refuse to render
 *    `{children}` before authorization. A request read outside a `<Suspense>`
 *    boundary cannot be prerendered, and the framework's documented escape
 *    hatch for exactly this case is `export const instant = false` (see
 *    `node_modules/next/dist/docs/…/authentication-with-cache-components.md` and
 *    the root layout's note in `src/app/layout.tsx`). Without it the build fails
 *    with "uncached or runtime data during prerendering". Wrapping the gate in
 *    `<Suspense>` is not an option: children would begin rendering inside the
 *    boundary before the check resolved.
 *
 * Server-side service calls in the pages below still sit inside `<Suspense>`
 * with real skeletons, so a slow query never blocks the page.
 */
export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor();

  if (actor.kind === 'anonymous') {
    redirect('/sign-in?next=/admin');
  }
  if (actor.user.role !== 'ADMIN') {
    notFound();
  }

  // The nav badge is the only data this layout needs. A failure to count must
  // not take the whole back office down, so it degrades to `null` and the badge
  // simply does not render.
  let newEnquiryCount: number | null = null;
  try {
    const result = await adminListEnquiries({
      page: 1,
      pageSize: 1,
      status: 'NEW',
      sort: 'newest',
    });
    newEnquiryCount = result.pagination.totalItems;
  } catch {
    newEnquiryCount = null;
  }

  return (
    <AdminShell actorName={actor.user.name} newEnquiryCount={newEnquiryCount}>
      {children}
    </AdminShell>
  );
}
