'use client';

import { Button } from '@/components/ui';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { type ButtonProps } from '@mantine/core';
import {
  TOUR_RESET_EVENT,
  TOUR_START_EVENT,
  type TourDefinition,
  type TourStartDetail,
} from '@/lib/tours/types';
import { GuidedTour } from './GuidedTour';

export interface TourLauncherProps {
  tour: TourDefinition;
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /**
   * `host` asks the shell to run the tour (cross-page admin walkthroughs);
   * `standalone` runs it locally on a single page (the vendor walkthrough).
   */
  mode?: 'host' | 'standalone';
}

/**
 * A button that starts a tour.
 *
 * In `host` mode it only dispatches an event: the tour must outlive this page,
 * because the admin walkthrough navigates between routes. In `standalone` mode
 * it owns the engine itself, which is correct for a single-page story like the
 * vendor registration explainer.
 */
export function TourLauncher({
  tour,
  label = 'Start the guided tour',
  variant = 'filled',
  size = 'sm',
  mode = 'host',
}: TourLauncherProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (mode === 'standalone') {
    return (
      <>
        <Button variant={variant} size={size} onClick={() => setOpen(true)}>
          {label}
        </Button>
        {open ? (
          <GuidedTour
            tour={tour}
            pathname={pathname}
            onClose={(outcome) => {
              try {
                window.localStorage.setItem(tour.storageKey, outcome);
              } catch {
                /* private mode: the tour works, it just will not be remembered */
              }
              setOpen(false);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent<TourStartDetail>(TOUR_START_EVENT, { detail: { tourId: tour.id } }),
        );
      }}
    >
      {label}
    </Button>
  );
}

/**
 * Clears the remembered completion state so the corner prompt returns — useful
 * after a UI change, or when handing the panel to someone new.
 */
export function TourResetButton({
  tours,
  label = 'Show the tour prompt again',
}: {
  tours: readonly TourDefinition[];
  label?: string;
}) {
  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => {
        for (const tour of tours) {
          try {
            window.localStorage.removeItem(tour.storageKey);
          } catch {
            /* ignore */
          }
        }
        window.dispatchEvent(new CustomEvent(TOUR_RESET_EVENT));
      }}
    >
      {label}
    </Button>
  );
}
