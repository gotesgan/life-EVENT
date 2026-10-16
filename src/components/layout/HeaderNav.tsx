'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Popover } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { NAV_SECTIONS, type NavPanel } from './navigation';
import classes from './SiteHeader.module.css';

/**
 * Grace period before a hover-opened panel closes, so a pointer travelling
 * diagonally from the trigger to the panel is not clipped off on the way.
 */
const CLOSE_DELAY_MS = 120;

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
 * The primary navigation, with a dropdown per section.
 *
 * **Why a `Popover` and not a `Menu`.** These panels are navigation, not a list
 * of commands: `Menu` would put `role="menu"`/`menuitem` on a set of links and
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
 * `withRoles={false}` because Mantine would otherwise stamp `aria-haspopup` and
 * a button role onto an anchor that is genuinely a link.
 */
export function HeaderNav() {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  }, [cancelClose]);

  /* Clears a pending close if this nav ever unmounts. */
  useEffect(() => cancelClose, [cancelClose]);

  /*
   * Landing on a new page is the end of the interaction that opened the panel.
   * Adjusted during render rather than in an effect: the pathname is already
   * known here, so React can restart the render immediately instead of painting
   * an open panel for one frame and then cascading a second render.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenId(null);
  }

  return (
    <nav className={classes.nav} aria-label="Primary">
      <ul className={classes.navList}>
        {NAV_SECTIONS.map((section) => {
          const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`);
          const isOpen = openId === section.id;
          const panel = section.panel;

          if (!panel) {
            return (
              <li key={section.id} className={classes.navItem}>
                <Link
                  className={classes.navLink}
                  href={section.href}
                  data-active={isActive ? 'true' : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
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
                setOpenId(section.id);
              }}
              onMouseLeave={scheduleClose}
            >
              <Popover
                opened={isOpen}
                onChange={(next) => {
                  if (!next) setOpenId(null);
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
                    data-active={isActive ? 'true' : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={isOpen}
                    onFocus={() => {
                      cancelClose();
                      setOpenId(section.id);
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
                  <PanelContents panel={panel} onNavigate={() => setOpenId(null)} />
                </Popover.Dropdown>
              </Popover>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The panel itself: a rail down the left (the side menu) and a pane on the right
 * that swaps as the pointer moves down the rail.
 *
 * The rail is the side menu the brief asks for — it is what makes a wide panel
 * readable, by giving one column of stable destinations and one column that
 * answers "narrowed how?".
 */
function PanelContents({ panel, onNavigate }: { panel: NavPanel; onNavigate: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = panel.rail[activeIndex] ?? panel.rail[0];

  if (!active) return null;

  return (
    <div className={classes.panelSurface}>
      <div className={classes.panelBody}>
        <div className={classes.panelRail}>
          <p className={classes.panelHeading}>{panel.railHeading}</p>
          <ul className={classes.panelRailList}>
            {panel.rail.map((item, index) => (
              <li key={`${item.href}::${item.label}`}>
                <Link
                  href={item.href}
                  className={classes.panelRailLink}
                  data-active={index === activeIndex ? 'true' : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={onNavigate}
                >
                  <span className={classes.panelRailLabel}>{item.label}</span>
                  <IconChevronRight
                    className={classes.panelRailChevron}
                    size="0.875rem"
                    stroke={1.75}
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className={classes.panelPane}>
          <p className={classes.panelPaneTitle}>
            {active.label}
            <span className={classes.panelPaneNote}>{active.description}</span>
          </p>
          <ul className={classes.panelLinkGrid}>
            {active.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={classes.panelLink} onClick={onNavigate}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={classes.panelFoot}>
        {panel.quickLinks.map((link) => (
          <Link
            key={`${link.href}::${link.label}`}
            href={link.href}
            className={classes.panelFootLink}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
