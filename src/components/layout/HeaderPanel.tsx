'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  IconArrowRight,
  IconBriefcase,
  IconBuildingStore,
  IconChevronRight,
} from '@tabler/icons-react';
import { Container } from '@/components/ui/Container';
import { Surface } from '@/components/ui/Surface';
import type { NavPanel } from './navigation';
import classes from './SiteHeader.module.css';

interface PanelFeature {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: typeof IconBriefcase;
}

/**
 * The card in the panel's right column.
 *
 * One contextual promotion per section rather than a generic banner: the
 * catalogue sections point at corporate events (the newest surface they can
 * cross-sell), and the corporate section points back at supply —
 * "list your business". Both are real destinations this codebase ships.
 */
const PANEL_FEATURES: Record<string, PanelFeature> = {
  'corporate-events': {
    title: 'List your business',
    body: 'Reach couples and companies already comparing published prices. Four fields, no fee to apply.',
    href: '/partner-with-us',
    cta: 'Register your business',
    icon: IconBuildingStore,
  },
};

const DEFAULT_FEATURE: PanelFeature = {
  title: 'Corporate events',
  body: 'Conference venues, AV production, corporate catering and team offsites, with published prices.',
  href: '/corporate-events',
  cta: 'Explore corporate events',
  icon: IconBriefcase,
};

/**
 * The mega-menu panel: a rail down the left (the side menu), a pane in the middle
 * that swaps as the pointer moves down the rail, and a contextual card on the
 * right.
 *
 * The rail is what makes a wide panel readable — one column of stable
 * destinations and one that answers "narrowed how?". The card stops the right
 * third from being empty space and gives each section somewhere to promote.
 *
 * Split out of `HeaderNav` because it is the only part of the header with state
 * of its own (which rail row is previewed). It renders on the panel surface that
 * `HeaderNav` positions, so it owns no radius, border or background itself.
 */
export function HeaderPanel({
  panel,
  sectionId,
  onNavigate,
}: {
  panel: NavPanel;
  sectionId: string;
  onNavigate: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = panel.rail[activeIndex] ?? panel.rail[0];

  /* A panel with no rail has nothing to show, and the type allows empty. */
  if (!active) return null;

  const feature = PANEL_FEATURES[sectionId] ?? DEFAULT_FEATURE;
  const FeatureIcon = feature.icon;

  return (
    <div className={classes.panelSurface}>
      <Container className={classes.panelContainer}>
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

          <aside className={classes.panelFeature}>
            <Surface tone="muted" padding="md" className={classes.featureCard}>
              <span className={classes.featureIcon} aria-hidden>
                <FeatureIcon size="1.25rem" stroke={1.5} />
              </span>
              <h3 className={classes.featureTitle}>{feature.title}</h3>
              <p className={classes.featureBody}>{feature.body}</p>
              <Link href={feature.href} className={classes.featureLink} onClick={onNavigate}>
                {feature.cta}
                <IconArrowRight size="0.875rem" stroke={1.75} aria-hidden />
              </Link>
            </Surface>
          </aside>
        </div>
      </Container>

      <div className={classes.panelFootWrap}>
        <Container className={classes.panelFoot}>
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
        </Container>
      </div>
    </div>
  );
}
