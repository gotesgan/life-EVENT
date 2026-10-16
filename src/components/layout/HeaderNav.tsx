'use client';

import Link from 'next/link';
import { Popover } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { HeaderPanel } from './HeaderPanel';
import { NAV_SECTIONS } from './navigation';
import { useMegaMenu } from './use-mega-menu';
import classes from './SiteHeader.module.css';

/**
 * Panel surface. Applied inline rather than through the stylesheet because
 * Mantine paints `Popover.Dropdown` from its own colour variables, and an inline
 * declaration beats any stylesheet rule regardless of bundle order — no
 * `!important`, no specificity arms race.
 */
const PANEL_STYLE = {
  backgroundColor: 'var(--app-surface-raised)',
  borderColor: 'var(--app-border)',
  overflow: 'hidden',
} as const;

/**
 * The primary navigation: one entry per section, with a dropdown for the sections
 * that carry a panel.
 *
 * **Why a `Popover` and not a `Menu`.** These panels are navigation, not a list of
 * commands: `Menu` would put `role="menu"`/`menuitem` on a set of links and
 * promise arrow-key semantics this does not implement. `Popover` gives the parts
 * that are actually needed — Escape, click-outside, focus return — and leaves the
 * markup as ordinary `<nav>`/`<a>`, so the accessible tree matches what the
 * element does.
 *
 * **Opening.** Hover for a pointer, focus for a keyboard. Both are on the section
 * wrapper, and `withinPortal={false}` keeps the panel a DOM descendant of that
 * wrapper — which is what stops `mouseleave` firing the moment the pointer
 * crosses from the trigger into the panel. The trigger stays a real link, so a
 * click still navigates to the section index rather than dead-ending.
 *
 * `withRoles={false}` because Mantine would otherwise stamp `aria-haspopup` and a
 * button role onto an anchor that is genuinely a link.
 *
 * Which section is open, and the grace period that lets a pointer reach its panel,
 * live in `useMegaMenu`; the panel's own markup lives in `HeaderPanel`.
 */
export function HeaderNav() {
  const { activeId, openId, open, close, scheduleClose, cancelClose } = useMegaMenu();

  return (
    <nav className={classes.nav} aria-label="Primary">
      <ul className={classes.navList}>
        {NAV_SECTIONS.map((section) => {
          const isActive = section.id === activeId;
          const isOpen = openId === section.id;
          const panel = section.panel;

          const activeProps = {
            'data-active': isActive ? 'true' : undefined,
            'aria-current': isActive ? ('page' as const) : undefined,
          };

          if (!panel) {
            return (
              <li key={section.id} className={classes.navItem}>
                <Link className={classes.navLink} href={section.href} {...activeProps}>
                  {section.label}
                </Link>
              </li>
            );
          }

          return (
            <li
              key={section.id}
              className={classes.navItem}
              data-open={isOpen ? 'true' : undefined}
              onMouseEnter={() => {
                cancelClose();
                open(section.id);
              }}
              onMouseLeave={scheduleClose}
            >
              <Popover
                opened={isOpen}
                onChange={(next) => {
                  /* Mantine reports every dismissal — Escape, click-outside. */
                  if (!next) close();
                }}
                position="bottom-start"
                offset={6}
                width="min(46rem, calc(100vw - 2rem))"
                radius="var(--app-radius-card)"
                shadow="var(--app-shadow-overlay)"
                withinPortal={false}
                withRoles={false}
                returnFocus={false}
                transitionProps={{ duration: 0 }}
              >
                <Popover.Target>
                  <Link
                    className={classes.navLink}
                    href={section.href}
                    {...activeProps}
                    aria-expanded={isOpen}
                    onFocus={() => {
                      cancelClose();
                      open(section.id);
                    }}
                  >
                    {section.label}
                    <IconChevronDown
                      className={classes.navChevron}
                      size="0.8125rem"
                      stroke={2}
                      aria-hidden
                    />
                  </Link>
                </Popover.Target>

                <Popover.Dropdown p={0} style={PANEL_STYLE}>
                  <HeaderPanel panel={panel} onNavigate={() => close()} />
                </Popover.Dropdown>
              </Popover>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
