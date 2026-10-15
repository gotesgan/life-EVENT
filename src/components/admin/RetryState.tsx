'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/ui';

export interface RetryStateProps {
  title?: string;
  description?: ReactNode;
  /** Extra label shown under the description (the server's message). */
  detail?: string;
}

/**
 * `ErrorState` with a working retry.
 *
 * `ErrorState` takes an `onRetry` callback, which a Server Component cannot
 * pass, so this thin client wrapper exists to call `router.refresh()` — the
 * server re-runs the failed read instead of the browser reloading the page.
 */
export function RetryState({
  title = 'Could not load this data',
  description,
  detail,
}: RetryStateProps) {
  const router = useRouter();

  return (
    <ErrorState
      title={title}
      description={description ?? detail ?? 'The server did not return a result. Try again.'}
      onRetry={() => router.refresh()}
    />
  );
}
