'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { IconLogout } from '@tabler/icons-react';

export interface SignOutButtonProps {
  /** Where to land after the session is cleared. */
  redirectTo?: string;
}

/**
 * Clears the Better Auth session via its handler and returns to the homepage.
 *
 * A plain `fetch` POST to `/api/auth/sign-out` is the documented handler call;
 * no client-side auth SDK is needed for one action. The button owns its own
 * pending state so a slow request cannot be double-submitted.
 */
export function SignOutButton({ redirectTo = '/' }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error(`Sign out failed: ${response.status}`);
      router.push(redirectTo);
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={signOut}
      leftSection={!pending ? <IconLogout size="1rem" stroke={1.5} aria-hidden /> : undefined}
      aria-label="Sign out"
      title={failed ? 'Sign out failed — please try again' : undefined}
    >
      {failed ? 'Retry sign out' : 'Sign out'}
    </Button>
  );
}
