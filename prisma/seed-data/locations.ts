/**
 * Geography seed: one real hierarchy of COUNTRY → STATE → CITY → LOCALITY.
 *
 * `path` is the materialised slug path and is the authoritative uniqueness key
 * (the schema comment explains why: a nullable `parentId` cannot be part of a
 * reliable unique constraint).
 */

import type { LocationType } from '@/generated/prisma/enums';

export interface LocationSeed {
  slug: string;
  name: string;
  type: LocationType;
  parentSlug: string | null;
  path: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  sortOrder: number;
}

interface LocalityInput {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface CityInput {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  localities: readonly LocalityInput[];
}

interface StateInput {
  slug: string;
  name: string;
  cities: readonly CityInput[];
}

const COUNTRY = {
  slug: 'india',
  name: 'India',
  latitude: 21.1458,
  longitude: 79.0882,
  description: 'Life Events currently operates across India.',
  sortOrder: 0,
} as const;

const STATES: readonly StateInput[] = [
  {
    slug: 'maharashtra',
    name: 'Maharashtra',
    cities: [
      {
        slug: 'mumbai',
        name: 'Mumbai',
        latitude: 19.076,
        longitude: 72.8777,
        description:
          'Mumbai is India’s largest wedding market, with banquet halls and hotels across the western suburbs and the island city.',
        localities: [
          { slug: 'bandra-west', name: 'Bandra West', latitude: 19.0596, longitude: 72.8295 },
          { slug: 'andheri-east', name: 'Andheri East', latitude: 19.1136, longitude: 72.8697 },
          { slug: 'juhu', name: 'Juhu', latitude: 19.1075, longitude: 72.8263 },
          { slug: 'powai', name: 'Powai', latitude: 19.1176, longitude: 72.906 },
        ],
      },
      {
        slug: 'pune',
        name: 'Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        description:
          'Pune pairs city hotels with farmhouse venues on the outskirts, popular for multi-day weddings.',
        // The Pune localities below are the neighbourhoods the venue catalogue
        // actually uses (see data/venues/source-venues.json). They are ordered
        // west-to-east so the browse filter reads geographically.
        localities: [
          { slug: 'hinjawadi', name: 'Hinjawadi', latitude: 18.5913, longitude: 73.7389 },
          { slug: 'wakad', name: 'Wakad', latitude: 18.5986, longitude: 73.7625 },
          { slug: 'baner', name: 'Baner', latitude: 18.559, longitude: 73.7868 },
          { slug: 'aundh', name: 'Aundh', latitude: 18.559, longitude: 73.8078 },
          { slug: 'bavdhan', name: 'Bavdhan', latitude: 18.5236, longitude: 73.7739 },
          { slug: 'pashan', name: 'Pashan', latitude: 18.5378, longitude: 73.7898 },
          { slug: 'kothrud', name: 'Kothrud', latitude: 18.5074, longitude: 73.8077 },
          {
            slug: 'deccan-gymkhana',
            name: 'Deccan Gymkhana',
            latitude: 18.5158,
            longitude: 73.8412,
          },
          {
            slug: 'senapati-bapat-road',
            name: 'Senapati Bapat Road',
            latitude: 18.5355,
            longitude: 73.8312,
          },
          {
            slug: 'pimpri-chinchwad',
            name: 'Pimpri-Chinchwad',
            latitude: 18.6298,
            longitude: 73.7997,
          },
          { slug: 'chakan', name: 'Chakan', latitude: 18.7606, longitude: 73.8636 },
          { slug: 'alandi', name: 'Alandi', latitude: 18.6771, longitude: 73.8987 },
          { slug: 'yerwada', name: 'Yerwada', latitude: 18.5533, longitude: 73.8833 },
          { slug: 'viman-nagar', name: 'Viman Nagar', latitude: 18.5679, longitude: 73.9143 },
          { slug: 'kharadi', name: 'Kharadi', latitude: 18.5515, longitude: 73.9401 },
          { slug: 'wagholi', name: 'Wagholi', latitude: 18.5793, longitude: 73.9808 },
          { slug: 'bund-garden', name: 'Bund Garden', latitude: 18.5346, longitude: 73.8781 },
          { slug: 'camp', name: 'Camp', latitude: 18.5122, longitude: 73.8792 },
          { slug: 'koregaon-park', name: 'Koregaon Park', latitude: 18.5362, longitude: 73.8939 },
          {
            slug: 'dhole-patil-road',
            name: 'Dhole Patil Road',
            latitude: 18.5362,
            longitude: 73.8839,
          },
          { slug: 'hadapsar', name: 'Hadapsar', latitude: 18.5089, longitude: 73.926 },
          { slug: 'magarpatta', name: 'Magarpatta', latitude: 18.5158, longitude: 73.9282 },
          { slug: 'wanowrie', name: 'Wanowrie', latitude: 18.4869, longitude: 73.9013 },
          { slug: 'kondhwa', name: 'Kondhwa', latitude: 18.4636, longitude: 73.9067 },
          { slug: 'undri', name: 'Undri', latitude: 18.4569, longitude: 73.9089 },
          { slug: 'narhe', name: 'Narhe', latitude: 18.4494, longitude: 73.8212 },
          { slug: 'bibvewadi', name: 'Bibvewadi', latitude: 18.4812, longitude: 73.8633 },
          { slug: 'sinhgad-road', name: 'Sinhgad Road', latitude: 18.4722, longitude: 73.8297 },
          { slug: 'satara-road', name: 'Satara Road', latitude: 18.4789, longitude: 73.8639 },
          { slug: 'katraj', name: 'Katraj', latitude: 18.4529, longitude: 73.8553 },
          { slug: 'khed-shivapur', name: 'Khed Shivapur', latitude: 18.3317, longitude: 73.8633 },
          { slug: 'panshet', name: 'Panshet', latitude: 18.3897, longitude: 73.6106 },
          { slug: 'khadakwasla', name: 'Khadakwasla', latitude: 18.4397, longitude: 73.7736 },
        ],
      },
      {
        slug: 'lonavala',
        name: 'Lonavala',
        latitude: 18.7546,
        longitude: 73.4062,
        description:
          'Lonavala and Khandala sit on the Mumbai–Pune expressway and host the region’s densest cluster of destination wedding resorts.',
        localities: [],
      },
      {
        slug: 'karjat',
        name: 'Karjat',
        latitude: 18.9107,
        longitude: 73.3236,
        description:
          'Karjat’s riverfront and hillside resorts are a short drive from Mumbai, popular for weekend weddings and corporate offsites.',
        localities: [],
      },
      {
        slug: 'mulshi',
        name: 'Mulshi',
        latitude: 18.4894,
        longitude: 73.5108,
        description:
          'Mulshi and Tamhini Ghat offer lakeside and hillside resorts west of Pune, used for intimate destination weddings.',
        localities: [],
      },
    ],
  },
  {
    slug: 'delhi',
    name: 'Delhi',
    cities: [
      {
        slug: 'new-delhi',
        name: 'New Delhi',
        latitude: 28.6139,
        longitude: 77.209,
        description:
          'New Delhi blends heritage properties with modern banquet venues in the southern and central districts.',
        localities: [
          { slug: 'chattarpur', name: 'Chattarpur', latitude: 28.4939, longitude: 77.1817 },
          { slug: 'saket', name: 'Saket', latitude: 28.5245, longitude: 77.2066 },
        ],
      },
    ],
  },
  {
    slug: 'karnataka',
    name: 'Karnataka',
    cities: [
      {
        slug: 'bengaluru',
        name: 'Bengaluru',
        latitude: 12.9716,
        longitude: 77.5946,
        description:
          'Bengaluru’s venues and studios cluster around the tech corridors and the older garden districts.',
        localities: [
          { slug: 'koramangala', name: 'Koramangala', latitude: 12.9352, longitude: 77.6245 },
          { slug: 'whitefield', name: 'Whitefield', latitude: 12.9698, longitude: 77.75 },
        ],
      },
    ],
  },
  {
    slug: 'rajasthan',
    name: 'Rajasthan',
    cities: [
      {
        slug: 'jaipur',
        name: 'Jaipur',
        latitude: 26.9124,
        longitude: 75.7873,
        description:
          'Jaipur offers palace-adjacent heritage venues and a strong tradition of Rajasthani catering and decor.',
        localities: [
          { slug: 'amer-road', name: 'Amer Road', latitude: 26.9855, longitude: 75.8513 },
          { slug: 'civil-lines', name: 'Civil Lines', latitude: 26.9061, longitude: 75.7858 },
        ],
      },
    ],
  },
];

function buildLocations(): LocationSeed[] {
  const locations: LocationSeed[] = [
    {
      slug: COUNTRY.slug,
      name: COUNTRY.name,
      type: 'COUNTRY',
      parentSlug: null,
      path: COUNTRY.slug,
      latitude: COUNTRY.latitude,
      longitude: COUNTRY.longitude,
      description: COUNTRY.description,
      sortOrder: COUNTRY.sortOrder,
    },
  ];

  for (const state of STATES) {
    const statePath = `${COUNTRY.slug}/${state.slug}`;
    locations.push({
      slug: state.slug,
      name: state.name,
      type: 'STATE',
      parentSlug: COUNTRY.slug,
      path: statePath,
      latitude: null,
      longitude: null,
      description: null,
      sortOrder: 0,
    });

    for (const city of state.cities) {
      const cityPath = `${statePath}/${city.slug}`;
      locations.push({
        slug: city.slug,
        name: city.name,
        type: 'CITY',
        parentSlug: state.slug,
        path: cityPath,
        latitude: city.latitude,
        longitude: city.longitude,
        description: city.description,
        sortOrder: 0,
      });

      city.localities.forEach((locality, index) => {
        locations.push({
          slug: locality.slug,
          name: locality.name,
          type: 'LOCALITY',
          parentSlug: city.slug,
          path: `${cityPath}/${locality.slug}`,
          latitude: locality.latitude,
          longitude: locality.longitude,
          description: null,
          sortOrder: (index + 1) * 10,
        });
      });
    }
  }

  return locations;
}

export const LOCATION_SEEDS: readonly LocationSeed[] = buildLocations();

const LOCATION_BY_SLUG = new Map(LOCATION_SEEDS.map((location) => [location.slug, location]));

export function findLocationSeed(slug: string): LocationSeed {
  const location = LOCATION_BY_SLUG.get(slug);
  if (!location) throw new Error(`Unknown location slug in seed data: ${slug}`);
  return location;
}

/** Ancestor names, nearest first, excluding the location itself. */
export function locationAncestorNames(slug: string): string[] {
  const names: string[] = [];
  let current = findLocationSeed(slug).parentSlug;
  while (current) {
    const parent: LocationSeed = findLocationSeed(current);
    names.push(parent.name);
    current = parent.parentSlug;
  }
  return names;
}
