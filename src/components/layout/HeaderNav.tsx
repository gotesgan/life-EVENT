'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV } from './navigation';
import classes from './SiteHeader.module.css';

/**
 * The primary navigation, with the current section marked.
 *
 * This is the one part of the header that needs the pathname, so it is the one
 * client component in the shell's static chrome — the rest of the header
 * (brand, theme switch, account fallback) is still server-rendered.
 *
 * Active state is carried by `aria-current="page"` on the element itself and by
 * two non-colour channels on screen: a 3px brand indicator under the tab and a
 * heavier ink. Colour alone would fail WCAG 1.4.1, and animating the label's
 * weight on hover is explicitly out of bounds (brief §5).
 */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className={classes.nav} aria-label="Primary">
      <ul className={classes.navList}>
        {PRIMARY_NAV.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));

          return (
            <li key={item.href}>
              <Link
                className={classes.navLink}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive ? 'true' : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
