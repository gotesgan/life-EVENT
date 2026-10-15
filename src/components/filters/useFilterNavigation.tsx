'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildQuery, parseQuery, type QueryParams } from '@/lib/filter-state';

interface FilterNavigationContextValue {
  /**
   * Where filter changes should navigate. Defaults to the current pathname;
   * a category landing page points this at `/vendors` so its sidebar performs
   * the search on the results surface instead of on the landing page.
   */
  basePath?: string;
  /**
   * Parameters that always apply on this surface, e.g. `{ category: 'venues' }`
   * on a category landing page. Live URL parameters win over the seed.
   */
  seed?: QueryParams;
}

const FilterNavigationContext = createContext<FilterNavigationContextValue>({});

export interface FilterNavigationProviderProps extends FilterNavigationContextValue {
  children: ReactNode;
}

/**
 * Points any filter controls below it at a specific surface.
 *
 * The category landing pages need a filter sidebar whose interactions land on
 * `/vendors?category=…` rather than on the landing URL, and they need the
 * category to be part of the query even though it is not in their own URL. This
 * provider supplies both without any control knowing about either page.
 */
export function FilterNavigationProvider({
  basePath,
  seed,
  children,
}: FilterNavigationProviderProps) {
  const value = useMemo(() => ({ basePath, seed }), [basePath, seed]);
  return (
    <FilterNavigationContext.Provider value={value}>{children}</FilterNavigationContext.Provider>
  );
}

export interface FilterNavigation {
  /** Current URL state, parsed, with any provider seed merged underneath it. */
  params: QueryParams;
  pathname: string;
  /** Replace the current history entry — used for typing. */
  replace: (next: QueryParams) => void;
  /** Push a new history entry — used for deliberate filter changes. */
  push: (next: QueryParams) => void;
  /** Apply a mutation to the current params. Pushes unless `replace` is set. */
  update: (mutate: (params: QueryParams) => QueryParams, options?: { replace?: boolean }) => void;
}

/**
 * The single bridge between filter controls and the URL.
 *
 * The URL is the state container (system design §6.6), so no control keeps its
 * own copy of a filter: every change is a mutation of the parsed query, and the
 * helpers in `@/lib/filter-state` guarantee that pagination resets on a filter
 * change and that "remove one chip" touches exactly one key.
 *
 * Exactly one navigation is issued per change, and typing goes through
 * `replace` so a search box cannot flood the back button.
 */
export function useFilterNavigation(): FilterNavigation {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { basePath, seed } = useContext(FilterNavigationContext);

  const params = useMemo(() => {
    const live = parseQuery(searchParams.toString());
    return seed ? { ...seed, ...live } : live;
  }, [searchParams, seed]);

  const target = basePath ?? pathname;

  /**
   * The most recent query the user has asked for, which is not always the one
   * the router has rendered yet.
   *
   * `update` used to mutate the `params` it closed over. Two changes inside one
   * render — a debounced search commit landing in the same tick as a facet click,
   * or two clicks on different facets — both read the *pre-update* query, so the
   * second discarded the first. The ref short-circuits that: each handler records
   * the query it just produced, and the next handler builds on that rather than
   * on the render it happens to be attached to.
   */
  const pendingRef = useRef<QueryParams | null>(null);

  // Re-sync whenever the URL catches up (a back/forward navigation, or the
  // router applying the change). Written in an effect, never during render.
  useEffect(() => {
    pendingRef.current = params;
  }, [params]);

  const go = useCallback(
    (next: QueryParams, replace: boolean) => {
      pendingRef.current = next;
      const href = `${target}${buildQuery(next)}`;
      if (replace) router.replace(href);
      else router.push(href);
    },
    [target, router],
  );

  const update = useCallback<FilterNavigation['update']>(
    (mutate, options) => {
      go(mutate(pendingRef.current ?? params), options?.replace ?? false);
    },
    [go, params],
  );

  const replace = useCallback((next: QueryParams) => go(next, true), [go]);
  const push = useCallback((next: QueryParams) => go(next, false), [go]);

  return { params, pathname: target, replace, push, update };
}
