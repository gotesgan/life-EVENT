import Link from 'next/link';
import {
  IconHome,
  IconLayoutGrid,
  IconSearch,
  IconSend,
  IconUserCircle,
} from '@tabler/icons-react';
import classes from './MobileTabBar.module.css';

export interface MobileTabBarViewProps {
  /** Where the account tab goes — the sign-in gate or the account page. */
  accountHref: string;
  /** The account tab's label: the first name when known, else "Sign in". */
  accountLabel: string;
  /** The current pathname, or `null` before that value exists. */
  pathname: string | null;
}

/**
 * The four static tabs, in reading order.
 *
 * These are the things a visitor reaches for mid-journey — they earn permanent
 * space. Everything else lives one tap away in the drawer, which is the point:
 * five fixed slots is the most a phone bar can carry before the labels start to
 * crowd.
 */
const TABS = [
  { href: '/', label: 'Home', icon: IconHome },
  { href: '/categories', label: 'Browse', icon: IconLayoutGrid },
  { href: '/vendors', label: 'Search', icon: IconSearch },
  { href: '/enquire', label: 'Enquire', icon: IconSend },
] as const;

/**
 * The quick-action bar's markup, deliberately free of hooks.
 *
 * It is split out from `MobileTabBarLinks` because a `<Suspense>` fallback is
 * part of the *prerendered* shell, and prerendering cannot evaluate
 * `usePathname()` (Next.js 16 fails the build with `CLIENT_HOOK_DYNAMIC`). Rather
 * than duplicate the bar for the fallback — where the two copies would drift —
 * the active-state hook lives in a thin client wrapper and the markup lives here,
 * taking the pathname as a prop. `null` means "not known yet", which simply
 * renders every tab inactive.
 *
 * Active state uses two channels: the brand-tinted icon and a rule above the tab
 * — the same underline language as the desktop nav, so the two surfaces read as
 * one system (WCAG 1.4.1).
 *
 * The wrapper is a real `<nav aria-label="Quick actions">` carrying `aria-current`
 * on the active tab, so it is a landmark a screen reader can jump to rather than
 * a row of decorative icons.
 */
export function MobileTabBarView({ accountHref, accountLabel, pathname }: MobileTabBarViewProps) {
  const matches = (href: string) =>
    pathname !== null &&
    (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  /* Query strings must not take part in the active comparison. */
  const accountPath = accountHref.split('?')[0] ?? accountHref;

  return (
    <nav className={classes.bar} aria-label="Quick actions">
      <ul className={classes.list}>
        {TABS.map((tab) => {
          const active = matches(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className={classes.item}>
              <Link
                href={tab.href}
                className={classes.tab}
                data-active={active ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={classes.icon} size="1.375rem" stroke={1.6} aria-hidden />
                <span className={classes.label}>{tab.label}</span>
              </Link>
            </li>
          );
        })}

        <li className={classes.item}>
          <Link
            href={accountHref}
            className={classes.tab}
            data-active={matches(accountPath) ? 'true' : undefined}
            aria-current={matches(accountPath) ? 'page' : undefined}
          >
            <IconUserCircle className={classes.icon} size="1.375rem" stroke={1.6} aria-hidden />
            <span className={classes.label}>{accountLabel}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
