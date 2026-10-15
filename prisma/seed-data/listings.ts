/**
 * Business listing seed data.
 *
 * Every listing is invented. Names, addresses, phone numbers, emails and
 * websites are obviously fictional (`@example.test`, `+91 90000 0000x`,
 * `https://example.test/...`) so nothing here can be mistaken for a real
 * business or a real person.
 *
 * `searchText` is not stored here — the seed composes it from the resolved
 * names, so it can never drift from the rows it describes.
 */

import type { PriceUnit, PublicationStatus, VerificationStatus } from '@/generated/prisma/enums';

export interface ListingServiceSeed {
  name: string;
  description: string;
  priceFrom: number | null;
  priceTo: number | null;
  priceUnit: PriceUnit | null;
  durationMinutes: number | null;
  includes: readonly string[];
}

export interface ListingPackageSeed {
  name: string;
  description: string;
  price: number | null;
  priceUnit: PriceUnit | null;
  minGuests: number | null;
  maxGuests: number | null;
  inclusions: readonly string[];
  exclusions: readonly string[];
}

export interface VenueSpaceSeed {
  name: string;
  description: string;
  capacitySeated: number | null;
  capacityStanding: number | null;
  areaSqft: number | null;
  isIndoor: boolean;
  isOutdoor: boolean;
  layoutOptions: readonly string[];
}

/** One typed value; the data type is resolved from the attribute definition. */
export interface ListingAttributeValueSeed {
  code: string;
  number?: number;
  boolean?: boolean;
  optionValue?: string;
  optionValues?: readonly string[];
}

export const num = (code: string, value: number): ListingAttributeValueSeed => ({
  code,
  number: value,
});

export const bool = (code: string, value: boolean): ListingAttributeValueSeed => ({
  code,
  boolean: value,
});

export const one = (code: string, optionValue: string): ListingAttributeValueSeed => ({
  code,
  optionValue,
});

export const many = (code: string, optionValues: readonly string[]): ListingAttributeValueSeed => ({
  code,
  optionValues,
});

export interface ListingSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  about: string;
  primaryCategorySlug: string;
  secondaryCategorySlugs: readonly string[];
  primaryLocationSlug: string;
  serviceAreaSlugs: readonly string[];
  eventTypeSlugs: readonly string[];
  publicationStatus: PublicationStatus;
  verificationStatus: VerificationStatus;
  isFeatured: boolean;
  publishedAt: string | null;
  contactPersonName: string;
  contactPhone: string;
  contactEmail: string;
  contactWhatsapp: string;
  websiteUrl: string;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  latitude: number;
  longitude: number;
  priceMin: number;
  priceMax: number;
  priceUnit: PriceUnit;
  capacityMin: number | null;
  capacityMax: number | null;
  amenityCodes: readonly string[];
  services: readonly ListingServiceSeed[];
  packages: readonly ListingPackageSeed[];
  venueSpaces: readonly VenueSpaceSeed[];
  attributes: readonly ListingAttributeValueSeed[];
  galleryCount: number;
  createdByAdmin: boolean;
}

type ListingInput = Omit<
  ListingSeed,
  | 'secondaryCategorySlugs'
  | 'serviceAreaSlugs'
  | 'eventTypeSlugs'
  | 'publicationStatus'
  | 'verificationStatus'
  | 'isFeatured'
  | 'publishedAt'
  | 'showPhone'
  | 'showEmail'
  | 'showWhatsapp'
  | 'showWebsite'
  | 'contactEmail'
  | 'contactPhone'
  | 'contactWhatsapp'
  | 'websiteUrl'
  | 'addressLine2'
  | 'capacityMin'
  | 'capacityMax'
  | 'venueSpaces'
  | 'galleryCount'
  | 'createdByAdmin'
> & {
  secondaryCategorySlugs?: readonly string[];
  serviceAreaSlugs?: readonly string[];
  eventTypeSlugs?: readonly string[];
  publicationStatus?: PublicationStatus;
  verificationStatus?: VerificationStatus;
  isFeatured?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
  showWhatsapp?: boolean;
  showWebsite?: boolean;
  addressLine2?: string | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
  venueSpaces?: readonly VenueSpaceSeed[];
  galleryCount?: number;
  createdByAdmin?: boolean;
};

/** Fixed epoch so `publishedAt` is identical on every run. */
const PUBLISHED_BASE_MS = Date.UTC(2026, 4, 1, 6, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

let publishedSequence = 0;

function nextPublishedAt(): string {
  const publishedAt = new Date(PUBLISHED_BASE_MS + publishedSequence * 3 * DAY_MS);
  publishedSequence += 1;
  return publishedAt.toISOString();
}

let contactSequence = 0;

function defineListing(input: ListingInput): ListingSeed {
  const index = contactSequence;
  contactSequence += 1;

  const publicationStatus = input.publicationStatus ?? 'PUBLISHED';
  const phone = `+91 90000 000${String(index + 1).padStart(2, '0')}`;

  return {
    ...input,
    secondaryCategorySlugs: input.secondaryCategorySlugs ?? [],
    serviceAreaSlugs: input.serviceAreaSlugs ?? [input.primaryLocationSlug],
    eventTypeSlugs: input.eventTypeSlugs ?? ['wedding', 'reception'],
    publicationStatus,
    verificationStatus: input.verificationStatus ?? 'PENDING',
    isFeatured: input.isFeatured ?? false,
    publishedAt: publicationStatus === 'PUBLISHED' ? nextPublishedAt() : null,
    contactEmail: `hello@${input.slug}.example.test`,
    contactPhone: phone,
    contactWhatsapp: phone,
    websiteUrl: `https://example.test/${input.slug}`,
    showPhone: input.showPhone ?? true,
    showEmail: input.showEmail ?? false,
    showWhatsapp: input.showWhatsapp ?? false,
    showWebsite: input.showWebsite ?? true,
    addressLine2: input.addressLine2 ?? null,
    capacityMin: input.capacityMin ?? null,
    capacityMax: input.capacityMax ?? null,
    venueSpaces: input.venueSpaces ?? [],
    galleryCount: input.galleryCount ?? 0,
    createdByAdmin: input.createdByAdmin ?? true,
  };
}

export const LISTING_SEEDS: readonly ListingSeed[] = [
  // ---------------------------------------------------------------------
  // Venues
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'gulmohar-banjara-banquets',
    name: 'Gulmohar Banjara Banquets',
    tagline: 'A pillar-free hall in Andheri East that seats 900',
    description:
      'Gulmohar Banjara Banquets runs three pillar-free halls off the Andheri East arterial road, with a nine-metre stage and separate bridal suite. The property hosts one wedding at a time, so the lawns and lobby stay exclusive to your guests. In-house AV and generator backup are standard.',
    about:
      'A family-run banquet property, open since 2009, that has hosted over 600 weddings. The team keeps a small panel of empanelled caterers and works with outside decorators without a surcharge.',
    primaryCategorySlug: 'banquet-halls',
    secondaryCategorySlugs: ['venues'],
    primaryLocationSlug: 'andheri-east',
    eventTypeSlugs: ['wedding', 'reception', 'engagement', 'sangeet-and-mehndi', 'corporate-event'],
    verificationStatus: 'VERIFIED',
    isFeatured: true,
    showPhone: true,
    showEmail: true,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Rukmini Deshpande',
    addressLine1: 'Plot 14, Banjara Estate Road',
    addressLine2: 'Opposite Mittal Industrial Estate',
    postalCode: '400093',
    latitude: 19.1158,
    longitude: 72.8712,
    priceMin: 650000,
    priceMax: 1800000,
    priceUnit: 'PER_EVENT',
    capacityMin: 300,
    capacityMax: 900,
    amenityCodes: [
      'air-conditioned',
      'valet-parking',
      'stage',
      'av-system',
      'backup-power',
      'dance-floor',
      'bridal-suite',
      'wheelchair-access',
    ],
    services: [
      {
        name: 'Hall-only booking',
        description: 'Exclusive use of one hall with basic lighting and housekeeping.',
        priceFrom: 650000,
        priceTo: 950000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 480,
        includes: ['Exclusive hall access', 'Housekeeping', 'Basic lighting', 'Generator backup'],
      },
      {
        name: 'Full-property wedding',
        description: 'All three halls, the lawn and the lobby for a single multi-day wedding.',
        priceFrom: 1400000,
        priceTo: 1800000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 1440,
        includes: ['All halls and lawn', 'Bridal suite', 'Valet parking', 'Dedicated manager'],
      },
      {
        name: 'Corporate conference day',
        description: 'Theatre or cluster seating with AV support for up to 400 delegates.',
        priceFrom: 380000,
        priceTo: 520000,
        priceUnit: 'PER_DAY',
        durationMinutes: 600,
        includes: ['Projector and screen', 'Podium and mics', 'Two tea breaks', 'Delegate parking'],
      },
    ],
    packages: [
      {
        name: 'Silver reception',
        description: 'A single-evening reception for up to 500 guests.',
        price: 780000,
        priceUnit: 'PER_EVENT',
        minGuests: 250,
        maxGuests: 500,
        inclusions: ['Hall for six hours', 'Basic stage decor', 'Valet parking'],
        exclusions: ['Catering', 'Alcohol licence', 'External DJ'],
      },
      {
        name: 'Gold wedding weekend',
        description: 'Two-day use of the property including the lawn for the sangeet.',
        price: 1650000,
        priceUnit: 'PER_EVENT',
        minGuests: 500,
        maxGuests: 900,
        inclusions: ['Two-day access', 'Bridal suite', 'Lawn for sangeet', 'Dedicated coordinator'],
        exclusions: ['Catering', 'Decor', 'Photography'],
      },
    ],
    venueSpaces: [
      {
        name: 'Gulmohar Grand Hall',
        description: 'The largest pillar-free hall with a nine-metre stage.',
        capacitySeated: 900,
        capacityStanding: 1200,
        areaSqft: 14000,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Theatre', 'Round tables', 'Cluster'],
      },
      {
        name: 'Banjara Hall',
        description: 'Mid-size hall suited to receptions and sangeet nights.',
        capacitySeated: 450,
        capacityStanding: 600,
        areaSqft: 7200,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Round tables', 'Cocktail'],
      },
      {
        name: 'Mittal Room',
        description: 'Boardroom-style space used for mehndi and family functions.',
        capacitySeated: 120,
        capacityStanding: 180,
        areaSqft: 2100,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['U-shape', 'Cluster', 'Theatre'],
      },
      {
        name: 'Terrace Lawn',
        description: 'Open terrace used for cocktail hour and live counters.',
        capacitySeated: 200,
        capacityStanding: 350,
        areaSqft: 4600,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cocktail', 'Live counters'],
      },
    ],
    attributes: [
      num('guest_capacity', 900),
      many('venue_type', ['banquet-hall', 'convention-centre']),
      many('indoor_outdoor', ['indoor']),
      one('catering_policy', 'empanelled-caterers'),
      bool('accommodation', false),
      num('parking_capacity', 180),
      num('number_of_spaces', 3),
    ],
    galleryCount: 2,
  }),

  defineListing({
    slug: 'the-sandalwood-grand',
    name: 'The Sandalwood Grand',
    tagline: 'Five-star ballroom and rooftop above Juhu beach',
    description:
      'The Sandalwood Grand is a five-star hotel with a 1,200-guest ballroom, four smaller function rooms and a rooftop terrace facing the Arabian Sea. Rooms are held for wedding blocks, and the banquet kitchen is entirely in-house. The property is a short drive from Chhatrapati Shivaji Maharaj International Airport.',
    about:
      'Part of an invented hospitality group, the hotel runs a dedicated wedding desk that manages room blocks, menus and vendor access under one contract.',
    primaryCategorySlug: 'hotels-and-resorts',
    primaryLocationSlug: 'juhu',
    eventTypeSlugs: ['wedding', 'reception', 'engagement', 'corporate-event', 'anniversary'],
    verificationStatus: 'VERIFIED',
    isFeatured: true,
    showPhone: false,
    showEmail: true,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Vikram Nair',
    addressLine1: 'Sandalwood Boulevard, Juhu Tara Road',
    addressLine2: 'Near Juhu Beach',
    postalCode: '400049',
    latitude: 19.1016,
    longitude: 72.8266,
    priceMin: 1200000,
    priceMax: 4500000,
    priceUnit: 'PER_EVENT',
    capacityMin: 150,
    capacityMax: 1200,
    amenityCodes: [
      'air-conditioned',
      'valet-parking',
      'in-house-catering',
      'bridal-suite',
      'pool',
      'av-system',
      'bar-service',
      'wheelchair-access',
    ],
    services: [
      {
        name: 'Ballroom wedding',
        description: 'Sea-facing ballroom with a pre-function foyer and in-house catering.',
        priceFrom: 1800000,
        priceTo: 3200000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 480,
        includes: ['Ballroom and foyer', 'In-house catering', 'AV and lighting', 'Bridal suite'],
      },
      {
        name: 'Rooftop cocktail',
        description: 'Sunset cocktail on the rooftop terrace with a bar package.',
        priceFrom: 1200000,
        priceTo: 1900000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 300,
        includes: ['Rooftop terrace', 'Bar package', 'Canapés', 'Live music clearance'],
      },
      {
        name: 'Room block + venue',
        description: 'Guest rooms bundled with the function space for outstation families.',
        priceFrom: 2400000,
        priceTo: 4500000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: 1440,
        includes: ['60 guest rooms', 'Function space', 'Airport transfers', 'Breakfast'],
      },
    ],
    packages: [
      {
        name: 'Grand reception',
        description: 'Ballroom reception with a plated dinner for up to 800 guests.',
        price: 2600000,
        priceUnit: 'PER_EVENT',
        minGuests: 400,
        maxGuests: 800,
        inclusions: ['Ballroom for six hours', 'Plated dinner', 'Bridal suite', 'Valet parking'],
        exclusions: ['Alcohol', 'External decor', 'Photography'],
      },
      {
        name: 'Intimate anniversary',
        description: 'A 150-guest dinner in the Sandalwood Room.',
        price: 780000,
        priceUnit: 'PER_EVENT',
        minGuests: 80,
        maxGuests: 150,
        inclusions: ['Private dining room', 'Set menu', 'Cake stand', 'Background music'],
        exclusions: ['Florist', 'Live band'],
      },
      {
        name: 'Corporate offsite',
        description: 'Conference day with two breakout rooms and a working lunch.',
        price: 950000,
        priceUnit: 'PER_DAY',
        minGuests: 100,
        maxGuests: 400,
        inclusions: ['Main hall', 'Two breakouts', 'AV support', 'Working lunch'],
        exclusions: ['Accommodation', 'Dinner'],
      },
    ],
    venueSpaces: [
      {
        name: 'Sandalwood Ballroom',
        description: 'Column-free ballroom with a sea-facing foyer.',
        capacitySeated: 1200,
        capacityStanding: 1600,
        areaSqft: 18500,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Round tables', 'Theatre', 'Cocktail'],
      },
      {
        name: 'Seaview Room',
        description: 'Reception room with a private bar and balcony.',
        capacitySeated: 250,
        capacityStanding: 350,
        areaSqft: 4200,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Round tables', 'Cocktail'],
      },
      {
        name: 'Sandalwood Room',
        description: 'Intimate dining room for family functions.',
        capacitySeated: 150,
        capacityStanding: 200,
        areaSqft: 2800,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Round tables', 'U-shape'],
      },
      {
        name: 'Sky Terrace',
        description: 'Open rooftop with a retractable canopy for monsoon cover.',
        capacitySeated: 300,
        capacityStanding: 500,
        areaSqft: 6100,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cocktail', 'Live counters', 'Theatre'],
      },
      {
        name: 'Poolside Deck',
        description: 'Poolside deck used for mehndi brunches.',
        capacitySeated: 180,
        capacityStanding: 260,
        areaSqft: 3400,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cocktail', 'Cluster'],
      },
    ],
    attributes: [
      num('guest_capacity', 1200),
      many('venue_type', ['hotel', 'banquet-hall', 'rooftop']),
      many('indoor_outdoor', ['indoor', 'outdoor', 'both']),
      one('catering_policy', 'in-house-only'),
      bool('accommodation', true),
      num('parking_capacity', 320),
      num('number_of_spaces', 5),
    ],
    galleryCount: 2,
  }),

  defineListing({
    slug: 'tarang-resort-and-spa',
    name: 'Tarang Resort & Spa',
    tagline: 'Lakeside resort near Powai with 60 rooms and a pool deck',
    description:
      'Tarang Resort & Spa spreads across three acres beside Powai lake, with two lawns, a poolside deck and a covered pavilion for up to 1,500 guests. Sixty rooms stay available for wedding blocks. The resort allows outside caterers and works with a shortlist of preferred decorators.',
    about:
      'A weekend resort that rebuilt its banquet wing in 2018. The events team specialises in three-day destination weddings within the city.',
    primaryCategorySlug: 'hotels-and-resorts',
    primaryLocationSlug: 'powai',
    eventTypeSlugs: ['wedding', 'reception', 'sangeet-and-mehndi', 'birthday', 'anniversary'],
    verificationStatus: 'PENDING',
    showPhone: true,
    showEmail: false,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Farah Qureshi',
    addressLine1: 'Survey 42, Lakeview Approach Road',
    addressLine2: 'Powai',
    postalCode: '400076',
    latitude: 19.1197,
    longitude: 72.9051,
    priceMin: 900000,
    priceMax: 3200000,
    priceUnit: 'PER_EVENT',
    capacityMin: 200,
    capacityMax: 1500,
    amenityCodes: [
      'pool',
      'valet-parking',
      'in-house-catering',
      'backup-power',
      'pet-friendly',
      'stage',
      'dance-floor',
      'wheelchair-access',
    ],
    services: [
      {
        name: 'Lawn wedding',
        description: 'Both lawns combined with the pavilion as a weather backup.',
        priceFrom: 1400000,
        priceTo: 2600000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 600,
        includes: ['Both lawns', 'Pavilion backup', 'Poolside bar', 'Guest rooms at block rate'],
      },
      {
        name: 'Poolside sangeet',
        description: 'Evening sangeet around the pool deck with stage and lighting.',
        priceFrom: 900000,
        priceTo: 1500000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 360,
        includes: ['Pool deck', 'Stage and truss lighting', 'DJ console', 'Live counter space'],
      },
      {
        name: 'Corporate retreat',
        description: 'Two-day team retreat with meeting space and team activities.',
        priceFrom: 1600000,
        priceTo: 3200000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: 2880,
        includes: ['Meeting pavilion', '40 rooms', 'All meals', 'Team activities'],
      },
    ],
    packages: [
      {
        name: 'Lakeside wedding',
        description: 'Full-day lawn wedding for up to 800 guests.',
        price: 2100000,
        priceUnit: 'PER_EVENT',
        minGuests: 400,
        maxGuests: 800,
        inclusions: ['Lawn access', 'Pavilion backup', 'Guest rooms', 'Valet parking'],
        exclusions: ['Catering', 'Decor', 'Photography'],
      },
      {
        name: 'Mehndi brunch',
        description: 'Daytime poolside brunch for up to 250 guests.',
        price: 640000,
        priceUnit: 'PER_EVENT',
        minGuests: 100,
        maxGuests: 250,
        inclusions: ['Pool deck', 'Brunch menu', 'Shaded seating', 'Live music point'],
        exclusions: ['Alcohol', 'Floral decor'],
      },
    ],
    venueSpaces: [
      {
        name: 'Lakeview Lawn',
        description: 'The larger of the two lawns, with an unobstructed lake frontage.',
        capacitySeated: 1500,
        capacityStanding: 2000,
        areaSqft: 26000,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Round tables', 'Theatre', 'Cluster'],
      },
      {
        name: 'Garden Lawn',
        description: 'Smaller lawn beside the spa wing, used for mehndi.',
        capacitySeated: 400,
        capacityStanding: 600,
        areaSqft: 8800,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cluster', 'Cocktail'],
      },
      {
        name: 'The Pavilion',
        description: 'Covered, air-conditioned pavilion that doubles as monsoon backup.',
        capacitySeated: 700,
        capacityStanding: 900,
        areaSqft: 11000,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Round tables', 'Theatre'],
      },
      {
        name: 'Pool Deck',
        description: 'Poolside deck with a bar and live-counter bays.',
        capacitySeated: 250,
        capacityStanding: 400,
        areaSqft: 5200,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cocktail', 'Live counters'],
      },
      {
        name: 'Spa Courtyard',
        description: 'Quiet courtyard used for haldi and small ceremonies.',
        capacitySeated: 120,
        capacityStanding: 180,
        areaSqft: 2400,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cluster'],
      },
      {
        name: 'Boardroom 1',
        description: 'Meeting room for corporate retreats.',
        capacitySeated: 60,
        capacityStanding: 80,
        areaSqft: 1200,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['U-shape', 'Theatre'],
      },
    ],
    attributes: [
      num('guest_capacity', 1500),
      many('venue_type', ['resort', 'lawn', 'hotel']),
      many('indoor_outdoor', ['both', 'outdoor']),
      one('catering_policy', 'outside-catering-allowed'),
      bool('accommodation', true),
      num('parking_capacity', 240),
      num('number_of_spaces', 4),
    ],
  }),

  defineListing({
    slug: 'vaatika-lawns-and-farmhouse',
    name: 'Vaatika Lawns & Farmhouse',
    tagline: 'A four-acre farmhouse lawn on the Baner hills',
    description:
      'Vaatika Lawns & Farmhouse sits on four acres of managed garden above Baner, with an open lawn for 2,000 guests and a stone farmhouse used as the bridal suite. The property is booked for a single wedding at a time and permits outside catering and decor. A heritage bungalow on site hosts mehndi and haldi.',
    about:
      'Originally a family farm, Vaatika opened for weddings in 2015 and now runs a full-time events crew of twelve.',
    primaryCategorySlug: 'lawns-and-farmhouses',
    primaryLocationSlug: 'baner',
    eventTypeSlugs: ['wedding', 'reception', 'sangeet-and-mehndi', 'housewarming'],
    verificationStatus: 'UNVERIFIED',
    showPhone: false,
    showEmail: false,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Girish Kulkarni',
    addressLine1: 'Vaatika Farm, Baner Hill Road',
    addressLine2: 'Behind Balewadi Stadium',
    postalCode: '411045',
    latitude: 18.5642,
    longitude: 73.7769,
    priceMin: 450000,
    priceMax: 1500000,
    priceUnit: 'PER_EVENT',
    capacityMin: 250,
    capacityMax: 2000,
    amenityCodes: [
      'stage',
      'dance-floor',
      'backup-power',
      'pet-friendly',
      'bridal-suite',
      'valet-parking',
      'bar-service',
    ],
    services: [
      {
        name: 'Farmhouse wedding',
        description: 'Exclusive use of the lawn, bungalow and farmhouse for a full day.',
        priceFrom: 950000,
        priceTo: 1500000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 720,
        includes: ['Exclusive property', 'Bridal suite', 'Generator backup', 'Valet parking'],
      },
      {
        name: 'Haldi and mehndi day',
        description: 'Daytime use of the heritage bungalow and its courtyard.',
        priceFrom: 450000,
        priceTo: 620000,
        priceUnit: 'PER_DAY',
        durationMinutes: 420,
        includes: ['Bungalow and courtyard', 'Shaded seating', 'Power for live counters'],
      },
    ],
    packages: [
      {
        name: 'Vaatika weekend',
        description: 'Saturday and Sunday access for a full wedding weekend.',
        price: 1450000,
        priceUnit: 'PER_EVENT',
        minGuests: 600,
        maxGuests: 2000,
        inclusions: ['Two-day access', 'Lawn and bungalow', 'Parking for 400 cars'],
        exclusions: ['Catering', 'Decor', 'Rooms'],
      },
      {
        name: 'Day function',
        description: 'Single-day lawn booking for up to 700 guests.',
        price: 620000,
        priceUnit: 'PER_EVENT',
        minGuests: 250,
        maxGuests: 700,
        inclusions: ['Lawn for eight hours', 'Basic lighting', 'Backup power'],
        exclusions: ['Catering', 'Furniture', 'Alcohol'],
      },
    ],
    venueSpaces: [
      {
        name: 'Main Lawn',
        description: 'Level lawn below the farmhouse with a permanent stage.',
        capacitySeated: 2000,
        capacityStanding: 2600,
        areaSqft: 42000,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Round tables', 'Theatre', 'Cluster'],
      },
      {
        name: 'Heritage Bungalow',
        description: 'Restored stone bungalow with a covered verandah.',
        capacitySeated: 180,
        capacityStanding: 240,
        areaSqft: 3800,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Cluster', 'Round tables'],
      },
      {
        name: 'Courtyard',
        description: 'Paved courtyard between the bungalow and the lawn.',
        capacitySeated: 250,
        capacityStanding: 400,
        areaSqft: 5200,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cluster', 'Cocktail', 'Live counters'],
      },
      {
        name: 'Orchard Clearing',
        description: 'Shaded clearing under the mango trees for small ceremonies.',
        capacitySeated: 100,
        capacityStanding: 150,
        areaSqft: 2000,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Cluster'],
      },
      {
        name: 'Guest Wing Lawn',
        description: 'Secondary lawn beside the guest cottages.',
        capacitySeated: 320,
        capacityStanding: 480,
        areaSqft: 6400,
        isIndoor: false,
        isOutdoor: true,
        layoutOptions: ['Round tables', 'Cocktail'],
      },
    ],
    attributes: [
      num('guest_capacity', 2000),
      many('venue_type', ['lawn', 'farmhouse', 'heritage-property']),
      many('indoor_outdoor', ['outdoor', 'both']),
      one('catering_policy', 'outside-catering-allowed'),
      bool('accommodation', true),
      num('parking_capacity', 400),
      num('number_of_spaces', 3),
    ],
  }),

  // ---------------------------------------------------------------------
  // Photography
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'smriti-frame-studios',
    name: 'Smriti Frame Studios',
    tagline: 'Candid wedding photography from Bandra West',
    description:
      'Smriti Frame Studios is a four-person photography team that has covered weddings across Mumbai and the Konkan coast since 2014. Coverage is candid-first, with a documentary approach to the ceremony and a short editorial portrait session. Albums are printed in-house on archival paper.',
    about:
      'The studio keeps a small client list each season so the same two lead photographers attend every function of a wedding.',
    primaryCategorySlug: 'photographers',
    secondaryCategorySlugs: ['photography'],
    primaryLocationSlug: 'bandra-west',
    eventTypeSlugs: ['wedding', 'engagement', 'reception', 'sangeet-and-mehndi'],
    verificationStatus: 'VERIFIED',
    isFeatured: true,
    showPhone: true,
    showEmail: true,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Meher Contractor',
    addressLine1: '302 Sunrise Apartments, Linking Road',
    addressLine2: 'Bandra West',
    postalCode: '400050',
    latitude: 19.0606,
    longitude: 72.8362,
    priceMin: 120000,
    priceMax: 450000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['air-conditioned', 'backup-power', 'av-system'],
    services: [
      {
        name: 'Wedding day coverage',
        description: 'Two photographers and one assistant for the full wedding day.',
        priceFrom: 180000,
        priceTo: 320000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 720,
        includes: [
          'Two lead photographers',
          'One assistant',
          '600 edited images',
          'Online gallery',
        ],
      },
      {
        name: 'Pre-wedding portrait session',
        description: 'Half-day location shoot with a stylist and one photographer.',
        priceFrom: 45000,
        priceTo: 90000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 240,
        includes: ['One photographer', 'Location scouting', '80 edited images'],
      },
      {
        name: 'Album design and print',
        description: 'Hand-bound 12x18 album with archival inks.',
        priceFrom: 32000,
        priceTo: 75000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Album design', '40 sheets', 'Archival print', 'Presentation box'],
      },
      {
        name: 'Drone coverage add-on',
        description: 'Licensed drone operator for outdoor functions.',
        priceFrom: 35000,
        priceTo: 60000,
        priceUnit: 'PER_DAY',
        durationMinutes: 300,
        includes: ['Licensed pilot', '4K drone footage', 'Three-minute edit'],
      },
    ],
    packages: [
      {
        name: 'Candid Essential',
        description: 'Single-day candid coverage with a highlight film.',
        price: 210000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['10 hours coverage', '2 photographers', '400 edited images', 'Highlight film'],
        exclusions: ['Album print', 'Drone', 'Travel outside Mumbai'],
      },
      {
        name: 'Full wedding story',
        description: 'Three functions covered with an album and teaser film.',
        price: 420000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Three functions', '4 photographers', '1000 edited images', 'Album', 'Teaser'],
        exclusions: ['Travel and stay', 'Drone'],
      },
    ],
    attributes: [
      many('photography_style', ['candid', 'photojournalistic', 'editorial']),
      num('coverage_hours', 12),
      many('deliverables', ['edited-photos', 'highlight-film', 'album', 'drone-footage']),
      num('team_size', 4),
      bool('travels_to_venue', true),
    ],
  }),

  defineListing({
    slug: 'patang-photography',
    name: 'Patang Photography',
    tagline: 'Traditional and fine-art documentation from Koregaon Park',
    description:
      'Patang Photography works in a traditional, richly composed style suited to Maharashtrian ceremonies and temple weddings. The team handles its own lighting and shoots medium format for the portrait sets. Two generations of the family have photographed weddings in Pune since 1998.',
    about:
      'A studio of six photographers and two retouchers, best known for large family portraits and ritual documentation.',
    primaryCategorySlug: 'photographers',
    primaryLocationSlug: 'koregaon-park',
    eventTypeSlugs: ['wedding', 'engagement', 'housewarming', 'anniversary'],
    verificationStatus: 'PENDING',
    showPhone: true,
    showEmail: false,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Anand Sathe',
    addressLine1: 'Lane 7, North Main Road',
    addressLine2: 'Koregaon Park',
    postalCode: '411001',
    latitude: 18.5375,
    longitude: 73.8931,
    priceMin: 75000,
    priceMax: 280000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['air-conditioned', 'backup-power', 'wheelchair-access'],
    services: [
      {
        name: 'Traditional wedding coverage',
        description: 'Two photographers covering the ceremony and family portraits.',
        priceFrom: 95000,
        priceTo: 180000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 600,
        includes: ['Two photographers', 'Studio lighting', '500 edited images'],
      },
      {
        name: 'Fine-art portrait sitting',
        description: 'Studio or heritage-location portraits for the couple.',
        priceFrom: 35000,
        priceTo: 70000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 180,
        includes: ['Studio setup', '60 retouched images', 'Print-ready files'],
      },
      {
        name: 'Ritual documentation',
        description: 'Half-day coverage of haldi, mehndi or a housewarming.',
        priceFrom: 30000,
        priceTo: 55000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 240,
        includes: ['One photographer', '250 edited images'],
      },
    ],
    packages: [
      {
        name: 'Classic Pune wedding',
        description: 'Ceremony and reception coverage with a printed album.',
        price: 165000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Two functions', '2 photographers', '700 edited images', 'Album'],
        exclusions: ['Video', 'Drone', 'Travel beyond Pune'],
      },
    ],
    attributes: [
      many('photography_style', ['traditional', 'fine-art', 'documentary']),
      num('coverage_hours', 10),
      many('deliverables', ['edited-photos', 'raw-photos', 'album']),
      num('team_size', 3),
      bool('travels_to_venue', true),
    ],
  }),

  defineListing({
    slug: 'the-second-light-collective',
    name: 'The Second Light Collective',
    tagline: 'Documentary wedding films, based in Bengaluru and travelling nationwide',
    description:
      'The Second Light Collective is a Bengaluru-based film crew that travels for weddings across India. The style is observational: handheld sound recording, available light and long-form editing rather than staged sequences. Deliverables include a highlight film, a full-length edit and drone footage where permitted.',
    about:
      'Founded by two documentary filmmakers in 2017, the collective keeps a roster of six cinematographers and a colourist.',
    primaryCategorySlug: 'photographers',
    secondaryCategorySlugs: ['videographers', 'photography'],
    primaryLocationSlug: 'koramangala',
    serviceAreaSlugs: ['koramangala', 'whitefield', 'bengaluru', 'mumbai', 'pune'],
    eventTypeSlugs: ['wedding', 'reception', 'sangeet-and-mehndi', 'corporate-event'],
    verificationStatus: 'VERIFIED',
    showPhone: false,
    showEmail: true,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Nithya Raghavan',
    addressLine1: 'No. 18, 5th Block, 80 Feet Road',
    addressLine2: 'Koramangala',
    postalCode: '560095',
    latitude: 12.9345,
    longitude: 77.6266,
    priceMin: 150000,
    priceMax: 520000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['av-system', 'backup-power', 'air-conditioned'],
    services: [
      {
        name: 'Two-camera film coverage',
        description: 'Documentary film crew for the ceremony and reception.',
        priceFrom: 220000,
        priceTo: 380000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 720,
        includes: ['Two cinematographers', 'Location sound', 'Highlight film', 'Full-length edit'],
      },
      {
        name: 'Drone and establishing shots',
        description: 'Aerial coverage of the venue and outdoor functions.',
        priceFrom: 55000,
        priceTo: 95000,
        priceUnit: 'PER_DAY',
        durationMinutes: 300,
        includes: ['Licensed drone pilot', '4K footage', 'Colour-graded clips'],
      },
      {
        name: 'Corporate event film',
        description: 'Single-camera documentation of conferences and launches.',
        priceFrom: 150000,
        priceTo: 260000,
        priceUnit: 'PER_DAY',
        durationMinutes: 480,
        includes: ['One cinematographer', 'Interview audio', 'Three-minute edit'],
      },
    ],
    packages: [
      {
        name: 'Documentary wedding film',
        description: 'Three-day coverage edited into a 25-minute film.',
        price: 420000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Three functions', '2 cinematographers', 'Highlight film', 'Full-length edit'],
        exclusions: ['Travel and stay outside Karnataka', 'Drone'],
      },
      {
        name: 'Highlight reel',
        description: 'Single-function film with a 90-second social cut.',
        price: 190000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['One function', '1 cinematographer', '90-second cut', 'Full edit'],
        exclusions: ['Drone', 'Second camera', 'Album'],
      },
    ],
    attributes: [
      many('photography_style', ['documentary', 'photojournalistic', 'candid']),
      num('coverage_hours', 14),
      many('deliverables', [
        'highlight-film',
        'full-length-film',
        'drone-footage',
        'edited-photos',
      ]),
      num('team_size', 6),
      bool('travels_to_venue', true),
    ],
    galleryCount: 2,
  }),

  // ---------------------------------------------------------------------
  // Catering
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'rasoi-raag-caterers',
    name: 'Rasoi Raag Caterers',
    tagline: 'Multi-cuisine wedding catering from Andheri East',
    description:
      'Rasoi Raag Caterers runs a 12,000 sq ft production kitchen in Andheri East and serves buffets, plated dinners and family-style thalis across Mumbai. Menus lean North Indian and Gujarati, with a live chaat and tandoor section. The team carries its own chafing dishes, crockery and service staff.',
    about:
      'A catering house founded in 2004 by a family of restaurateurs, serving between 100 and 2,000 covers per event.',
    primaryCategorySlug: 'caterers',
    secondaryCategorySlugs: ['catering'],
    primaryLocationSlug: 'andheri-east',
    eventTypeSlugs: ['wedding', 'reception', 'sangeet-and-mehndi', 'corporate-event', 'birthday'],
    verificationStatus: 'VERIFIED',
    showPhone: true,
    showEmail: true,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Hasina Merchant',
    addressLine1: 'Unit 6, Mittal Industrial Estate',
    addressLine2: 'Andheri East',
    postalCode: '400059',
    latitude: 19.1126,
    longitude: 72.8669,
    priceMin: 950,
    priceMax: 3400,
    priceUnit: 'PER_PLATE',
    amenityCodes: ['in-house-catering', 'backup-power', 'air-conditioned', 'wheelchair-access'],
    services: [
      {
        name: 'Wedding buffet',
        description: 'Multi-cuisine buffet with live counters and service staff.',
        priceFrom: 950,
        priceTo: 1800,
        priceUnit: 'PER_PLATE',
        durationMinutes: 240,
        includes: ['Six starters', 'Twelve main courses', 'Two live counters', 'Service staff'],
      },
      {
        name: 'Plated dinner',
        description: 'Four-course plated service with dedicated waitstaff.',
        priceFrom: 1800,
        priceTo: 3400,
        priceUnit: 'PER_PLATE',
        durationMinutes: 180,
        includes: ['Four courses', 'Plated service', 'Crookery and cutlery', 'Bar coordination'],
      },
      {
        name: 'Family-style thali',
        description: 'Seated thali service with unlimited refills.',
        priceFrom: 780,
        priceTo: 1400,
        priceUnit: 'PER_PLATE',
        durationMinutes: 150,
        includes: ['Gujarati thali', 'Unlimited refills', 'Service staff', 'Dessert'],
      },
    ],
    packages: [
      {
        name: 'Reception buffet package',
        description: 'Per-plate buffet pricing for a 400-guest reception.',
        price: 1250,
        priceUnit: 'PER_PLATE',
        minGuests: 200,
        maxGuests: 800,
        inclusions: ['Buffet menu', 'Two live counters', 'Service staff', 'Crockery'],
        exclusions: ['Alcohol', 'Decor', 'Venue'],
      },
      {
        name: 'Corporate lunch package',
        description: 'Working lunch with vegetarian and non-vegetarian options.',
        price: 850,
        priceUnit: 'PER_PLATE',
        minGuests: 50,
        maxGuests: 500,
        inclusions: ['Two mains', 'Rice and breads', 'Dessert', 'Disposable service'],
        exclusions: ['Live counters', 'Waitstaff'],
      },
    ],
    attributes: [
      many('cuisine_speciality', [
        'north-indian',
        'gujarati',
        'mughlai',
        'continental',
        'live-counters',
      ]),
      many('service_style', ['buffet', 'plated', 'family-style', 'live-counters']),
      num('per_plate_price', 1800),
    ],
    galleryCount: 2,
  }),

  defineListing({
    slug: 'angara-live-kitchens',
    name: 'Angara Live Kitchens',
    tagline: 'Rajasthani live counters and open-fire cooking in Jaipur',
    description:
      'Angara Live Kitchens specialises in open-fire cooking and live counters: dal baati churma, laal maas, wood-fired kebabs and a travelling jalebi cart. The team travels across Rajasthan and the NCR with its own tandoors and cold-chain vans. Menus are built around Rajasthani and Mughlai specialities.',
    about:
      'A chef-led catering studio founded in 2016, known for heritage Rajasthani menus cooked at the venue rather than pre-plated.',
    primaryCategorySlug: 'caterers',
    secondaryCategorySlugs: ['live-food-stations', 'catering'],
    primaryLocationSlug: 'civil-lines',
    serviceAreaSlugs: ['civil-lines', 'amer-road', 'jaipur', 'new-delhi'],
    eventTypeSlugs: ['wedding', 'sangeet-and-mehndi', 'reception', 'corporate-event'],
    verificationStatus: 'PENDING',
    showPhone: true,
    showEmail: false,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Devendra Rathore',
    addressLine1: '22 Sardar Patel Marg',
    addressLine2: 'Civil Lines',
    postalCode: '302006',
    latitude: 26.9021,
    longitude: 75.7873,
    priceMin: 1200,
    priceMax: 4200,
    priceUnit: 'PER_PLATE',
    amenityCodes: ['in-house-catering', 'backup-power', 'stage', 'dance-floor'],
    services: [
      {
        name: 'Heritage Rajasthani counter',
        description: 'Live counters for dal baati churma, laal maas and bajra rotis.',
        priceFrom: 1400,
        priceTo: 2400,
        priceUnit: 'PER_PLATE',
        durationMinutes: 240,
        includes: ['Three live counters', 'Open-fire cooking', 'Chef brigade', 'Service staff'],
      },
      {
        name: 'Open-fire grill station',
        description: 'Wood-fired kebabs and tandoor breads served from the pit.',
        priceFrom: 1200,
        priceTo: 2200,
        priceUnit: 'PER_PLATE',
        durationMinutes: 180,
        includes: ['Tandoor and pit', 'Six kebab varieties', 'Chutneys', 'Live breads'],
      },
      {
        name: 'Mithai and jalebi cart',
        description: 'Travelling dessert cart with hot jalebi and rabri.',
        priceFrom: 450,
        priceTo: 900,
        priceUnit: 'PER_PLATE',
        durationMinutes: 150,
        includes: ['Jalebi cart', 'Rabri and gulab jamun', 'Live service'],
      },
    ],
    packages: [
      {
        name: 'Royal Rajasthani wedding',
        description: 'Per-plate heritage menu with four live counters.',
        price: 2600,
        priceUnit: 'PER_PLATE',
        minGuests: 150,
        maxGuests: 1200,
        inclusions: ['Royal thali menu', 'Four live counters', 'Chef brigade', 'Crockery'],
        exclusions: ['Alcohol', 'Venue', 'Decor'],
      },
      {
        name: 'Sangeet grazing table',
        description: 'Standing cocktail menu for a sangeet evening.',
        price: 1650,
        priceUnit: 'PER_PLATE',
        minGuests: 100,
        maxGuests: 600,
        inclusions: ['Grazing table', 'Two counters', 'Mocktail bar', 'Service staff'],
        exclusions: ['Alcohol', 'Live music'],
      },
    ],
    attributes: [
      many('cuisine_speciality', [
        'rajasthani',
        'mughlai',
        'north-indian',
        'live-counters',
        'pan-asian',
      ]),
      many('service_style', ['live-counters', 'buffet', 'plated']),
      num('per_plate_price', 2600),
    ],
  }),

  // ---------------------------------------------------------------------
  // Beauty
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'mirage-beauty-studio',
    name: 'Mirage Beauty Studio',
    tagline: 'Bridal makeup and draping in Bandra West',
    description:
      'Mirage Beauty Studio is a bridal makeup practice in Bandra West that works in natural, dewy and HD finishes. The team handles draping, hairstyling and touch-up kits for the full function. Trials are held at the studio or at home for Mumbai addresses.',
    about:
      'Lead artist Reema Wagle has worked on weddings for eleven years and keeps a team of four artists for multi-function bookings.',
    primaryCategorySlug: 'makeup-artists',
    secondaryCategorySlugs: ['beauty'],
    primaryLocationSlug: 'bandra-west',
    eventTypeSlugs: ['wedding', 'engagement', 'reception', 'sangeet-and-mehndi'],
    verificationStatus: 'VERIFIED',
    isFeatured: false,
    showPhone: true,
    showEmail: false,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Reema Wagle',
    addressLine1: '5 Chapel Road, above Sunny Bakery',
    addressLine2: 'Bandra West',
    postalCode: '400050',
    latitude: 19.0544,
    longitude: 72.8273,
    priceMin: 25000,
    priceMax: 95000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['air-conditioned', 'backup-power', 'bridal-suite'],
    services: [
      {
        name: 'Bridal makeup day',
        description: 'Full bridal look with draping, hair and a touch-up kit.',
        priceFrom: 55000,
        priceTo: 95000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 240,
        includes: ['HD bridal makeup', 'Hairstyling', 'Saree or lehenga draping', 'Touch-up kit'],
      },
      {
        name: 'Engagement look',
        description: 'Party-ready makeup and hair for the engagement.',
        priceFrom: 25000,
        priceTo: 45000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 150,
        includes: ['Makeup', 'Hair styling', 'False lashes', 'Setting spray'],
      },
      {
        name: 'Family and guest makeup',
        description: 'Per-person makeup for close family members.',
        priceFrom: 8000,
        priceTo: 18000,
        priceUnit: 'PER_PERSON',
        durationMinutes: 60,
        includes: ['Makeup', 'Basic hair', 'Touch-up'],
      },
    ],
    packages: [
      {
        name: 'Bridal three-function',
        description: 'Mehndi, sangeet and wedding day looks with one artist.',
        price: 145000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Three looks', 'Draping', 'Hairstyling', 'Trial session'],
        exclusions: ['Family makeup', 'Travel outside Mumbai'],
      },
    ],
    attributes: [
      many('makeup_service_type', [
        'bridal-makeup',
        'engagement-makeup',
        'hairstyling',
        'draping',
        'airbrush',
      ]),
      many('makeup_style', ['natural', 'dewy', 'hd']),
      bool('travels_to_venue', true),
    ],
  }),

  defineListing({
    slug: 'aadya-artistry',
    name: 'Aadya Artistry',
    tagline: 'Glam and traditional bridal artistry in South Delhi',
    description:
      'Aadya Artistry is a Delhi makeup practice working in glam and traditional styles, with airbrush and HD finishes for camera-heavy functions. The studio covers Saket, Chattarpur and the wider NCR, and travels for destination weddings. Hair, draping and jewellery setting are handled by the same artist.',
    about:
      'Founded in 2018 by artist Aadya Bhardwaj, the studio handles about forty weddings a year and runs its own product line for touch-ups.',
    primaryCategorySlug: 'makeup-artists',
    primaryLocationSlug: 'saket',
    serviceAreaSlugs: ['saket', 'chattarpur', 'new-delhi'],
    eventTypeSlugs: ['wedding', 'engagement', 'reception', 'birthday'],
    verificationStatus: 'UNVERIFIED',
    showPhone: false,
    showEmail: true,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Aadya Bhardwaj',
    addressLine1: 'B-14, Press Enclave Road',
    addressLine2: 'Saket',
    postalCode: '110017',
    latitude: 28.5245,
    longitude: 77.2066,
    priceMin: 35000,
    priceMax: 120000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['air-conditioned', 'backup-power', 'bridal-suite'],
    services: [
      {
        name: 'Airbrush bridal',
        description: 'Airbrush base with HD contouring and a traditional eye look.',
        priceFrom: 75000,
        priceTo: 120000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 270,
        includes: ['Airbrush makeup', 'Hairstyling', 'Draping', 'Jewellery setting'],
      },
      {
        name: 'Party makeup',
        description: 'Glam makeup for receptions and cocktail evenings.',
        priceFrom: 35000,
        priceTo: 60000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 120,
        includes: ['Glam makeup', 'Hair styling', 'Lashes'],
      },
    ],
    packages: [
      {
        name: 'Delhi wedding package',
        description: 'Two looks with a trial and family touch-ups.',
        price: 160000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Two looks', 'Trial session', 'Draping', 'Two guest touch-ups'],
        exclusions: ['Travel outside NCR', 'Hair extensions'],
      },
    ],
    attributes: [
      many('makeup_service_type', [
        'bridal-makeup',
        'party-makeup',
        'hairstyling',
        'draping',
        'airbrush',
      ]),
      many('makeup_style', ['glam', 'traditional', 'airbrush', 'hd']),
      bool('travels_to_venue', true),
    ],
  }),

  // ---------------------------------------------------------------------
  // Decor
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'phoolpatte-designs',
    name: 'Phoolpatte Designs',
    tagline: 'Floral and stage decor from Juhu',
    description:
      'Phoolpatte Designs builds mandaps, stages and floral installations for weddings in and around Mumbai. The studio imports seasonal blooms and fabricates its own structures, so large installations can be assembled overnight. Work ranges from minimal contemporary setups to full traditional mandaps.',
    about:
      'A decor studio of eighteen people, including four florists and a fabrication workshop, founded in 2012.',
    primaryCategorySlug: 'decorators-and-florists',
    secondaryCategorySlugs: ['planning-and-decor'],
    primaryLocationSlug: 'juhu',
    eventTypeSlugs: ['wedding', 'sangeet-and-mehndi', 'engagement', 'reception'],
    verificationStatus: 'VERIFIED',
    showPhone: true,
    showEmail: true,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Zoya Irani',
    addressLine1: 'Gala 3, Juhu Tara Road',
    addressLine2: 'Juhu',
    postalCode: '400049',
    latitude: 19.1042,
    longitude: 72.8277,
    priceMin: 180000,
    priceMax: 1200000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['stage', 'dance-floor', 'backup-power', 'av-system'],
    services: [
      {
        name: 'Mandap design and build',
        description: 'Traditional or contemporary mandap with fresh florals.',
        priceFrom: 350000,
        priceTo: 750000,
        priceUnit: 'PER_EVENT',
        durationMinutes: null,
        includes: ['Mandap structure', 'Fresh floral work', 'Draping', 'Setup and dismantle'],
      },
      {
        name: 'Stage and backdrop',
        description: 'Reception stage, backdrop and entrance installation.',
        priceFrom: 180000,
        priceTo: 450000,
        priceUnit: 'PER_EVENT',
        durationMinutes: null,
        includes: ['Stage build', 'Backdrop', 'Entrance arch', 'Uplighting'],
      },
      {
        name: 'Table and aisle styling',
        description: 'Centre-pieces, aisle decor and signage styling.',
        priceFrom: 120000,
        priceTo: 300000,
        priceUnit: 'PER_EVENT',
        durationMinutes: null,
        includes: ['Centre-pieces', 'Aisle florals', 'Signage', 'Candle styling'],
      },
    ],
    packages: [
      {
        name: 'Full wedding decor',
        description: 'Three functions decorated with fresh florals throughout.',
        price: 950000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Three functions', 'Mandap', 'Stage', 'Entrance', 'Table styling'],
        exclusions: ['Lighting design', 'Furniture rental'],
      },
      {
        name: 'Reception styling only',
        description: 'Stage, entrance and table styling for one evening.',
        price: 420000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Stage and backdrop', 'Entrance', 'Twenty centre-pieces'],
        exclusions: ['Mandap', 'Aisle', 'Lighting'],
      },
    ],
    attributes: [many('decor_style', ['floral', 'traditional', 'royal', 'contemporary'])],
    galleryCount: 2,
  }),

  defineListing({
    slug: 'dhundh-floral-and-decor',
    name: 'Dhundh Floral & Decor',
    tagline: 'Heritage-inspired decor on Amer Road',
    description:
      'Dhundh Floral & Decor works out of a workshop on Amer Road and styles palace-adjacent venues across Jaipur. The palette leans on marigold, rose and brass, with block-printed fabrics and hand-painted props. The studio also handles minimal contemporary setups for smaller functions.',
    about:
      'A Jaipur studio run by two sisters, working with local artisan clusters for props and fabric.',
    primaryCategorySlug: 'decorators-and-florists',
    primaryLocationSlug: 'amer-road',
    eventTypeSlugs: ['wedding', 'sangeet-and-mehndi', 'reception', 'housewarming'],
    verificationStatus: 'PENDING',
    showPhone: true,
    showEmail: false,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Kirti Shekhawat',
    addressLine1: 'Khasra 91, Amer Road',
    addressLine2: 'Near Jal Mahal',
    postalCode: '302002',
    latitude: 26.9572,
    longitude: 75.8513,
    priceMin: 150000,
    priceMax: 850000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['stage', 'backup-power', 'dance-floor'],
    services: [
      {
        name: 'Heritage mandap',
        description: 'Marigold and brass mandap inspired by local palace architecture.',
        priceFrom: 280000,
        priceTo: 620000,
        priceUnit: 'PER_EVENT',
        durationMinutes: null,
        includes: ['Mandap structure', 'Marigold florals', 'Brass props', 'Setup crew'],
      },
      {
        name: 'Minimal contemporary setup',
        description: 'Clean, low-floral styling for intimate functions.',
        priceFrom: 150000,
        priceTo: 320000,
        priceUnit: 'PER_EVENT',
        durationMinutes: null,
        includes: ['Backdrop', 'Seating styling', 'Candle arrangement'],
      },
      {
        name: 'Rustic courtyard styling',
        description: 'Rustic props and fabric draping for haldi and mehndi.',
        priceFrom: 120000,
        priceTo: 260000,
        priceUnit: 'PER_EVENT',
        durationMinutes: null,
        includes: ['Fabric draping', 'Rustic props', 'Floor seating', 'Floral accents'],
      },
    ],
    packages: [
      {
        name: 'Royal Jaipur wedding',
        description: 'Heritage decor across two functions with artisan props.',
        price: 780000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Two functions', 'Heritage mandap', 'Stage', 'Hand-painted props'],
        exclusions: ['Lighting', 'Furniture rental'],
      },
    ],
    attributes: [many('decor_style', ['floral', 'traditional', 'royal', 'rustic', 'minimal'])],
  }),

  // ---------------------------------------------------------------------
  // Entertainment
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'skyline-sound-djs',
    name: 'Skyline Sound DJs',
    tagline: 'Club-grade sound and lighting from Powai',
    description:
      'Skyline Sound DJs supplies DJs, line-array sound and intelligent lighting for weddings and corporate nights across Mumbai. Sets are built from the family playlist rather than a fixed club set, and the crew manages the venue sound limits. A backup console and generator feed keep the dance floor running.',
    about:
      'An eight-DJ collective with its own inventory of Funktion-One-style line arrays and moving heads, active since 2013.',
    primaryCategorySlug: 'djs',
    secondaryCategorySlugs: ['entertainment'],
    primaryLocationSlug: 'powai',
    eventTypeSlugs: ['sangeet-and-mehndi', 'reception', 'corporate-event', 'birthday'],
    verificationStatus: 'VERIFIED',
    showPhone: true,
    showEmail: false,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Karan Bhatia',
    addressLine1: '404 Hiranandani Gardens, Central Avenue',
    addressLine2: 'Powai',
    postalCode: '400076',
    latitude: 19.1176,
    longitude: 72.906,
    priceMin: 65000,
    priceMax: 320000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['av-system', 'backup-power', 'dance-floor', 'stage'],
    services: [
      {
        name: 'Wedding sangeet set',
        description: 'DJ set with line-array sound and uplighting.',
        priceFrom: 85000,
        priceTo: 180000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 300,
        includes: ['DJ', 'Line-array sound', 'Uplighting', 'Wireless mics'],
      },
      {
        name: 'Full club lighting rig',
        description: 'Moving heads, lasers and haze for a reception night.',
        priceFrom: 120000,
        priceTo: 320000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 360,
        includes: ['Moving heads', 'Laser and haze', 'Lighting operator', 'Truss'],
      },
      {
        name: 'Corporate awards night',
        description: 'Sound, mics and playback for a corporate stage programme.',
        priceFrom: 65000,
        priceTo: 150000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 240,
        includes: ['PA system', 'Four wireless mics', 'Playback operator'],
      },
    ],
    packages: [
      {
        name: 'Sangeet night package',
        description: 'Six-hour DJ and lighting package with sound for 600 guests.',
        price: 175000,
        priceUnit: 'PER_PACKAGE',
        minGuests: 200,
        maxGuests: 1500,
        inclusions: ['DJ and console', 'Sound for 600', 'Uplighting', 'Dance floor lighting'],
        exclusions: ['Stage build', 'Fireworks', 'Generator'],
      },
    ],
    attributes: [
      many('performance_type', ['dj', 'anchor']),
      num('performance_duration', 6),
      many('languages', ['hindi', 'english', 'marathi', 'punjabi']),
      bool('equipment_provided', true),
    ],
  }),

  defineListing({
    slug: 'raag-bahar-live-band',
    name: 'Raag Bahar Live Band',
    tagline: 'A seven-piece Bollywood and sufi band from Baner',
    description:
      'Raag Bahar Live Band is a seven-piece outfit from Baner covering Bollywood, sufi and Marathi theatre repertoire. The band carries its own backline, wireless mics and in-ear monitoring, and can scale down to a four-piece acoustic set. Sets are rehearsed with the family playlist ahead of the event.',
    about:
      'Formed in 2011 out of Pune’s live circuit, the band plays around ninety weddings and corporate shows a year.',
    primaryCategorySlug: 'live-bands',
    secondaryCategorySlugs: ['entertainment'],
    primaryLocationSlug: 'baner',
    eventTypeSlugs: ['sangeet-and-mehndi', 'reception', 'wedding', 'corporate-event'],
    verificationStatus: 'PENDING',
    showPhone: false,
    showEmail: true,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Siddharth Phadke',
    addressLine1: '12 Balewadi Link Road',
    addressLine2: 'Baner',
    postalCode: '411045',
    latitude: 18.559,
    longitude: 73.7868,
    priceMin: 90000,
    priceMax: 380000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['av-system', 'stage', 'backup-power', 'dance-floor'],
    services: [
      {
        name: 'Seven-piece live set',
        description: 'Full band with horns and two vocalists.',
        priceFrom: 180000,
        priceTo: 380000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 240,
        includes: ['Seven musicians', 'Backline and PA', 'Wireless mics', 'Sound engineer'],
      },
      {
        name: 'Acoustic four-piece',
        description: 'Compact acoustic set for mehndi and cocktail hours.',
        priceFrom: 90000,
        priceTo: 150000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 180,
        includes: ['Four musicians', 'Compact PA', 'Acoustic repertoire'],
      },
    ],
    packages: [
      {
        name: 'Sangeet live package',
        description: 'Four-hour live set with sound and rehearsal.',
        price: 240000,
        priceUnit: 'PER_PACKAGE',
        minGuests: 150,
        maxGuests: 1200,
        inclusions: ['Live band', 'PA and backline', 'One rehearsal', 'Sound engineer'],
        exclusions: ['Stage build', 'Lighting', 'Travel outside Pune'],
      },
    ],
    attributes: [
      many('performance_type', ['live-band', 'instrumentalist', 'anchor']),
      num('performance_duration', 4),
      many('languages', ['hindi', 'marathi', 'english', 'punjabi']),
      bool('equipment_provided', true),
    ],
  }),

  // ---------------------------------------------------------------------
  // Planning
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'sunheri-plans-weddings',
    name: 'Sunheri Plans Weddings',
    tagline: 'Full-service wedding planning from Bandra West',
    description:
      'Sunheri Plans Weddings manages the full wedding programme: budget, vendor contracts, guest logistics and the run-of-show for each function. The team works on eight weddings a season so a lead planner stays present on every event day. Vendor sourcing for venues and catering is handled in-house.',
    about:
      'A planning studio founded in 2016 by a former hotel events manager, with a core team of five planners.',
    primaryCategorySlug: 'wedding-planners',
    secondaryCategorySlugs: ['planning-and-decor'],
    primaryLocationSlug: 'bandra-west',
    serviceAreaSlugs: ['bandra-west', 'juhu', 'andheri-east', 'mumbai', 'pune'],
    eventTypeSlugs: ['wedding', 'engagement', 'sangeet-and-mehndi', 'reception'],
    verificationStatus: 'VERIFIED',
    showPhone: true,
    showEmail: true,
    showWhatsapp: false,
    showWebsite: true,
    contactPersonName: 'Nandini Bose',
    addressLine1: '701 Linking Road, Turner Road junction',
    addressLine2: 'Bandra West',
    postalCode: '400050',
    latitude: 19.0649,
    longitude: 72.8337,
    priceMin: 250000,
    priceMax: 1500000,
    priceUnit: 'PER_PACKAGE',
    amenityCodes: ['air-conditioned', 'backup-power', 'wheelchair-access'],
    services: [
      {
        name: 'Full wedding planning',
        description: 'End-to-end planning from budget to run-of-show.',
        priceFrom: 750000,
        priceTo: 1500000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Budget planning', 'Vendor sourcing', 'Contract review', 'On-site team'],
      },
      {
        name: 'Partial planning',
        description: 'Planning support for the functions you have not booked yet.',
        priceFrom: 400000,
        priceTo: 750000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Three vendor categories', 'Timeline', 'Two on-site days'],
      },
      {
        name: 'Day coordination',
        description: 'Run-of-show management for an already-planned wedding.',
        priceFrom: 250000,
        priceTo: 420000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Run-of-show', 'Vendor briefing', 'One on-site coordinator'],
      },
      {
        name: 'Vendor sourcing',
        description: 'Shortlist and negotiation for a single vendor category.',
        priceFrom: 60000,
        priceTo: 140000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Three shortlisted vendors', 'Price benchmarking', 'Negotiation support'],
      },
    ],
    packages: [
      {
        name: 'Seasoned planner retainer',
        description: 'Monthly retainer covering a twelve-month engagement.',
        price: 1200000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: [
          'Full planning',
          'Unlimited vendor calls',
          'All event days',
          'Guest logistics',
        ],
        exclusions: ['Vendor payments', 'Travel outside Maharashtra'],
      },
    ],
    attributes: [
      num('planner_experience_years', 11),
      many('planning_scope', [
        'full-planning',
        'partial-planning',
        'day-coordination',
        'vendor-sourcing',
      ]),
    ],
  }),

  // ---------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'kaagaz-letterpress',
    name: 'Kaagaz Letterpress',
    tagline: 'Hand-fed letterpress invitations from Whitefield',
    description:
      'Kaagaz Letterpress prints wedding invitations on a restored hand-fed press using cotton rag paper and foil blocking. Suites are designed in-house and can include a digital version for guests overseas. Orders run from fifty to two thousand cards, with a two-week proof cycle.',
    about:
      'A two-press studio in Whitefield, founded in 2019 by a graphic designer and a printmaker.',
    primaryCategorySlug: 'invitation-designers',
    secondaryCategorySlugs: [],
    primaryLocationSlug: 'whitefield',
    serviceAreaSlugs: ['whitefield', 'koramangala', 'bengaluru'],
    eventTypeSlugs: ['wedding', 'engagement', 'housewarming'],
    verificationStatus: 'UNVERIFIED',
    showPhone: false,
    showEmail: true,
    showWhatsapp: true,
    showWebsite: true,
    contactPersonName: 'Tanvi Iyer',
    addressLine1: '14 ITPL Main Road, unit 2',
    addressLine2: 'Whitefield',
    postalCode: '560066',
    latitude: 12.9698,
    longitude: 77.75,
    priceMin: 18000,
    priceMax: 240000,
    priceUnit: 'PER_PACKAGE',
    amenityCodes: ['air-conditioned', 'backup-power', 'wheelchair-access'],
    services: [
      {
        name: 'Letterpress invitation suite',
        description: 'Designed suite printed on cotton rag with letterpress and foil.',
        priceFrom: 65000,
        priceTo: 240000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Custom design', 'Letterpress printing', 'Foil blocking', 'Envelope addressing'],
      },
      {
        name: 'Digital invitation',
        description: 'Animated digital invite with an RSVP link.',
        priceFrom: 18000,
        priceTo: 45000,
        priceUnit: 'PER_PACKAGE',
        durationMinutes: null,
        includes: ['Custom design', 'Animated version', 'RSVP page', 'Two revisions'],
      },
    ],
    packages: [
      {
        name: 'Standard suite of 200',
        description: 'Two-colour letterpress suite for two hundred guests.',
        price: 145000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['200 cards', 'Two colours', 'Envelopes', 'Proof rounds'],
        exclusions: ['Courier outside India', 'Calligraphy'],
      },
    ],
    attributes: [],
  }),

  // ---------------------------------------------------------------------
  // Non-published listings — prove public queries exclude them
  // ---------------------------------------------------------------------
  defineListing({
    slug: 'navrang-convention-centre',
    name: 'Navrang Convention Centre',
    tagline: 'Under construction: a 2,000-seat convention centre in Powai',
    description:
      'Navrang Convention Centre is a 2,000-seat convention facility under construction in Powai. The listing is not published because rates and possession dates are not confirmed. Details will be published once the first hall is handed over.',
    about:
      'Draft record used by the seed to prove that public queries exclude unpublished listings.',
    primaryCategorySlug: 'banquet-halls',
    primaryLocationSlug: 'powai',
    publicationStatus: 'DRAFT',
    verificationStatus: 'UNVERIFIED',
    contactPersonName: 'Imran Shaikh',
    addressLine1: 'Hiranandani Link Road',
    postalCode: '400076',
    latitude: 19.1197,
    longitude: 72.9051,
    priceMin: 900000,
    priceMax: 2600000,
    priceUnit: 'PER_EVENT',
    capacityMin: 500,
    capacityMax: 2000,
    amenityCodes: ['air-conditioned', 'valet-parking', 'backup-power', 'stage'],
    services: [
      {
        name: 'Convention hall hire',
        description: 'Provisional hall hire while the build is completed.',
        priceFrom: 900000,
        priceTo: 2600000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 600,
        includes: ['Main hall', 'Registration area', 'Backup power'],
      },
      {
        name: 'Exhibition floor',
        description: 'Ground-floor exhibition space for trade shows.',
        priceFrom: 600000,
        priceTo: 1400000,
        priceUnit: 'PER_DAY',
        durationMinutes: 480,
        includes: ['Exhibition floor', 'Shell scheme', 'Power points'],
      },
    ],
    packages: [
      {
        name: 'Launch offer',
        description: 'Indicative package, subject to change before launch.',
        price: 1400000,
        priceUnit: 'PER_EVENT',
        minGuests: 500,
        maxGuests: 2000,
        inclusions: ['Main hall', 'Two breakouts', 'Parking'],
        exclusions: ['Catering', 'Decor'],
      },
    ],
    venueSpaces: [
      {
        name: 'Main Convention Hall',
        description: 'Column-free hall under construction.',
        capacitySeated: 2000,
        capacityStanding: 2600,
        areaSqft: 32000,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Theatre', 'Round tables', 'Exhibition'],
      },
      {
        name: 'Hall B',
        description: 'Secondary hall for parallel sessions.',
        capacitySeated: 600,
        capacityStanding: 800,
        areaSqft: 9000,
        isIndoor: true,
        isOutdoor: false,
        layoutOptions: ['Theatre', 'Cluster'],
      },
    ],
    attributes: [
      num('guest_capacity', 2000),
      many('venue_type', ['convention-centre', 'banquet-hall']),
      many('indoor_outdoor', ['indoor']),
      one('catering_policy', 'outside-catering-allowed'),
      bool('accommodation', false),
      num('parking_capacity', 500),
      num('number_of_spaces', 2),
    ],
  }),

  defineListing({
    slug: 'chitrakatha-films',
    name: 'Chitrakatha Films',
    tagline: 'Draft profile: wedding films from Andheri East',
    description:
      'Chitrakatha Films is a wedding film unit in Andheri East. The listing is a draft while showreel permissions are confirmed with past clients. Coverage includes a two-camera ceremony shoot and a long-form edit.',
    about:
      'Draft record used by the seed to prove that public queries exclude unpublished listings.',
    primaryCategorySlug: 'videographers',
    primaryLocationSlug: 'andheri-east',
    publicationStatus: 'DRAFT',
    verificationStatus: 'PENDING',
    contactPersonName: 'Rohit Pawar',
    addressLine1: 'Unit 11, Sakinaka Industrial Estate',
    postalCode: '400072',
    latitude: 19.0993,
    longitude: 72.8875,
    priceMin: 140000,
    priceMax: 380000,
    priceUnit: 'PER_EVENT',
    amenityCodes: ['av-system', 'backup-power', 'air-conditioned'],
    services: [
      {
        name: 'Two-camera wedding film',
        description: 'Ceremony coverage edited into a long-form film.',
        priceFrom: 180000,
        priceTo: 380000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 600,
        includes: ['Two cameras', 'Location audio', 'Long-form edit'],
      },
      {
        name: 'Teaser cut',
        description: 'Two-minute teaser delivered within a week.',
        priceFrom: 140000,
        priceTo: 220000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 240,
        includes: ['One camera', 'Teaser edit', 'Music licensing'],
      },
    ],
    packages: [
      {
        name: 'Draft wedding film package',
        description: 'Provisional pricing pending showreel sign-off.',
        price: 260000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Two functions', 'Two cameras', 'Teaser and long-form edit'],
        exclusions: ['Drone', 'Album'],
      },
    ],
    attributes: [
      many('photography_style', ['documentary', 'candid']),
      num('coverage_hours', 10),
      many('deliverables', ['highlight-film', 'full-length-film']),
      num('team_size', 3),
      bool('travels_to_venue', false),
    ],
  }),

  defineListing({
    slug: 'saffron-threads-styling',
    name: 'Saffron Threads Styling',
    tagline: 'Draft profile: event hair styling in Juhu',
    description:
      'Saffron Threads Styling is an event hair studio in Juhu covering bridal hair, extensions and dupatta setting. The profile is a draft while the studio photographs its recent work. Home service is available across the western suburbs.',
    about:
      'Draft record used by the seed to prove that public queries exclude unpublished listings.',
    primaryCategorySlug: 'hair-stylists',
    primaryLocationSlug: 'juhu',
    publicationStatus: 'DRAFT',
    verificationStatus: 'UNVERIFIED',
    contactPersonName: 'Sneha Kadam',
    addressLine1: 'B-6, Gulmohar Cross Lane',
    postalCode: '400049',
    latitude: 19.1075,
    longitude: 72.8263,
    priceMin: 8000,
    priceMax: 45000,
    priceUnit: 'PER_PERSON',
    amenityCodes: ['air-conditioned', 'bridal-suite', 'backup-power'],
    services: [
      {
        name: 'Bridal hair styling',
        description: 'Bridal hair with extensions and dupatta setting.',
        priceFrom: 25000,
        priceTo: 45000,
        priceUnit: 'PER_EVENT',
        durationMinutes: 150,
        includes: ['Hair styling', 'Extensions', 'Dupatta setting'],
      },
      {
        name: 'Guest hair styling',
        description: 'Per-person styling for family and guests.',
        priceFrom: 8000,
        priceTo: 15000,
        priceUnit: 'PER_PERSON',
        durationMinutes: 45,
        includes: ['Hair styling', 'Basic setting'],
      },
    ],
    packages: [
      {
        name: 'Draft bridal hair package',
        description: 'Provisional package while the profile is prepared.',
        price: 38000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Bridal hair', 'Trial session', 'Two guest styles'],
        exclusions: ['Makeup', 'Travel outside Mumbai'],
      },
    ],
    attributes: [
      many('makeup_service_type', ['hairstyling', 'draping']),
      many('makeup_style', ['natural', 'traditional']),
      bool('travels_to_venue', true),
    ],
  }),

  defineListing({
    slug: 'raatrani-rovers',
    name: 'Raatrani Rovers',
    tagline: 'Unpublished: chauffeured luxury cars from Koregaon Park',
    description:
      'Raatrani Rovers supplies chauffeured luxury cars for wedding parties in Pune. The listing is unpublished because the fleet insurance has lapsed and cannot be advertised until it is renewed. Enquiries are redirected to the venue partners meanwhile.',
    about: 'Unpublished record used by the seed to prove that public queries exclude it.',
    primaryCategorySlug: 'luxury-car-rentals',
    primaryLocationSlug: 'koregaon-park',
    publicationStatus: 'UNPUBLISHED',
    verificationStatus: 'PENDING',
    contactPersonName: 'Yash Gokhale',
    addressLine1: 'Lane 5, North Main Road',
    postalCode: '411001',
    latitude: 18.5362,
    longitude: 73.8939,
    priceMin: 18000,
    priceMax: 95000,
    priceUnit: 'PER_DAY',
    amenityCodes: ['air-conditioned', 'valet-parking', 'backup-power'],
    services: [
      {
        name: 'Bridal car with chauffeur',
        description: 'Decorated luxury sedan with a chauffeur for the wedding day.',
        priceFrom: 35000,
        priceTo: 95000,
        priceUnit: 'PER_DAY',
        durationMinutes: 720,
        includes: ['Chauffeur', 'Floral decoration', 'Fuel', 'Red carpet entry'],
      },
      {
        name: 'Guest shuttle',
        description: 'Air-conditioned shuttles between the hotel and the venue.',
        priceFrom: 18000,
        priceTo: 45000,
        priceUnit: 'PER_DAY',
        durationMinutes: 480,
        includes: ['22-seat coach', 'Driver', 'Two trips'],
      },
    ],
    packages: [
      {
        name: 'Wedding convoy',
        description: 'Three-car convoy for the baraat and guest movement.',
        price: 145000,
        priceUnit: 'PER_PACKAGE',
        minGuests: null,
        maxGuests: null,
        inclusions: ['Three cars', 'Chauffeurs', 'Decoration', 'Fuel'],
        exclusions: ['Interstate permits', 'Toll charges'],
      },
    ],
    attributes: [],
  }),
];
