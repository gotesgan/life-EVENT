'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import type { NavPanel } from './navigation';
import classes from './SiteHeader.module.css';

/**
 * The mega-menu panel: a rail down the left (the side menu) and a pane on the
 * right that swaps as the pointer moves down the rail.
 *
 * The rail is what makes a wide panel readable — one column of stable
 * destinations and one column that answers "narrowed how?".
 *
 * Split out of `HeaderNav` because it is the only part of the header with state
 * of its own (which rail row is previewed), and it is rendered once per section;
 * keeping it separate is what stops the nav list from reading as a component that
 * both routes and paints.
 */
export function HeaderPanel({ panel, onNavigate }: { panel: NavPanel; onNavigate: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = panel.rail[activeIndex] ?? panel.rail[0];

  /* A panel with no rail has nothing to show, and the type allows empty. */
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
