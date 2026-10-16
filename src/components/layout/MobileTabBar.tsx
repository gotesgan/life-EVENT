import { getOptionalUser } from '@/lib/auth/actor';
import { MobileTabBarLinks } from './MobileTabBarLinks';
import { MobileTabBarView } from './MobileTabBarView';

/** The sign-in gate, with a `next` so the visitor lands back on their account. */
const SIGNED_OUT_HREF = '/sign-in?next=%2Faccount';

/**
 * Mobile quick-action bar — the server half.
 *
 * It exists only to resolve the account destination from the session, so the bar
 * never offers "Sign in" to someone already signed in. The caller renders it
 * inside a `<Suspense>` boundary, exactly like `HeaderAccount`; the fallback
 * below is the same bar pointed at the sign-in gate.
 */
export async function MobileTabBar() {
  const user = await getOptionalUser();

  if (!user) {
    return <MobileTabBarLinks accountHref={SIGNED_OUT_HREF} accountLabel="Sign in" />;
  }

  const firstName = user.name.trim().split(/\s+/)[0] || 'Account';

  return <MobileTabBarLinks accountHref="/account" accountLabel={firstName} />;
}

/**
 * Shown while the session streams in.
 *
 * Hook-free on purpose: a `<Suspense>` fallback is prerendered, where
 * `usePathname()` does not exist yet. It renders the identical bar, just with no
 * tab marked current, so nothing shifts when the real one arrives.
 */
export function MobileTabBarFallback() {
  return <MobileTabBarView accountHref={SIGNED_OUT_HREF} accountLabel="Sign in" pathname={null} />;
}
