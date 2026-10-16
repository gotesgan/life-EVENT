import { Suspense, type ReactNode } from 'react';
import { cx } from '@/components/ui/cx';
import { MobileTabBar, MobileTabBarFallback } from './MobileTabBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import classes from './SiteShell.module.css';

export interface SiteShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Page chrome for every public page: skip link, header, `<main>`, footer, and
 * the phone-only quick-action bar.
 *
 * This is a component rather than a route-group layout because the root
 * `src/app/layout.tsx` is owned by the design-system foundation and is outside
 * this workstream's write scope. Pages compose it explicitly, which also keeps
 * the `main` landmark and the single `h1` contract visible at each call site.
 *
 * `SiteHeader` and `MobileTabBar` both read the session, so each is wrapped in
 * its own `<Suspense>` — the static shell still renders instantly and the two
 * account affordances stream in. The tab bar lives outside `<main>` because it is
 * chrome: it must not scroll with the content it is pinned above.
 */
export function SiteShell({ children, className }: SiteShellProps) {
  return (
    <div className={cx(classes.root, className)}>
      <a className={classes.skipLink} href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className={classes.main}>
        {children}
      </main>
      <SiteFooter />
      <Suspense fallback={<MobileTabBarFallback />}>
        <MobileTabBar />
      </Suspense>
    </div>
  );
}
