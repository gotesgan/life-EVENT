import { describe, expect, it } from 'vitest';
import {
  DRAWER_GROUPS,
  NAV_SECTIONS,
  activeSectionId,
  currentNavHref,
} from '@/components/layout/navigation';

/**
 * Which navigational link is *the current page*.
 *
 * This lives in the nav data module rather than in a component test because it
 * is the piece that is easy to get wrong and hard to see: a naive
 * `pathname.startsWith(section.href)` lights up two links at `/categories/venues`
 * ("Venues" and the "/categories" catch-all), which is both visually ambiguous
 * and invalid ARIA. Every case below is a route the site actually serves.
 */

const DRAWER_LINKS = DRAWER_GROUPS.flatMap((group) => [...group.links]);

describe('activeSectionId', () => {
  it('names no section on a page outside the navigation', () => {
    expect(activeSectionId('/')).toBeNull();
    expect(activeSectionId('/about')).toBeNull();
    expect(activeSectionId('/track')).toBeNull();
  });

  it('matches a section on its own index route', () => {
    expect(activeSectionId('/vendors')).toBe('vendors');
    expect(activeSectionId('/categories')).toBe('all-categories');
    expect(activeSectionId('/categories/photography')).toBe('photography');
  });

  it('picks the specific section, not the /categories catch-all', () => {
    expect(activeSectionId('/categories/venues')).toBe('venues');
    expect(activeSectionId('/categories/catering')).toBe('catering');
  });

  it('credits a subcategory page to the section that carries it', () => {
    expect(activeSectionId('/categories/banquet-halls')).toBe('venues');
    expect(activeSectionId('/categories/live-food-stations')).toBe('catering');
  });

  it('falls back to the catch-all for a branch with no header section', () => {
    /* Beauty & Styling is a real category with a real route, but it is not one of
       the four branches the header carries — the catch-all's rail lists it. */
    expect(activeSectionId('/categories/beauty')).toBe('all-categories');
  });

  it('falls back to the catch-all for a subcategory of an unlisted branch', () => {
    /* Nothing more specific claims it, so `/categories` does — by its own route
       prefix, not by the rail. */
    expect(activeSectionId('/categories/makeup-artists')).toBe('all-categories');
  });

  it('keeps a detail page inside the section it belongs to', () => {
    expect(activeSectionId('/vendors/the-sandalwood-grand')).toBe('vendors');
    expect(activeSectionId('/vendors/the-sandalwood-grand/reviews')).toBe('vendors');
  });

  it('names nothing for a page no section carries', () => {
    expect(activeSectionId('/cities/mumbai')).toBeNull();
    expect(activeSectionId('/partner-with-us')).toBeNull();
    expect(activeSectionId('/account/enquiries')).toBeNull();
  });

  it('never names more than one section for any route it is asked about', () => {
    const routes = [
      '/',
      '/vendors',
      '/categories',
      ...NAV_SECTIONS.map((section) => section.href),
      ...NAV_SECTIONS.flatMap((section) => (section.panel?.rail ?? []).map((row) => row.href)),
    ];

    for (const route of routes) {
      const id = activeSectionId(route);
      const matches = NAV_SECTIONS.filter((section) => section.id === id);
      expect(matches).toHaveLength(id === null ? 0 : 1);
    }
  });
});

describe('currentNavHref', () => {
  it('names no link on a page the drawer does not carry', () => {
    expect(currentNavHref('/', DRAWER_LINKS)).toBeNull();
    expect(currentNavHref('/cities/mumbai', DRAWER_LINKS)).toBeNull();
    expect(currentNavHref('/account/enquiries', DRAWER_LINKS)).toBeNull();
  });

  it('names the link whose route is the page', () => {
    expect(currentNavHref('/about', DRAWER_LINKS)).toBe('/about');
    expect(currentNavHref('/partner-with-us', DRAWER_LINKS)).toBe('/partner-with-us');
  });

  it('picks one winner where a plain route and a filter share a path', () => {
    /* `/vendors` and `/vendors?verified=true` are the same pathname, so the
       drawer must not mark "All vendors" and "Top picks" both current. */
    expect(currentNavHref('/vendors', DRAWER_LINKS)).toBe('/vendors');
  });

  it('picks the more specific of two overlapping routes', () => {
    expect(currentNavHref('/categories/venues', DRAWER_LINKS)).toBe('/categories/venues');
  });

  it('agrees with the header about a child route', () => {
    /* The drawer renders the sections without their panels, but "Banquet Halls"
       belongs to Venues, not to the "All categories" catch-all. */
    expect(currentNavHref('/categories/banquet-halls', DRAWER_LINKS)).toBe('/categories/venues');
    expect(currentNavHref('/categories/makeup-artists', DRAWER_LINKS)).toBe('/categories');
  });

  it('keeps a query-only variant addressable when it is the only route', () => {
    expect(
      currentNavHref('/vendors', [{ href: '/vendors?verified=true', label: 'Top picks' }]),
    ).toBe('/vendors?verified=true');
  });
});
