import Link from '@/components/ui/ClientLink';
import { Button } from '@/components/ui/Button';
import { IconUser, IconUserCircle } from '@tabler/icons-react';
import { getOptionalUser } from '@/lib/auth/actor';
import { SignOutButton } from './SignOutButton';
import classes from './HeaderAccount.module.css';

/**
 * Sign-in / account affordance in the header.
 *
 * Server-rendered so the header never flashes "Sign in" at a signed-in user.
 * It reads the session, which is request data, so the caller must render it
 * inside a `<Suspense>` boundary.
 */
export async function HeaderAccount() {
  const user = await getOptionalUser();

  if (!user) {
    return (
      <Button
        component={Link}
        href="/sign-in?next=%2Faccount"
        variant="secondary"
        size="sm"
        leftSection={<IconUser size="1rem" stroke={1.5} aria-hidden />}
      >
        Sign in
      </Button>
    );
  }

  const firstName = user.name.trim().split(/\s+/)[0] || 'Account';

  return (
    <div className={classes.account}>
      <Button
        component={Link}
        href="/account"
        variant="secondary"
        size="sm"
        leftSection={<IconUserCircle size="1rem" stroke={1.5} aria-hidden />}
      >
        {firstName}
      </Button>
      <SignOutButton />
    </div>
  );
}

/** Fallback shown while the session streams in. Deliberately a real link. */
export function HeaderAccountFallback() {
  return (
    <Button
      component={Link}
      href="/sign-in?next=%2Faccount"
      variant="secondary"
      size="sm"
      leftSection={<IconUser size="1rem" stroke={1.5} aria-hidden />}
    >
      Sign in
    </Button>
  );
}
