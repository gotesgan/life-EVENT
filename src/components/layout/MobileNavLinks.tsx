'use client';

import Link from '@/components/ui/ClientLink';
import { usePathname } from 'next/navigation';
import { NavLink } from '@mantine/core';
import { DRAWER_GROUPS, currentNavHref } from './navigation';
import classes from './MobileNav.module.css';

/**
 * The drawer's link groups.
 *
 * Split out from `MobileNav` so that component can be prerendered: this one reads
 * `usePathname()` for the current-page marker, and that hook cannot be evaluated
 * while prerendering (Next.js 16 fails the build with `CLIENT_HOOK_DYNAMIC`). The
 * caller wraps it in `<Suspense>` — the drawer shell is static chrome, the list
 * streams in behind it.
 *
 * Marking the current page matters more here than on desktop: the drawer covers
 * the page it was opened from, so the only thing telling you where you are is the
 * list itself. Exactly one row is marked — `currentNavHref` exists because three
 * drawer rows (`/vendors`, `/categories/venues`, `/categories`) sit on paths that
 * naively match one another.
 *
 * The marker is two-channel: Mantine tints the active row and the stylesheet adds
 * a brand rule down its inline-start edge, so the state does not depend on
 * colour alone (WCAG 1.4.1).
 */
export function MobileNavLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  const current = currentNavHref(
    pathname,
    DRAWER_GROUPS.flatMap((group) => [...group.links]),
  );

  return (
    <nav aria-label="Mobile">
      {DRAWER_GROUPS.map((group) => (
        <div className={classes.group} key={group.label}>
          <p className={classes.groupLabel}>{group.label}</p>
          <ul className={classes.groupList}>
            {group.links.map((link) => {
              const isActive = current !== null && link.href === current;

              return (
                <li key={link.href}>
                  <NavLink
                    className={classes.link}
                    component={Link}
                    href={link.href}
                    label={link.label}
                    active={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onNavigate}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
