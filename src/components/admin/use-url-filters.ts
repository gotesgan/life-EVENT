'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { buildQuery as serialiseQuery, type QueryParams } from '@/lib/filter-state';

/**
 * The admin surface's URL state type. Aliased to the shared `QueryParams` so the
 * admin panel and the public search page cannot drift into two different shapes
 * for the same concept.
 */
export type UrlParams = QueryParams;

/*
 * Query serialisation lives in one place: `src/lib/filter-state.ts` owns the
 * filter URL contract for the whole product. Re-implementing it here previously
 * meant the admin panel and the public site could disagree about which
 * parameters are preserved across a page change or a filter removal.
 */

export interface UrlFiltersApi {
  /** Merges a patch into the current query string and navigates. */
  navigate: (patch: UrlParams, options?: { keepPage?: boolean }) => void;
  setValue: (key: string, value: string | undefined) => void;
  clearAll: () => void;
  /** True while the server is re-rendering the filtered result. */
  isPending: boolean;
}

/**
 * URL-persisted filter state.
 *
 * The current values arrive as props from the Server Component (which read them
 * from `searchParams`), and this hook only ever *writes* — it deliberately does
 * not use `useSearchParams`, so the control renders from server data, is
 * shareable, survives a reload, and needs no extra Suspense boundary of its own.
 *
 * Every filter change drops `page`, because "page 7 of the old filter" is never
 * a meaningful target for a new filter.
 */
export function useUrlFilters(current: UrlParams): UrlFiltersApi {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (patch: UrlParams, options?: { keepPage?: boolean }) => {
      const next: UrlParams = { ...current, ...patch };
      if (!options?.keepPage && patch.page === undefined) {
        delete next.page;
      }

      const query = serialiseQuery(next);
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [current, pathname, router],
  );

  const setValue = useCallback(
    (key: string, value: string | undefined) => {
      navigate({ [key]: value && value.length > 0 ? value : undefined });
    },
    [navigate],
  );

  const clearAll = useCallback(() => {
    const cleared: UrlParams = {};
    for (const key of Object.keys(current)) cleared[key] = undefined;
    navigate(cleared);
  }, [current, navigate]);

  return { navigate, setValue, clearAll, isPending };
}
