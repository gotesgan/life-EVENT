'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { HeaderPanel } from './HeaderPanel';
import { NAV_SECTIONS } from './navigation';
import { useMegaMenu } from './use-mega-menu';
import classes from './SiteHeader.module.css';

/**
 * The primary navigation: one entry per section, with a full-width panel for the
 * sections that carry one.
 *
 * **Full-width and seamless.** The panel is a fixed layer pinned to the header's
 * bottom edge (`--app-header-utility-height + --app-header-height`), spanning the
 * viewport and carrying no radius, gap or shadow of its own — the header's
 * existing hairline is the only seam, so the bar and the panel read as one sheet
 * rather than a floating card. Content sits in a `Container`, so its columns
 * align with the brand and the nav above.
 *
 * **Why not `Popover` any more.** Mantine's dropdown is a popper positioned
 * against its trigger: a fixed panel width and a 6px offset were exactly the
 * floating-card look this replaces. The behaviours that mattered — hover-open
 * with a grace period, focus-open, Escape, click-outside, close on navigation —
 * are handled here: hover state in `useMegaMenu`, and the dismissal paths as
 * small effects. Links stay ordinary links (no menu roles), and the trigger
 * stays a real link, so a click still navigates to the section index.
 *
 * The panel renders inside the section's `<li>`, which keeps its links next to
 * the trigger in tab order and keeps pointer travel from the trigger into the
 * panel inside the same subtree.
 */
export function HeaderNav() {
  const { activeId, openId, open, close, scheduleClose, cancelClose } = useMegaMenu();
  const navRef = useRef<HTMLElement | null>(null);

  /* Click outside the nav dismisses the panel. Reading `contains` on the nav is
     enough because the panel is a DOM descendant of it, fixed position or not. */
  useEffect(() => {
    if (!openId) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && navRef.current?.contains(event.target)) return;
      close();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openId, close]);

  /* Escape dismisses and hands focus back to the trigger that opened the panel,
     so a keyboard user is never dropped at the top of the document. */
  useEffect(() => {
    if (!openId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      navRef.current?.querySelector<HTMLAnchorElement>(`[data-mega-trigger="${openId}"]`)?.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openId, close]);

  /* A panel pinned under the header would hover over the page while it scrolls;
     scrolling ends the interaction instead. */
  useEffect(() => {
    if (!openId) return;

    const onScroll = () => close();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [openId, close]);

  return (
    <nav
      ref={navRef}
      className={classes.nav}
      aria-label="Primary"
      onBlur={(event) => {
        /* Tabbing or clicking out of the nav entirely closes the panel; moving
           between its own links does not. */
        const next = event.relatedTarget;
        if (next instanceof Node && navRef.current?.contains(next)) return;
        close();
      }}
    >
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
              <Link
                className={classes.navLink}
                href={section.href}
                data-mega-trigger={section.id}
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

              {isOpen ? (
                <div
                  className={classes.megaLayer}
                  data-testid="mega-panel"
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                >
                  <HeaderPanel panel={panel} sectionId={section.id} onNavigate={() => close()} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
