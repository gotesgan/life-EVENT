'use client';

import { usePathname } from 'next/navigation';
import { MobileTabBarView } from './MobileTabBarView';

export interface MobileTabBarLinksProps {
  /** Where the account tab goes — the sign-in gate or the account page. */
  accountHref: string;
  /** The account tab's label: the first name when known, else "Sign in". */
  accountLabel: string;
}

/**
 * Mobile quick-action bar, with the active tab marked.
 *
 * This wrapper exists only to own `usePathname()`. Everything it renders lives in
 * `MobileTabBarView`, which is hook-free so the prerendered `<Suspense>` fallback
 * can share it — see that file for why the split is load-bearing.
 */
export function MobileTabBarLinks({ accountHref, accountLabel }: MobileTabBarLinksProps) {
  const pathname = usePathname();

  return (
    <MobileTabBarView accountHref={accountHref} accountLabel={accountLabel} pathname={pathname} />
  );
}
