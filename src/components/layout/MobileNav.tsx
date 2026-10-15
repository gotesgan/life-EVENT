'use client';

import Link from '@/components/ui/ClientLink';
import { Burger, Drawer, NavLink } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronRight } from '@tabler/icons-react';
import { FOOTER_COMPANY, FOOTER_LEGAL, PRIMARY_NAV } from './navigation';
import classes from './MobileNav.module.css';

export interface MobileNavProps {
  /** Extra links appended under "Categories" — supplied by the caller when known. */
  categoryLinks?: ReadonlyArray<{ href: string; label: string }>;
}

/**
 * Mobile navigation as a left-side `Drawer`.
 *
 * Mantine's `Drawer` traps focus, closes on Escape, restores focus to the
 * burger on close and locks scroll — all defaults, none of them disabled here.
 * `Burger` carries its own accessible label and `aria-expanded`, which is why
 * its label is left exactly as it is.
 *
 * Group labels are visible rather than `visually-hidden`: at 82vw the drawer
 * holds four lists and roughly twenty rows, and four unlabelled blocks of links
 * is a wall. The accessible name of each link is unchanged — the group label
 * was already exposed, it just now also paints.
 */
export function MobileNav({ categoryLinks }: MobileNavProps) {
  const [opened, { open, close }] = useDisclosure(false);

  const renderGroup = (label: string, links: ReadonlyArray<{ href: string; label: string }>) => (
    <div className={classes.group} key={label}>
      <p className={classes.groupLabel}>{label}</p>
      <ul className={classes.groupList}>
        {links.map((link) => (
          <li key={link.href}>
            <NavLink
              className={classes.link}
              component={Link}
              href={link.href}
              label={link.label}
              onClick={close}
              rightSection={<IconChevronRight size="1rem" stroke={1.5} aria-hidden />}
            />
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <Burger opened={opened} onClick={open} size="sm" aria-label="Open navigation menu" />

      <Drawer
        opened={opened}
        onClose={close}
        position="left"
        size="min(82vw, 20rem)"
        title="Menu"
        classNames={{ body: classes.drawerBody }}
      >
        <nav aria-label="Mobile">
          {renderGroup('Browse', PRIMARY_NAV)}
          {categoryLinks && categoryLinks.length > 0
            ? renderGroup('Categories', categoryLinks)
            : null}
          {renderGroup('Live Envt', FOOTER_COMPANY)}
          {renderGroup('Legal', FOOTER_LEGAL)}
        </nav>
      </Drawer>
    </>
  );
}
