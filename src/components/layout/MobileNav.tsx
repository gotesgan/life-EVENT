'use client';

import { Suspense } from 'react';
import { Burger, Drawer } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MobileNavLinks } from './MobileNavLinks';
import classes from './MobileNav.module.css';

/**
 * Mobile navigation as a left-side `Drawer` — the counterpart to the
 * quick-action bar.
 *
 * The split is deliberate: five controls are always reachable on the bar (home,
 * browse, search, enquire, account), and *everything else* is here, which is why
 * this drawer carries four labelled groups rather than a short list. Group labels
 * are visible rather than `visually-hidden`: the drawer holds thirteen rows, and
 * unlabelled blocks of links are a wall.
 *
 * Mantine's `Drawer` traps focus, closes on Escape, restores focus to the burger
 * on close and locks scroll — all defaults, none of them disabled here. `Burger`
 * carries its own accessible label and `aria-expanded`; it is left exactly as it
 * is.
 *
 * **Why the links are behind `<Suspense>`.** The burger and the drawer shell are
 * static chrome and prerender; the link list reads `usePathname()` for its
 * current-page marker and cannot. Nesting the boundary here — inside the drawer,
 * rather than around the whole component — keeps the burger in the prerendered
 * HTML, so the header never renders on a phone without a way to open navigation.
 * The empty window is invisible: the drawer is closed until someone taps the
 * burger, and by then the list is there.
 */
export function MobileNav() {
  const [opened, { open, close }] = useDisclosure(false);

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
        <Suspense fallback={null}>
          <MobileNavLinks onNavigate={close} />
        </Suspense>
      </Drawer>
    </>
  );
}
