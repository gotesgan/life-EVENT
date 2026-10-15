import Link from 'next/link';
import { cx } from '@/components/ui';
import classes from './AccountNav.module.css';

export type AccountSection = 'overview' | 'enquiries' | 'profile';

const LINKS: ReadonlyArray<{ id: AccountSection; href: string; label: string }> = [
  { id: 'overview', href: '/account', label: 'Overview' },
  { id: 'enquiries', href: '/account/enquiries', label: 'My enquiries' },
  { id: 'profile', href: '/account/profile', label: 'Profile' },
];

export interface AccountNavProps {
  active: AccountSection;
}

/**
 * The three account destinations, as real links.
 *
 * A Server Component with an explicit `active` prop rather than a pathname hook:
 * the active tab is already known where the page is rendered, so this costs no
 * client JavaScript and cannot mismatch during hydration. It renders inside the
 * caller's `<main>`, so it is a `<nav>` labelled "Account", not a second
 * landmark for the whole page.
 */
export function AccountNav({ active }: AccountNavProps) {
  return (
    <nav className={classes.nav} aria-label="Account">
      <ul className={classes.list}>
        {LINKS.map((link) => {
          const isActive = link.id === active;
          return (
            <li key={link.id}>
              <Link
                href={link.href}
                className={cx(classes.link, isActive && classes.active)}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
