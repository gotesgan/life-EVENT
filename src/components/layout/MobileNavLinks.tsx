'use client';

import Link from '@/components/ui/ClientLink';
import { usePathname } from 'next/navigation';
import { NavLink } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { DRAWER_GROUPS } from './navigation';
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
 * list itself.
 */
export function MobileNavLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();

  /* A query string is not part of a page's identity — `/vendors?verified=true`
     is the same route as `/vendors`. */
  const isActive = (href: string) => {
    const path = href.split('?')[0] ?? href;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <nav aria-label="Mobile">
      {DRAWER_GROUPS.map((group) => (
        <div className={classes.group} key={group.label}>
          <p className={classes.groupLabel}>{group.label}</p>
          <ul className={classes.groupList}>
            {group.links.map((link) => (
              <li key={link.href}>
                <NavLink
                  className={classes.link}
                  component={Link}
                  href={link.href}
                  label={link.label}
                  active={isActive(link.href)}
                  onClick={onNavigate}
                  rightSection={<IconChevronRight size="1rem" stroke={1.5} aria-hidden />}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
