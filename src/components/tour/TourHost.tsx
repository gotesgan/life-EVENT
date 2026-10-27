'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_TOUR } from '@/lib/tours/admin-tour';
import {
  TOUR_RESET_EVENT,
  TOUR_START_EVENT,
  type TourDefinition,
  type TourStartDetail,
} from '@/lib/tours/types';
import { GuidedTour } from './GuidedTour';
import classes from './TourHost.module.css';

/**
 * The admin tour host.
 *
 * Mounted inside `AdminShell`, which stays mounted across admin route changes.
 * That is what lets one continuous tour walk from the dashboard to Vendor
 * applications to Enquiries to Settings: the overlay and its step index live in
 * the shell, not on a page that unmounts on navigation.
 *
 * The first-visit prompt is local state read after mount (never during
 * render), so server and client agree on the first paint. Completing or
 * dismissing records the outcome in `localStorage`; Settings can replay it.
 */
function readState(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function TourHost() {
  const router = useRouter();
  const pathname = usePathname();
  const [tour, setTour] = useState<TourDefinition | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);

  /* Hydration-safe read; the prompt simply does not exist in the server HTML. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPromptVisible(readState(ADMIN_TOUR.storageKey) === null);
  }, []);

  const complete = useCallback((outcome: 'completed' | 'dismissed') => {
    try {
      window.localStorage.setItem(ADMIN_TOUR.storageKey, outcome);
    } catch {
      /* Private mode: the tour still works, it just will not remember. */
    }
    setTour(null);
    setPromptVisible(false);
  }, []);

  useEffect(() => {
    const onStart = (event: Event) => {
      const detail = (event as CustomEvent<TourStartDetail>).detail;
      if (detail?.tourId !== ADMIN_TOUR.id) return;
      setPromptVisible(false);
      setTour(ADMIN_TOUR);
    };

    const onReset = () => {
      try {
        window.localStorage.removeItem(ADMIN_TOUR.storageKey);
      } catch {
        /* ignore */
      }
      setPromptVisible(true);
    };

    window.addEventListener(TOUR_START_EVENT, onStart);
    window.addEventListener(TOUR_RESET_EVENT, onReset);
    return () => {
      window.removeEventListener(TOUR_START_EVENT, onStart);
      window.removeEventListener(TOUR_RESET_EVENT, onReset);
    };
  }, []);

  if (tour) {
    return (
      <GuidedTour
        tour={tour}
        pathname={pathname}
        onNavigate={(path) => router.push(path)}
        onClose={complete}
      />
    );
  }

  /*
   * The prompt is a dashboard affordance, not a permanent overlay. On an editor
   * page it would sit on top of the form the visitor is trying to use.
   */
  if (!promptVisible || pathname !== '/admin') return null;

  return (
    <aside className={classes.prompt} aria-label="Guided tour">
      <p className={classes.promptTitle}>New to the back office?</p>
      <p className={classes.promptBody}>
        A two-minute guided tour covers onboarding a vendor, approving the listing and answering the
        first enquiry.
      </p>
      <div className={classes.promptActions}>
        <button
          type="button"
          className={classes.promptPrimary}
          onClick={() => {
            setPromptVisible(false);
            setTour(ADMIN_TOUR);
          }}
        >
          Show me around
        </button>
        <button
          type="button"
          className={classes.promptSecondary}
          onClick={() => complete('dismissed')}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
