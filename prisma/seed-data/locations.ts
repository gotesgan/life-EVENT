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
  description: 'Live Envt currently operates across India.',
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
        localities: [
          { slug: 'koregaon-park', name: 'Koregaon Park', latitude: 18.5362, longitude: 73.8939 },
          { slug: 'baner', name: 'Baner', latitude: 18.559, longitude: 73.7868 },
        ],
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
