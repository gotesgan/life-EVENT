/**
 * Guided-tour contracts.
 *
 * A tour is plain serialisable data so the same definition can be rendered by a
 * Server Component (as the Settings card) and by the client engine without
 * passing functions or JSX across the boundary.
 */
export interface TourStep {
  /** Stable id — used for React keys, announcements and tests. */
  id: string;
  title: string;
  body: string;
  /**
   * CSS selector for the element to highlight. Omitted for a centred card:
   * welcome, explanation and completion steps are deliberately not attached to
   * a control, so a missing element can never strand the tour.
   */
  target?: string;
  /**
   * The admin route this step lives on. When it differs from the current path,
   * the host navigates first and the engine waits for the target to appear.
   */
  path?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourDefinition {
  id: string;
  title: string;
  /** `localStorage` key for completed/dismissed state. */
  storageKey: string;
  steps: readonly TourStep[];
}

/** Custom event names shared between launchers and the host. */
export const TOUR_START_EVENT = 'lifeevents:tour:start';
export const TOUR_RESET_EVENT = 'lifeevents:tour:reset';

export interface TourStartDetail {
  tourId: string;
}
