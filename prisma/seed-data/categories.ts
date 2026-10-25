/**
 * Category tree for the seed.
 *
 * `path` is the materialised slug path (top level: just the slug) and
 * `familySlug` points at the top-level category a subcategory belongs to — the
 * seed uses the family to pick the placeholder motif and the shared attribute
 * group.
 */

export interface CategorySeed {
  slug: string;
  name: string;
  parentSlug: string | null;
  path: string;
  familySlug: string;
  shortDescription: string;
  iconKey: string;
  sortOrder: number;
}

interface TopLevelCategorySeed {
  slug: string;
  name: string;
  shortDescription: string;
  iconKey: string;
  sortOrder: number;
}

interface SubcategorySeed {
  slug: string;
  name: string;
  parentSlug: string;
  shortDescription: string;
  iconKey: string;
  sortOrder: number;
}

const TOP_LEVEL: readonly TopLevelCategorySeed[] = [
  {
    slug: 'venues',
    name: 'Venues',
    shortDescription: 'Banquet halls, hotels, resorts, lawns and farmhouses.',
    iconKey: 'building-arch',
    sortOrder: 10,
  },
  {
    slug: 'photography',
    name: 'Photography & Film',
    shortDescription: 'Photographers and videographers for every event day.',
    iconKey: 'camera',
    sortOrder: 20,
  },
  {
    slug: 'planning-and-decor',
    name: 'Planning & Decor',
    shortDescription: 'Wedding planners, decorators and florists.',
    iconKey: 'clipboard-heart',
    sortOrder: 30,
  },
  {
    slug: 'catering',
    name: 'Catering',
    shortDescription: 'Caterers and live food stations.',
    iconKey: 'tools-kitchen',
    sortOrder: 40,
  },
  {
    slug: 'beauty',
    name: 'Beauty & Styling',
    shortDescription: 'Makeup artists and hair stylists.',
    iconKey: 'sparkles',
    sortOrder: 50,
  },
  {
    slug: 'entertainment',
    name: 'Entertainment',
    shortDescription: 'DJs, live bands and performers.',
    iconKey: 'music',
    sortOrder: 60,
  },
  {
    slug: 'invitations-and-gifts',
    name: 'Invitations & Gifts',
    shortDescription: 'Invitation designers and gift hampers.',
    iconKey: 'mail',
    sortOrder: 70,
  },
  {
    slug: 'rentals-and-transport',
    name: 'Rentals & Transport',
    shortDescription: 'Furniture rentals and luxury car rentals.',
    iconKey: 'car',
    sortOrder: 80,
  },
  {
    slug: 'corporate-events',
    name: 'Corporate Events',
    shortDescription: 'Venues, catering, AV and offsites for conferences, launches and team days.',
    iconKey: 'briefcase',
    sortOrder: 90,
  },
];

const SUBCATEGORIES: readonly SubcategorySeed[] = [
  {
    slug: 'banquet-halls',
    name: 'Banquet Halls',
    parentSlug: 'venues',
    shortDescription: 'Indoor, air-conditioned halls with in-house catering.',
    iconKey: 'building',
    sortOrder: 10,
  },
  {
    slug: 'hotels-and-resorts',
    name: 'Hotels & Resorts',
    parentSlug: 'venues',
    shortDescription: 'Hotels and resorts with rooms for outstation guests.',
    iconKey: 'bed',
    sortOrder: 20,
  },
  {
    slug: 'lawns-and-farmhouses',
    name: 'Lawns & Farmhouses',
    parentSlug: 'venues',
    shortDescription: 'Open-air lawns and farmhouse venues.',
    iconKey: 'trees',
    sortOrder: 30,
  },
  {
    slug: 'photographers',
    name: 'Photographers',
    parentSlug: 'photography',
    shortDescription: 'Candid and traditional event photography.',
    iconKey: 'camera',
    sortOrder: 10,
  },
  {
    slug: 'videographers',
    name: 'Videographers',
    parentSlug: 'photography',
    shortDescription: 'Highlight films and full-length event films.',
    iconKey: 'video',
    sortOrder: 20,
  },
  {
    slug: 'wedding-planners',
    name: 'Wedding Planners',
    parentSlug: 'planning-and-decor',
    shortDescription: 'Full planning, partial planning and day coordination.',
    iconKey: 'clipboard-list',
    sortOrder: 10,
  },
  {
    slug: 'decorators-and-florists',
    name: 'Decorators & Florists',
    parentSlug: 'planning-and-decor',
    shortDescription: 'Stage, mandap and floral design.',
    iconKey: 'flower',
    sortOrder: 20,
  },
  {
    slug: 'caterers',
    name: 'Caterers',
    parentSlug: 'catering',
    shortDescription: 'Multi-cuisine catering for weddings and receptions.',
    iconKey: 'tools-kitchen-2',
    sortOrder: 10,
  },
  {
    slug: 'live-food-stations',
    name: 'Live Food Stations',
    parentSlug: 'catering',
    shortDescription: 'Live counters and interactive food stations.',
    iconKey: 'flame',
    sortOrder: 20,
  },
  {
    slug: 'makeup-artists',
    name: 'Makeup Artists',
    parentSlug: 'beauty',
    shortDescription: 'Bridal, engagement and party makeup.',
    iconKey: 'brush',
    sortOrder: 10,
  },
  {
    slug: 'hair-stylists',
    name: 'Hair Stylists',
    parentSlug: 'beauty',
    shortDescription: 'Event hair styling and draping.',
    iconKey: 'scissors',
    sortOrder: 20,
  },
  {
    slug: 'djs',
    name: 'DJs',
    parentSlug: 'entertainment',
    shortDescription: 'DJs with sound and lighting setups.',
    iconKey: 'headphones',
    sortOrder: 10,
  },
  {
    slug: 'live-bands',
    name: 'Live Bands',
    parentSlug: 'entertainment',
    shortDescription: 'Live bands, instrumentalists and anchors.',
    iconKey: 'music',
    sortOrder: 20,
  },
  {
    slug: 'invitation-designers',
    name: 'Invitation Designers',
    parentSlug: 'invitations-and-gifts',
    shortDescription: 'Letterpress, foil and digital invitations.',
    iconKey: 'mail',
    sortOrder: 10,
  },
  {
    slug: 'gift-hampers',
    name: 'Gift Hampers',
    parentSlug: 'invitations-and-gifts',
    shortDescription: 'Curated welcome gifts and hampers.',
    iconKey: 'gift',
    sortOrder: 20,
  },
  {
    slug: 'furniture-rentals',
    name: 'Furniture Rentals',
    parentSlug: 'rentals-and-transport',
    shortDescription: 'Chairs, tables, lounges and staging.',
    iconKey: 'sofa',
    sortOrder: 10,
  },
  {
    slug: 'luxury-car-rentals',
    name: 'Luxury Car Rentals',
    parentSlug: 'rentals-and-transport',
    shortDescription: 'Chauffeured luxury cars for the wedding party.',
    iconKey: 'car',
    sortOrder: 20,
  },
  {
    slug: 'corporate-venues',
    name: 'Corporate Venues',
    parentSlug: 'corporate-events',
    shortDescription: 'Conference centres, business hotels and auditoriums with AV on site.',
    iconKey: 'briefcase',
    sortOrder: 10,
  },
  {
    slug: 'conference-and-av',
    name: 'Conference & AV',
    parentSlug: 'corporate-events',
    shortDescription: 'Staging, sound, projection and hybrid-meeting production.',
    iconKey: 'speakerphone',
    sortOrder: 20,
  },
  {
    slug: 'corporate-catering',
    name: 'Corporate Catering',
    parentSlug: 'corporate-events',
    shortDescription: 'Board lunches, conference catering and office celebration menus.',
    iconKey: 'tools-kitchen',
    sortOrder: 30,
  },
  {
    slug: 'team-offsites',
    name: 'Team Offsites',
    parentSlug: 'corporate-events',
    shortDescription: 'Resort and estate stays for offsites, retreats and team days.',
    iconKey: 'trees',
    sortOrder: 40,
  },
];

export interface EventTypeSeed {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
}

export const EVENT_TYPE_SEEDS: readonly EventTypeSeed[] = [
  {
    slug: 'wedding',
    name: 'Wedding',
    description: 'The main ceremony and its surrounding functions.',
    iconKey: 'rings',
    sortOrder: 10,
  },
  {
    slug: 'engagement',
    name: 'Engagement',
    description: 'Ring ceremony and engagement parties.',
    iconKey: 'rings',
    sortOrder: 20,
  },
  {
    slug: 'reception',
    name: 'Reception',
    description: 'Post-wedding reception dinners.',
    iconKey: 'glass',
    sortOrder: 30,
  },
  {
    slug: 'sangeet-and-mehndi',
    name: 'Sangeet & Mehndi',
    description: 'Music, dance and mehndi functions.',
    iconKey: 'music',
    sortOrder: 40,
  },
  {
    slug: 'birthday',
    name: 'Birthday',
    description: 'Birthday parties for children and adults.',
    iconKey: 'cake',
    sortOrder: 50,
  },
  {
    slug: 'anniversary',
    name: 'Anniversary',
    description: 'Anniversary dinners and celebrations.',
    iconKey: 'sparkles',
    sortOrder: 60,
  },
  {
    slug: 'corporate-event',
    name: 'Corporate Event',
    description: 'Conferences, offsites and award nights.',
    iconKey: 'briefcase',
    sortOrder: 70,
  },
  {
    slug: 'baby-shower',
    name: 'Baby Shower',
    description: 'Baby showers and naming ceremonies.',
    iconKey: 'gift',
    sortOrder: 80,
  },
  {
    slug: 'housewarming',
    name: 'Housewarming',
    description: 'Griha pravesh and housewarming ceremonies.',
    iconKey: 'home',
    sortOrder: 90,
  },
];

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  ...TOP_LEVEL.map((category) => ({
    ...category,
    parentSlug: null,
    path: category.slug,
    familySlug: category.slug,
  })),
  ...SUBCATEGORIES.map((category) => ({
    ...category,
    path: `${category.parentSlug}/${category.slug}`,
    familySlug: category.parentSlug,
  })),
];

const CATEGORY_BY_SLUG = new Map(CATEGORY_SEEDS.map((category) => [category.slug, category]));

export function findCategorySeed(slug: string): CategorySeed {
  const category = CATEGORY_BY_SLUG.get(slug);
  if (!category) throw new Error(`Unknown category slug in seed data: ${slug}`);
  return category;
}
