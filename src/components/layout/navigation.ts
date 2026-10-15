/**
 * Site navigation, in one place.
 *
 * These are real, seeded top-level categories and real routes. The footer and
 * the mobile drawer reuse the same list, so a link can never exist in one
 * surface and 404 in another.
 */
export interface NavLink {
  href: string;
  label: string;
}

/** Primary header navigation — browse surfaces, not marketing pages. */
export const PRIMARY_NAV: readonly NavLink[] = [
  { href: '/vendors', label: 'All vendors' },
  { href: '/categories/venues', label: 'Venues' },
  { href: '/categories/photography', label: 'Photography & Film' },
  { href: '/categories/planning-and-decor', label: 'Planning & Decor' },
  { href: '/categories/catering', label: 'Catering' },
  { href: '/categories', label: 'All categories' },
];

/** Category columns in the footer. Real slugs from the catalogue. */
export const FOOTER_CATEGORIES: readonly NavLink[] = [
  { href: '/categories/venues', label: 'Venues' },
  { href: '/categories/photography', label: 'Photography & Film' },
  { href: '/categories/planning-and-decor', label: 'Planning & Decor' },
  { href: '/categories/catering', label: 'Catering' },
  { href: '/categories/beauty', label: 'Beauty & Styling' },
  { href: '/categories/entertainment', label: 'Entertainment' },
  { href: '/categories/invitations-and-gifts', label: 'Invitations & Gifts' },
  { href: '/categories/rentals-and-transport', label: 'Rentals & Transport' },
];

export const FOOTER_COMPANY: readonly NavLink[] = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/enquire', label: 'Send an enquiry' },
  { href: '/track', label: 'Track an enquiry' },
];

export const FOOTER_LEGAL: readonly NavLink[] = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];
