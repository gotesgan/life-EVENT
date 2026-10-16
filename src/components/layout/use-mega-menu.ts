'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { activeSectionId } from './navigation';

/**
 * Grace period before a hover-opened panel closes, so a pointer travelling
 * diagonally from the trigger to the panel is not clipped off on the way.
 */
const CLOSE_DELAY_MS = 120;

export interface MegaMenu {
  /** The section that owns the current page, or `null` — for the active styling. */
  activeId: string | null;
  /** The section whose panel is open, or `null`. */
  openId: string | null;
  open: (sectionId: string) => void;
  close: () => void;
  /** Start the grace period that lets a pointer leave the trigger for the panel. */
  scheduleClose: () => void;
  /** Abandon a scheduled close — the pointer came back. */
  cancelClose: () => void;
}

/**
 * State for the header's dropdown sections: which one is open, which one is the
 * current page, and the timer that gives a pointer time to reach the panel.
 *
 * Lifted out of `HeaderNav` so the component reads as markup, and so the next
 * surface that wants hover-opened navigation can reuse the behaviour rather than
 * re-derive it — including the two subtleties below, which are easy to get wrong
 * a second time.
 *
 * `openId` alone would leave the panel open across a navigation: the pointer
 * follows the link to a new page and the menu stays up over it. Landing on a new
 * path is the end of that interaction, so the pathname clears it. Done by
 * adjusting state during render rather than in an effect, because the pathname is
 * already known here — React restarts the render immediately instead of painting
 * an open panel for a frame and then cascading a second render.
 */
export function useMegaMenu(): MegaMenu {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  }, [cancelClose]);

  /* Clears a pending close if the header ever unmounts. */
  useEffect(() => cancelClose, [cancelClose]);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpenId(null);
  }

  return {
    activeId: activeSectionId(pathname),
    openId,
    open: setOpenId,
    close: () => setOpenId(null),
    scheduleClose,
    cancelClose,
  };
}
