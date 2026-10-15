import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import classes from './SiteShell.module.css';

export interface SiteShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Page chrome for every public page: skip link, header, `<main>`, footer.
 *
 * This is a component rather than a route-group layout because the root
 * `src/app/layout.tsx` is owned by the design-system foundation and is outside
 * this workstream's write scope. Pages compose it explicitly, which also keeps
 * the `main` landmark and the single `h1` contract visible at each call site.
 *
 * `SiteHeader` reads the session, so it is wrapped in its own `<Suspense>` — the
 * static shell still renders instantly and the account affordance streams in.
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
    </div>
  );
}
