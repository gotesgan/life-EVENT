/**
 * The configurable attribute system.
 *
 * `ATTRIBUTE_DEFINITIONS` is the global catalogue keyed by `code`;
 * `ATTRIBUTE_BINDINGS` binds those definitions to categories with per-category
 * behaviour. An attribute code used by two categories appears **once** in the
 * catalogue and is bound twice — see `travels_to_venue`, used by both
 * photography and beauty.
 */

import type { AttributeDataType, FilterControl } from '@/generated/prisma/enums';

export interface AttributeOptionSeed {
  value: string;
  label: string;
  sortOrder: number;
}

export interface AttributeBindingDefaults {
  isFilterable: boolean;
  isRequired?: boolean;
  isSearchable?: boolean;
  isComparable?: boolean;
  /** Rendered on the search-result card for this category. */
  showOnCard?: boolean;
  filterControl: FilterControl;
  groupLabel: string;
  sortOrder: number;
}

export interface AttributeDefinitionSeed {
  code: string;
  label: string;
  dataType: AttributeDataType;
  unit: string | null;
  helpText: string | null;
  minNumber: number | null;
  maxNumber: number | null;
  options: readonly AttributeOptionSeed[];
  /** Applied to every category this definition is bound to. */
  binding: AttributeBindingDefaults;
}

export interface AttributeBindingSeed {
  categorySlug: string;
  code: string;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  isVisibleOnProfile: boolean;
  isComparable: boolean;
  showOnCard: boolean;
  filterControl: FilterControl;
  groupLabel: string;
  sortOrder: number;
}

export interface AmenitySeed {
  code: string;
  label: string;
  groupLabel: string;
  iconKey: string;
  sortOrder: number;
}

function options(values: readonly string[]): readonly AttributeOptionSeed[] {
  return values.map((value, index) => ({
    value,
    label: value
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    sortOrder: (index + 1) * 10,
  }));
}

export const ATTRIBUTE_DEFINITIONS: readonly AttributeDefinitionSeed[] = [
  {
    code: 'guest_capacity',
    label: 'Guest capacity',
    dataType: 'NUMBER',
    unit: 'guests',
    helpText: 'Maximum number of guests the venue can seat or host comfortably.',
    minNumber: 50,
    maxNumber: 5000,
    options: [],
    binding: {
      isRequired: true,
      isFilterable: true,
      isSearchable: false,
      isComparable: true,
      showOnCard: true,
      filterControl: 'RANGE',
      groupLabel: 'Capacity & spaces',
      sortOrder: 10,
    },
  },
  {
    code: 'venue_type',
    label: 'Venue type',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options([
      'banquet-hall',
      'hotel',
      'resort',
      'lawn',
      'farmhouse',
      'rooftop',
      'convention-centre',
      'heritage-property',
    ]),
    binding: {
      isFilterable: true,
      isComparable: true,
      showOnCard: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Capacity & spaces',
      sortOrder: 20,
    },
  },
  {
    code: 'indoor_outdoor',
    label: 'Indoor / outdoor',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['indoor', 'outdoor', 'both']),
    binding: {
      isFilterable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Capacity & spaces',
      sortOrder: 30,
    },
  },
  {
    code: 'catering_policy',
    label: 'Catering policy',
    dataType: 'SINGLE_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['in-house-only', 'empanelled-caterers', 'outside-catering-allowed']),
    binding: {
      isFilterable: true,
      filterControl: 'RADIO',
      groupLabel: 'Policies',
      sortOrder: 40,
    },
  },
  {
    code: 'accommodation',
    label: 'On-site accommodation',
    dataType: 'BOOLEAN',
    unit: null,
    helpText: 'Whether the venue has rooms for guests on the same property.',
    minNumber: null,
    maxNumber: null,
    options: [],
    binding: {
      isFilterable: true,
      filterControl: 'BOOLEAN',
      groupLabel: 'Facilities',
      sortOrder: 50,
    },
  },
  {
    code: 'parking_capacity',
    label: 'Parking capacity',
    dataType: 'NUMBER',
    unit: 'cars',
    helpText: null,
    minNumber: 0,
    maxNumber: 2000,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'RANGE',
      groupLabel: 'Facilities',
      sortOrder: 60,
    },
  },
  {
    code: 'number_of_spaces',
    label: 'Number of event spaces',
    dataType: 'NUMBER',
    unit: null,
    helpText: 'How many distinct halls, lawns or rooms the property can run at once.',
    minNumber: 1,
    maxNumber: 20,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'RANGE',
      groupLabel: 'Capacity & spaces',
      sortOrder: 70,
    },
  },
  {
    code: 'photography_style',
    label: 'Photography style',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options([
      'candid',
      'traditional',
      'photojournalistic',
      'editorial',
      'fine-art',
      'documentary',
    ]),
    binding: {
      isFilterable: true,
      isComparable: true,
      showOnCard: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Style',
      sortOrder: 10,
    },
  },
  {
    code: 'coverage_hours',
    label: 'Coverage hours',
    dataType: 'NUMBER',
    unit: 'hours',
    helpText: 'Hours of coverage included in the standard package.',
    minNumber: 1,
    maxNumber: 72,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'RANGE',
      groupLabel: 'Coverage',
      sortOrder: 20,
    },
  },
  {
    code: 'deliverables',
    label: 'Deliverables',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options([
      'edited-photos',
      'raw-photos',
      'highlight-film',
      'full-length-film',
      'album',
      'drone-footage',
    ]),
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Coverage',
      sortOrder: 30,
    },
  },
  {
    code: 'team_size',
    label: 'Team size',
    dataType: 'NUMBER',
    unit: 'people',
    helpText: 'Photographers and assistants who attend the event.',
    minNumber: 1,
    maxNumber: 100,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'RANGE',
      groupLabel: 'Coverage',
      sortOrder: 40,
    },
  },
  {
    code: 'planner_experience_years',
    label: 'Years of experience',
    dataType: 'NUMBER',
    unit: 'years',
    helpText: null,
    minNumber: 0,
    maxNumber: 40,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'RANGE',
      groupLabel: 'Experience',
      sortOrder: 10,
    },
  },
  {
    code: 'planning_scope',
    label: 'Planning scope',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['full-planning', 'partial-planning', 'day-coordination', 'vendor-sourcing']),
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Services',
      sortOrder: 20,
    },
  },
  {
    code: 'decor_style',
    label: 'Decor style',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options([
      'floral',
      'minimal',
      'traditional',
      'bohemian',
      'royal',
      'contemporary',
      'rustic',
    ]),
    binding: {
      isFilterable: true,
      isComparable: true,
      showOnCard: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Style',
      sortOrder: 10,
    },
  },
  {
    code: 'cuisine_speciality',
    label: 'Cuisine speciality',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options([
      'north-indian',
      'south-indian',
      'mughlai',
      'continental',
      'pan-asian',
      'rajasthani',
      'gujarati',
      'live-counters',
    ]),
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Menu',
      sortOrder: 10,
    },
  },
  {
    code: 'service_style',
    label: 'Service style',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['buffet', 'plated', 'family-style', 'live-counters', 'food-truck']),
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Menu',
      sortOrder: 20,
    },
  },
  {
    code: 'per_plate_price',
    label: 'Price per plate',
    dataType: 'NUMBER',
    unit: 'INR',
    helpText: 'Indicative per-plate price for a standard menu.',
    minNumber: 200,
    maxNumber: 20000,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      showOnCard: true,
      filterControl: 'RANGE',
      groupLabel: 'Pricing',
      sortOrder: 30,
    },
  },
  {
    code: 'makeup_service_type',
    label: 'Services offered',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options([
      'bridal-makeup',
      'engagement-makeup',
      'party-makeup',
      'hairstyling',
      'draping',
      'airbrush',
    ]),
    binding: {
      isRequired: true,
      isFilterable: true,
      isComparable: true,
      showOnCard: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Services',
      sortOrder: 10,
    },
  },
  {
    code: 'makeup_style',
    label: 'Makeup style',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['natural', 'dewy', 'glam', 'traditional', 'airbrush', 'hd']),
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Style',
      sortOrder: 20,
    },
  },
  {
    code: 'travels_to_venue',
    label: 'Travels to venue',
    dataType: 'BOOLEAN',
    unit: null,
    helpText: 'Whether the team travels to the customer’s venue or city.',
    minNumber: null,
    maxNumber: null,
    options: [],
    binding: {
      isFilterable: true,
      filterControl: 'BOOLEAN',
      groupLabel: 'Logistics',
      sortOrder: 30,
    },
  },
  {
    code: 'performance_type',
    label: 'Performance type',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['dj', 'live-band', 'anchor', 'dancer', 'instrumentalist', 'magician']),
    binding: {
      isFilterable: true,
      isComparable: true,
      showOnCard: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Performance',
      sortOrder: 10,
    },
  },
  {
    code: 'performance_duration',
    label: 'Performance duration',
    dataType: 'NUMBER',
    unit: 'hours',
    helpText: null,
    minNumber: 1,
    maxNumber: 12,
    options: [],
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'RANGE',
      groupLabel: 'Performance',
      sortOrder: 20,
    },
  },
  {
    code: 'languages',
    label: 'Languages',
    dataType: 'MULTI_SELECT',
    unit: null,
    helpText: null,
    minNumber: null,
    maxNumber: null,
    options: options(['hindi', 'english', 'marathi', 'punjabi', 'tamil', 'telugu']),
    binding: {
      isFilterable: true,
      isComparable: true,
      filterControl: 'CHECKBOX',
      groupLabel: 'Performance',
      sortOrder: 30,
    },
  },
  {
    code: 'equipment_provided',
    label: 'Equipment provided',
    dataType: 'BOOLEAN',
    unit: null,
    helpText: 'Sound, lighting and mixing equipment is supplied by the act.',
    minNumber: null,
    maxNumber: null,
    options: [],
    binding: {
      isFilterable: true,
      filterControl: 'BOOLEAN',
      groupLabel: 'Logistics',
      sortOrder: 40,
    },
  },
];

const DEFINITION_BY_CODE = new Map(
  ATTRIBUTE_DEFINITIONS.map((definition) => [definition.code, definition]),
);

function bind(categorySlugs: readonly string[], codes: readonly string[]): AttributeBindingSeed[] {
  const bindings: AttributeBindingSeed[] = [];

  for (const categorySlug of categorySlugs) {
    for (const code of codes) {
      const definition = DEFINITION_BY_CODE.get(code);
      if (!definition) throw new Error(`Unknown attribute code in seed data: ${code}`);
      const { binding } = definition;

      bindings.push({
        categorySlug,
        code,
        isRequired: binding.isRequired ?? false,
        isFilterable: binding.isFilterable,
        isSearchable: binding.isSearchable ?? false,
        isVisibleOnProfile: true,
        isComparable: binding.isComparable ?? false,
        showOnCard: binding.showOnCard ?? false,
        filterControl: binding.filterControl,
        groupLabel: binding.groupLabel,
        sortOrder: binding.sortOrder,
      });
    }
  }

  return bindings;
}

const VENUE_CATEGORIES = [
  'venues',
  'banquet-halls',
  'hotels-and-resorts',
  'lawns-and-farmhouses',
] as const;

const PHOTOGRAPHY_CATEGORIES = ['photography', 'photographers', 'videographers'] as const;

const PLANNING_CATEGORIES = ['planning-and-decor', 'wedding-planners'] as const;

const DECOR_CATEGORIES = ['planning-and-decor', 'decorators-and-florists'] as const;

const CATERING_CATEGORIES = ['catering', 'caterers', 'live-food-stations'] as const;

const BEAUTY_CATEGORIES = ['beauty', 'makeup-artists', 'hair-stylists'] as const;

const ENTERTAINMENT_CATEGORIES = ['entertainment', 'djs', 'live-bands'] as const;

export const ATTRIBUTE_BINDINGS: readonly AttributeBindingSeed[] = [
  ...bind(VENUE_CATEGORIES, [
    'guest_capacity',
    'venue_type',
    'indoor_outdoor',
    'catering_policy',
    'accommodation',
    'parking_capacity',
    'number_of_spaces',
  ]),
  ...bind(PHOTOGRAPHY_CATEGORIES, [
    'photography_style',
    'coverage_hours',
    'deliverables',
    'team_size',
    'travels_to_venue',
  ]),
  ...bind(PLANNING_CATEGORIES, ['planner_experience_years', 'planning_scope']),
  ...bind(DECOR_CATEGORIES, ['decor_style']),
  ...bind(CATERING_CATEGORIES, ['cuisine_speciality', 'service_style', 'per_plate_price']),
  ...bind(BEAUTY_CATEGORIES, ['makeup_service_type', 'makeup_style', 'travels_to_venue']),
  ...bind(ENTERTAINMENT_CATEGORIES, [
    'performance_type',
    'performance_duration',
    'languages',
    'equipment_provided',
  ]),
];

export function findAttributeDefinition(code: string): AttributeDefinitionSeed {
  const definition = DEFINITION_BY_CODE.get(code);
  if (!definition) throw new Error(`Unknown attribute code in seed data: ${code}`);
  return definition;
}

export const AMENITY_SEEDS: readonly AmenitySeed[] = [
  {
    code: 'air-conditioned',
    label: 'Fully air-conditioned',
    groupLabel: 'Facilities',
    iconKey: 'wind',
    sortOrder: 10,
  },
  {
    code: 'valet-parking',
    label: 'Valet parking',
    groupLabel: 'Facilities',
    iconKey: 'car',
    sortOrder: 20,
  },
  {
    code: 'in-house-catering',
    label: 'In-house catering',
    groupLabel: 'Facilities',
    iconKey: 'tools-kitchen',
    sortOrder: 30,
  },
  {
    code: 'bridal-suite',
    label: 'Bridal suite',
    groupLabel: 'Guest comfort',
    iconKey: 'door',
    sortOrder: 40,
  },
  {
    code: 'pool',
    label: 'Swimming pool',
    groupLabel: 'Facilities',
    iconKey: 'pool',
    sortOrder: 50,
  },
  {
    code: 'stage',
    label: 'Built-in stage',
    groupLabel: 'Entertainment',
    iconKey: 'theater',
    sortOrder: 60,
  },
  {
    code: 'av-system',
    label: 'AV and sound system',
    groupLabel: 'Entertainment',
    iconKey: 'speakerphone',
    sortOrder: 70,
  },
  {
    code: 'wheelchair-access',
    label: 'Wheelchair access',
    groupLabel: 'Guest comfort',
    iconKey: 'accessible',
    sortOrder: 80,
  },
  {
    code: 'backup-power',
    label: 'Backup power',
    groupLabel: 'Facilities',
    iconKey: 'bolt',
    sortOrder: 90,
  },
  {
    code: 'dance-floor',
    label: 'Dance floor',
    groupLabel: 'Entertainment',
    iconKey: 'music',
    sortOrder: 100,
  },
  {
    code: 'bar-service',
    label: 'Bar service',
    groupLabel: 'Entertainment',
    iconKey: 'glass',
    sortOrder: 110,
  },
  {
    code: 'pet-friendly',
    label: 'Pet friendly',
    groupLabel: 'Guest comfort',
    iconKey: 'paw',
    sortOrder: 120,
  },
];
