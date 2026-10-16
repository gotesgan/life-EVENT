/**
 * Site navigation, in one place.
 *
 * These are real, seeded categories and real routes. The header's dropdowns,
 * the mobile drawer and the footer all read from this file, so a link can never
 * exist in one surface and 404 in another.
 *
 * ## Shape
 *
 * A **section** is one top-level header item. Sections with a `panel` open a
 * dropdown built from two parts:
 *
 *   - a **rail** (the side menu) — the rows of a category, listed down the left
 *     of the panel; and
 *   - a **content pane** that swaps as the pointer moves down the rail, showing
 *     that row's links.
 *
 * The pane's links are the city cuts of the highlighted row — `cityCuts()`. That
 * is the question a visitor asks next ("which caterers, in which city"), and it
 * keeps every panel link a real directory filter rather than a decorative
 * shortcut.
 *
 * ## Why this is static
 *
 * The nav ships inside the server-rendered header: no fetch, no spinner, no
 * layout shift. Every slug below is verified against `prisma/seed-data`
 * (`categories.ts`, `locations.ts`), and the filters it links to
 * (`/vendors?category=…&location=…`, `/vendors?verified=true`) are the same
 * contract `searchQuerySchema` validates. A curated list is deliberate — the
 * seed has more categories than a clean header should carry.
 */

export interface NavLink {
  href: string;
  label: string;
}

/** One row of a panel's left rail — the side menu beside the dropdown. */
export interface NavRailItem {
  href: string;
  label: string;
  /** Muted line shown in the content pane while this row is active. */
  description: string;
  /** Links revealed in the content pane. */
  links: readonly NavLink[];
}

export interface NavPanel {
  /** Small heading above the rail, e.g. "Categories". */
  railHeading: string;
  rail: readonly NavRailItem[];
  /** Pinned under the pane and always visible, whatever row is active. */
  quickLinks: readonly NavLink[];
}

export interface NavSection {
  id: string;
  label: string;
  href: string;
  /** Absent for a plain link that navigates immediately. */
  panel?: NavPanel;
}

/* -------------------------------------------------------------------------- */
/* Structure                                                                   */
/* -------------------------------------------------------------------------- */

/** Cities with a live landing page (`/cities/<slug>`). Verified against `locations.ts`. */
const CITIES = [
  { slug: 'mumbai', label: 'Mumbai' },
  { slug: 'pune', label: 'Pune' },
  { slug: 'new-delhi', label: 'New Delhi' },
  { slug: 'bengaluru', label: 'Bengaluru' },
  { slug: 'jaipur', label: 'Jaipur' },
] as const;

interface CategoryBranch {
  slug: string;
  label: string;
  description: string;
  children: readonly { slug: string; label: string; description: string }[];
}

/** The categories a header can carry. Slugs are top-level, children are real subcategories. */
const CATEGORY_BRANCHES: readonly CategoryBranch[] = [
  {
    slug: 'venues',
    label: 'Venues',
    description: 'Banquet halls, hotels, resorts, lawns and farmhouses.',
    children: [
      {
        slug: 'banquet-halls',
        label: 'Banquet Halls',
        description: 'Indoor, air-conditioned halls with in-house catering.',
      },
      {
        slug: 'hotels-and-resorts',
        label: 'Hotels & Resorts',
        description: 'Hotels and resorts with rooms for outstation guests.',
      },
      {
        slug: 'lawns-and-farmhouses',
        label: 'Lawns & Farmhouses',
        description: 'Open-air lawns and farmhouse venues.',
      },
    ],
  },
  {
    slug: 'photography',
    label: 'Photography & Film',
    description: 'Photographers and videographers for every event day.',
    children: [
      {
        slug: 'photographers',
        label: 'Photographers',
        description: 'Candid and traditional event photography.',
      },
      {
        slug: 'videographers',
        label: 'Videographers',
        description: 'Highlight films and full-length event films.',
      },
    ],
  },
  {
    slug: 'planning-and-decor',
    label: 'Planning & Decor',
    description: 'Wedding planners, decorators and florists.',
    children: [
      {
        slug: 'wedding-planners',
        label: 'Wedding Planners',
        description: 'Full planning, partial planning and day coordination.',
      },
      {
        slug: 'decorators-and-florists',
        label: 'Decorators & Florists',
        description: 'Stage, mandap and floral design.',
      },
    ],
  },
  {
    slug: 'catering',
    label: 'Catering',
    description: 'Caterers and live food stations.',
    children: [
      {
        slug: 'caterers',
        label: 'Caterers',
        description: 'Multi-cuisine catering for weddings and receptions.',
      },
      {
        slug: 'live-food-stations',
        label: 'Live Food Stations',
        description: 'Live counters and interactive food stations.',
      },
    ],
  },
  {
    slug: 'beauty',
    label: 'Beauty & Styling',
    description: 'Makeup artists and hair stylists.',
    children: [
      {
        slug: 'makeup-artists',
        label: 'Makeup Artists',
        description: 'Bridal, engagement and party makeup.',
      },
      {
        slug: 'hair-stylists',
        label: 'Hair Stylists',
        description: 'Event hair styling and draping.',
      },
    ],
  },
  {
    slug: 'entertainment',
    label: 'Entertainment',
    description: 'DJs, live bands and performers.',
    children: [
      { slug: 'djs', label: 'DJs', description: 'DJs with sound and lighting setups.' },
      {
        slug: 'live-bands',
        label: 'Live Bands',
        description: 'Live bands, instrumentalists and anchors.',
      },
    ],
  },
  {
    slug: 'invitations-and-gifts',
    label: 'Invitations & Gifts',
    description: 'Invitation designers and gift hampers.',
    children: [
      {
        slug: 'invitation-designers',
        label: 'Invitation Designers',
        description: 'Letterpress, foil and digital invitations.',
      },
      {
        slug: 'gift-hampers',
        label: 'Gift Hampers',
        description: 'Curated welcome gifts and hampers.',
      },
    ],
  },
  {
    slug: 'rentals-and-transport',
    label: 'Rentals & Transport',
    description: 'Furniture rentals and luxury car rentals.',
    children: [
      {
        slug: 'furniture-rentals',
        label: 'Furniture Rentals',
        description: 'Chairs, tables, lounges and staging.',
      },
      {
        slug: 'luxury-car-rentals',
        label: 'Luxury Car Rentals',
        description: 'Chauffeured luxury cars for the wedding party.',
      },
    ],
  },
];

/** The city cuts of one category: the unfiltered view first, then each city. */
function cityCuts(categorySlug: string): NavLink[] {
  return [
    { href: `/vendors?category=${categorySlug}`, label: 'Anywhere in India' },
    ...CITIES.map((city) => ({
      href: `/vendors?category=${categorySlug}&location=${city.slug}`,
      label: city.label,
    })),
  ];
}

/**
 * The four categories a clean header can carry. The rest stay reachable through
 * "All categories" — a header is not a sitemap.
 */
const HEADER_BRANCH_SLUGS = ['venues', 'photography', 'planning-and-decor', 'catering'] as const;

function branchBySlug(slug: string): CategoryBranch {
  const branch = CATEGORY_BRANCHES.find((item) => item.slug === slug);
  if (!branch) throw new Error(`Unknown nav category: ${slug}`);
  return branch;
}

/** A category section: rail = the branch and its children, pane = each row's city cuts. */
function categorySection(branch: CategoryBranch): NavSection {
  return {
    id: branch.slug,
    label: branch.label,
    href: `/categories/${branch.slug}`,
    panel: {
      railHeading: branch.label,
      rail: [
        {
          href: `/categories/${branch.slug}`,
          label: `All ${branch.label.toLowerCase()}`,
          description: branch.description,
          links: cityCuts(branch.slug),
        },
        ...branch.children.map((child) => ({
          href: `/categories/${child.slug}`,
          label: child.label,
          description: child.description,
          links: cityCuts(child.slug),
        })),
      ],
      quickLinks: [
        { href: `/categories/${branch.slug}`, label: `Browse all ${branch.label.toLowerCase()}` },
        { href: `/vendors?category=${branch.slug}&verified=true`, label: 'Top picks' },
      ],
    },
  };
}

/** Primary header navigation — browse surfaces, not marketing pages. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'vendors',
    label: 'All vendors',
    href: '/vendors',
    panel: {
      railHeading: 'Browse',
      rail: [
        {
          href: '/vendors',
          label: 'Every vendor',
          description: 'The whole catalogue — prices and capacity on each listing.',
          links: [
            { href: '/vendors', label: 'Browse all vendors' },
            { href: '/vendors?sort=newest', label: 'Recently added' },
            { href: '/vendors?verified=true', label: 'Top picks' },
          ],
        },
        {
          href: '/vendors?verified=true',
          label: 'Top picks',
          description: 'Listings the team has highlighted for this season.',
          links: [
            { href: '/vendors?verified=true', label: 'All top picks' },
            ...CATEGORY_BRANCHES.map((branch) => ({
              href: `/vendors?category=${branch.slug}&verified=true`,
              label: `Top picks in ${branch.label}`,
            })),
          ],
        },
        {
          href: '/vendors',
          label: 'By city',
          description: 'Start from where the wedding is, then narrow by category.',
          links: CITIES.map((city) => ({
            href: `/vendors?location=${city.slug}`,
            label: city.label,
          })),
        },
      ],
      quickLinks: [
        { href: '/enquire', label: 'Send an enquiry' },
        { href: '/track', label: 'Track an enquiry' },
      ],
    },
  },
  ...HEADER_BRANCH_SLUGS.map((slug) => categorySection(branchBySlug(slug))),
  {
    id: 'all-categories',
    label: 'All categories',
    href: '/categories',
    panel: {
      railHeading: 'Categories',
      rail: CATEGORY_BRANCHES.map((branch) => ({
        href: `/categories/${branch.slug}`,
        label: branch.label,
        description: branch.description,
        links: [
          { href: `/categories/${branch.slug}`, label: `All ${branch.label.toLowerCase()}` },
          ...branch.children.map((child) => ({
            href: `/categories/${child.slug}`,
            label: child.label,
          })),
          { href: `/vendors?category=${branch.slug}`, label: 'See vendors' },
        ],
      })),
      quickLinks: [
        { href: '/categories', label: 'Every category' },
        { href: '/vendors?verified=true', label: 'Top picks' },
      ],
    },
  },
];

/**
 * Flat view of the sections, for surfaces that cannot render a panel — the
 * mobile drawer today. Kept derived so the two can never drift.
 */
export const PRIMARY_NAV: readonly NavLink[] = NAV_SECTIONS.map(({ href, label }) => ({
  href,
  label,
}));

/* -------------------------------------------------------------------------- */
/* Current-page matching                                                       */
/* -------------------------------------------------------------------------- */

/** Strips the query: `/vendors?verified=true` is the `/vendors` route. */
function pathOf(href: string): string {
  return href.split('?')[0];
}

/** True when `pathname` is `href`'s route, or sits underneath it. */
function matchesPath(pathname: string, href: string): boolean {
  const path = pathOf(href);
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The length of the longest route in `hrefs` that `pathname` sits under, or `0`.
 *
 * Which route *wins* is a question of specificity, and this is the score: the
 * longest match is the most specific one. `/categories/venues` matches both
 * `/categories/venues` and the `/categories` catch-all; scoring by length is
 * what stops both surfaces lighting up and leaving two `aria-current="page"`
 * links on one page.
 */
function matchLength(pathname: string, hrefs: readonly string[]): number {
  let longest = 0;

  for (const href of hrefs) {
    if (matchesPath(pathname, href)) longest = Math.max(longest, pathOf(href).length);
  }

  return longest;
}

/**
 * The routes a section stands for: its own, plus every route on its rail.
 *
 * The panes' directory filters (`/vendors?category=…`) are deliberately *not*
 * claims. They belong to the directory, and counting them would let a category
 * section claim "All vendors".
 */
function sectionClaims(section: NavSection): string[] {
  return [section.href, ...(section.panel?.rail ?? []).map((row) => row.href)];
}

/**
 * The single header section that owns `pathname`.
 *
 * A section is scored by its most specific matching claim, so a child route like
 * `/categories/banquet-halls` credits "Venues" (whose rail lists it) rather than
 * the "All categories" catch-all. A tie keeps the earlier section, which is what
 * makes "Venues" beat "All categories" on `/categories/venues`.
 */
export function activeSectionId(pathname: string): string | null {
  let bestId: string | null = null;
  let bestLength = 0;

  for (const section of NAV_SECTIONS) {
    const length = matchLength(pathname, sectionClaims(section));
    if (length > bestLength) {
      bestId = section.id;
      bestLength = length;
    }
  }

  return bestId;
}

/**
 * The one link in `links` that owns `pathname`.
 *
 * For surfaces that render the same destinations without their panels — the
 * mobile drawer. A link that is a section is scored through that section's
 * claims, so the drawer agrees with the header about child routes, and everything
 * else is scored on its own route. The winning *href* is returned rather than the
 * route, so query-only variants stay distinguishable: on `/vendors` both "All
 * vendors" and "Top picks" are the `/vendors` route, the scores tie, and the
 * earlier row wins.
 */
export function currentNavHref(pathname: string, links: readonly NavLink[]): string | null {
  let bestHref: string | null = null;
  let bestScore = 0;

  for (const link of links) {
    const section = NAV_SECTIONS.find((candidate) => candidate.href === link.href);
    const score = matchLength(pathname, section ? sectionClaims(section) : [link.href]);

    if (score > bestScore) {
      bestHref = link.href;
      bestScore = score;
    }
  }

  return bestHref;
}

/**
 * Every top-level category, flat. The footer and the mobile drawer both read
 * this, so a category can be edited in one place and appear in both.
 */
export const CATEGORY_LINKS: readonly NavLink[] = CATEGORY_BRANCHES.map((branch) => ({
  href: `/categories/${branch.slug}`,
  label: branch.label,
}));

/** Category columns in the footer. Real slugs from the catalogue. */
export const FOOTER_CATEGORIES: readonly NavLink[] = CATEGORY_LINKS;

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

/**
 * The mobile drawer's groups, in full.
 *
 * The drawer has no panels, so its grouping is explicit rather than derived —
 * and deliberately non-overlapping: "Browse" carries the six header sections,
 * and the footer's company links are trimmed to the two that are not already in
 * "Quick actions". Thirteen rows and four labels, no link repeated.
 */
export const DRAWER_GROUPS: readonly { label: string; links: readonly NavLink[] }[] = [
  { label: 'Browse', links: PRIMARY_NAV },
  {
    label: 'Quick actions',
    links: [
      { href: '/vendors?verified=true', label: 'Top picks' },
      { href: '/enquire', label: 'Send an enquiry' },
      { href: '/track', label: 'Track an enquiry' },
    ],
  },
  {
    label: 'Live Envt',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  { label: 'Legal', links: FOOTER_LEGAL },
];
