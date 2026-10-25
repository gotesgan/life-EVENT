import { describe, expect, it } from 'vitest';
import { ADMIN_TOUR } from '@/lib/tours/admin-tour';
import { VENDOR_TOUR } from '@/lib/tours/vendor-tour';
import type { TourDefinition } from '@/lib/tours/types';

/**
 * Tour definitions are content, but structural mistakes break the product: a
 * duplicated id collides in React, an empty body renders a blank card, and an
 * admin step pointing at a non-admin route would navigate the operator out of
 * the panel mid-tour.
 */
function checkTour(tour: TourDefinition, expectedPathPrefix: string) {
  const ids = tour.steps.map((step) => step.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(tour.steps.length).toBeGreaterThan(2);
  expect(tour.steps[0]?.id).toBe('welcome');
  expect(tour.steps.at(-1)?.id).toBe('done');

  for (const step of tour.steps) {
    expect(step.title.trim().length).toBeGreaterThan(0);
    expect(step.body.trim().length).toBeGreaterThan(20);
    if (step.path) expect(step.path.startsWith(expectedPathPrefix)).toBe(true);
    if (step.target) expect(step.target.trim().length).toBeGreaterThan(0);
  }

  // Welcome and completion are deliberately centred (no target) so a missing
  // element can never strand the visitor at the start or the end.
  expect(tour.steps[0]?.target).toBeUndefined();
  expect(tour.steps.at(-1)?.target).toBeUndefined();
}

describe('admin tour', () => {
  it('is a complete, uniquely identified walkthrough of admin routes', () => {
    checkTour(ADMIN_TOUR, '/admin');
    expect(ADMIN_TOUR.id).toBe('admin');
    expect(ADMIN_TOUR.storageKey).toContain('admin');
  });

  it('covers supply, the listing editor and enquiries', () => {
    const ids = ADMIN_TOUR.steps.map((step) => step.id);
    expect(ids).toContain('invite-form');
    expect(ids).toContain('applications-list');
    expect(ids).toContain('enquiry-inbox');
    expect(ids).toContain('settings');
  });

  it('navigates only between admin pages', () => {
    const paths = new Set(ADMIN_TOUR.steps.map((step) => step.path).filter(Boolean));
    for (const path of paths) expect(path).toMatch(/^\/admin/);
  });
});

describe('vendor tour', () => {
  it('stays on the registration page and explains the next steps', () => {
    checkTour(VENDOR_TOUR, '/partner-with-us');
    expect(VENDOR_TOUR.id).toBe('vendor');
    expect(VENDOR_TOUR.steps.map((step) => step.id)).toContain('submit');
    expect(VENDOR_TOUR.steps.at(-2)?.title).toMatch(/what happens next/i);
  });
});
