/**
 * Enquiry (lead) seed data.
 *
 * The overall `Enquiry.status` is never written by hand: the seed derives it
 * with the same pure function the application uses
 * (`deriveEnquiryStatus` in src/server/domain/enquiry-status.ts) and asserts
 * the result, so the seeded data can never disagree with the domain rule.
 *
 * Every contact detail is fictional: `@example.test` addresses and the
 * `+91 90000 000xx` block, which is not allocated to any operator.
 */

import type { ContactMethod, EnquiryActivityType, EnquiryStatus } from '@/generated/prisma/enums';

export interface EnquiryListingSeed {
  listingSlug: string;
  status: EnquiryStatus;
  assignedAdmin: boolean;
  /** Minutes after `createdAt`, or null when the SLA step never happened. */
  firstContactedMinutes: number | null;
  sharedWithProviderMinutes: number | null;
  convertedMinutes: number | null;
  lostMinutes: number | null;
  lostReason: string | null;
  providerResponseNote: string | null;
}

export interface EnquiryActivitySeed {
  listingSlug: string | null;
  type: EnquiryActivityType;
  fromStatus: EnquiryStatus | null;
  toStatus: EnquiryStatus | null;
  message: string;
  isCustomerVisible: boolean;
  offsetMinutes: number;
  actor: 'ADMIN' | 'CUSTOMER' | 'SYSTEM';
}

export interface EnquiryNoteSeed {
  listingSlug: string | null;
  body: string;
  offsetMinutes: number;
}

export interface EnquirySeed {
  referenceCode: string;
  customer: 'priya' | 'arjun' | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCitySlug: string;
  contactMethod: ContactMethod;
  eventTypeSlug: string | null;
  eventDate: string | null;
  eventDateFlexible: boolean;
  guestCount: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  requirements: string;
  referralSource: string;
  isPotentialDuplicate: boolean;
  assignedAdmin: boolean;
  createdAt: string;
  listings: readonly EnquiryListingSeed[];
  activities: readonly EnquiryActivitySeed[];
  notes: readonly EnquiryNoteSeed[];
}

const ADMIN = 'ADMIN' as const;
const CUSTOMER = 'CUSTOMER' as const;
const SYSTEM = 'SYSTEM' as const;

export const ENQUIRY_SEEDS: readonly EnquirySeed[] = [
  // -------------------------------------------------------------------
  // 1. Multi-provider wedding brief: venue + photographer + caterer.
  // -------------------------------------------------------------------
  {
    referenceCode: 'LE-QK7M2NRA',
    customer: 'arjun',
    contactName: 'Arjun Mehta',
    contactEmail: 'arjun@example.test',
    contactPhone: '+91 90000 00101',
    contactCitySlug: 'bandra-west',
    contactMethod: 'WHATSAPP',
    eventTypeSlug: 'wedding',
    eventDate: '2026-12-12',
    eventDateFlexible: false,
    guestCount: 450,
    budgetMin: 1500000,
    budgetMax: 3000000,
    requirements:
      'December wedding in Mumbai: a banquet venue for 450 guests, a candid photographer for both days, and a multi-cuisine caterer. Sangeet on the previous evening at the same venue.',
    referralSource: 'Organic search',
    isPotentialDuplicate: false,
    assignedAdmin: true,
    createdAt: '2026-09-18T05:30:00.000Z',
    listings: [
      {
        listingSlug: 'gulmohar-banjara-banquets',
        status: 'QUALIFIED',
        assignedAdmin: true,
        firstContactedMinutes: 360,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: 'Hall available on 11–12 December; holding until 25 September.',
      },
      {
        listingSlug: 'smriti-frame-studios',
        status: 'SHARED_WITH_PROVIDER',
        assignedAdmin: true,
        firstContactedMinutes: 360,
        sharedWithProviderMinutes: 1800,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: 'Confirmed availability for both days.',
      },
      {
        listingSlug: 'rasoi-raag-caterers',
        status: 'CONTACTED',
        assignedAdmin: true,
        firstContactedMinutes: 1680,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: null,
      },
    ],
    activities: [
      {
        listingSlug: null,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'NEW',
        message: 'Enquiry received from the wedding listing page.',
        isCustomerVisible: true,
        offsetMinutes: 0,
        actor: CUSTOMER,
      },
      {
        listingSlug: null,
        type: 'ASSIGNED',
        fromStatus: null,
        toStatus: null,
        message: 'Assigned to Platform Admin for triage.',
        isCustomerVisible: false,
        offsetMinutes: 20,
        actor: SYSTEM,
      },
      {
        listingSlug: 'gulmohar-banjara-banquets',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Called the venue; they are checking the December calendar.',
        isCustomerVisible: true,
        offsetMinutes: 360,
        actor: ADMIN,
      },
      {
        listingSlug: 'gulmohar-banjara-banquets',
        type: 'STATUS_CHANGED',
        fromStatus: 'CONTACTED',
        toStatus: 'QUALIFIED',
        message: 'Venue can host 450 with the lawn for the sangeet.',
        isCustomerVisible: true,
        offsetMinutes: 480,
        actor: ADMIN,
      },
      {
        listingSlug: 'rasoi-raag-caterers',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Sent the brief to the catering desk.',
        isCustomerVisible: true,
        offsetMinutes: 1680,
        actor: ADMIN,
      },
      {
        listingSlug: 'smriti-frame-studios',
        type: 'STATUS_CHANGED',
        fromStatus: 'QUALIFIED',
        toStatus: 'SHARED_WITH_PROVIDER',
        message: 'Customer details shared with the photographer.',
        isCustomerVisible: true,
        offsetMinutes: 1800,
        actor: ADMIN,
      },
      {
        listingSlug: 'smriti-frame-studios',
        type: 'CONTACT_DISCLOSED',
        fromStatus: null,
        toStatus: null,
        message: 'Contact channels released to Smriti Frame Studios after the share.',
        isCustomerVisible: false,
        offsetMinutes: 1801,
        actor: SYSTEM,
      },
    ],
    notes: [
      {
        listingSlug: null,
        body: 'Three-provider brief. Venue has a soft hold on 12 December; confirm by 25 September or release.',
        offsetMinutes: 90,
      },
      {
        listingSlug: 'smriti-frame-studios',
        body: 'Photographer offered a 10% discount if the pre-wedding shoot is booked in the same contract.',
        offsetMinutes: 1850,
      },
      {
        listingSlug: 'rasoi-raag-caterers',
        body: 'Caterer quote pending. Follow up Monday morning if there is no reply.',
        offsetMinutes: 1700,
      },
    ],
  },

  // -------------------------------------------------------------------
  // 2. Guest enquiry (no account) — stays NEW.
  // -------------------------------------------------------------------
  {
    referenceCode: 'LE-3BDP9TWX',
    customer: null,
    contactName: 'Kavya Raman',
    contactEmail: 'kavya.raman@example.test',
    contactPhone: '+91 90000 00102',
    contactCitySlug: 'whitefield',
    contactMethod: 'EMAIL',
    eventTypeSlug: 'wedding',
    eventDate: '2026-11-28',
    eventDateFlexible: true,
    guestCount: 300,
    budgetMin: 1000000,
    budgetMax: 2200000,
    requirements:
      'Looking for a five-star hotel in Mumbai for a November wedding, 300 guests, with rooms for about 80 outstation guests.',
    referralSource: 'Instagram',
    isPotentialDuplicate: false,
    assignedAdmin: true,
    createdAt: '2026-10-05T11:15:00.000Z',
    listings: [
      {
        listingSlug: 'the-sandalwood-grand',
        status: 'NEW',
        assignedAdmin: true,
        firstContactedMinutes: null,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: null,
      },
    ],
    activities: [
      {
        listingSlug: null,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'NEW',
        message: 'Guest enquiry received; no account attached.',
        isCustomerVisible: true,
        offsetMinutes: 0,
        actor: SYSTEM,
      },
      {
        listingSlug: null,
        type: 'ASSIGNED',
        fromStatus: null,
        toStatus: null,
        message: 'Assigned to Platform Admin for the first call.',
        isCustomerVisible: false,
        offsetMinutes: 15,
        actor: SYSTEM,
      },
    ],
    notes: [
      {
        listingSlug: null,
        body: 'Guest enquiry — verify the phone number before sharing anything with the hotel.',
        offsetMinutes: 30,
      },
    ],
  },

  // -------------------------------------------------------------------
  // 3. Linked to the seeded customer priya@example.test — CONVERTED.
  // -------------------------------------------------------------------
  {
    referenceCode: 'LE-ZM4H6CYV',
    customer: 'priya',
    contactName: 'Priya Nair',
    contactEmail: 'priya@example.test',
    contactPhone: '+91 90000 00103',
    contactCitySlug: 'bandra-west',
    contactMethod: 'PHONE',
    eventTypeSlug: 'engagement',
    eventDate: '2026-08-22',
    eventDateFlexible: false,
    guestCount: 60,
    budgetMin: 60000,
    budgetMax: 120000,
    requirements:
      'Engagement makeup and hair for the bride plus two family members, at home in Bandra West.',
    referralSource: 'Referral',
    isPotentialDuplicate: false,
    assignedAdmin: true,
    createdAt: '2026-06-02T04:45:00.000Z',
    listings: [
      {
        listingSlug: 'mirage-beauty-studio',
        status: 'CONVERTED',
        assignedAdmin: true,
        firstContactedMinutes: 240,
        sharedWithProviderMinutes: 1080,
        convertedMinutes: 4320,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: 'Trial booked and confirmed; balance payable on the day.',
      },
    ],
    activities: [
      {
        listingSlug: null,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'NEW',
        message: 'Enquiry received from the signed-in customer.',
        isCustomerVisible: true,
        offsetMinutes: 0,
        actor: CUSTOMER,
      },
      {
        listingSlug: 'mirage-beauty-studio',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Studio replied with availability for 22 August.',
        isCustomerVisible: true,
        offsetMinutes: 240,
        actor: ADMIN,
      },
      {
        listingSlug: 'mirage-beauty-studio',
        type: 'STATUS_CHANGED',
        fromStatus: 'CONTACTED',
        toStatus: 'QUALIFIED',
        message: 'Quoted for bridal plus two guest looks.',
        isCustomerVisible: true,
        offsetMinutes: 600,
        actor: ADMIN,
      },
      {
        listingSlug: 'mirage-beauty-studio',
        type: 'STATUS_CHANGED',
        fromStatus: 'QUALIFIED',
        toStatus: 'SHARED_WITH_PROVIDER',
        message: 'Customer details shared with the studio.',
        isCustomerVisible: true,
        offsetMinutes: 1080,
        actor: ADMIN,
      },
      {
        listingSlug: 'mirage-beauty-studio',
        type: 'NOTE_ADDED',
        fromStatus: null,
        toStatus: null,
        message: 'Internal margin note recorded.',
        isCustomerVisible: false,
        offsetMinutes: 1200,
        actor: ADMIN,
      },
      {
        listingSlug: 'mirage-beauty-studio',
        type: 'STATUS_CHANGED',
        fromStatus: 'SHARED_WITH_PROVIDER',
        toStatus: 'CONVERTED',
        message: 'Booking confirmed with the studio.',
        isCustomerVisible: true,
        offsetMinutes: 4320,
        actor: ADMIN,
      },
    ],
    notes: [
      {
        listingSlug: null,
        body: 'Customer prefers phone calls after 7pm. Do not call during work hours.',
        offsetMinutes: 300,
      },
      {
        listingSlug: 'mirage-beauty-studio',
        body: 'Trial on 20 August at 11am. Studio will invoice the balance directly on the event day.',
        offsetMinutes: 4400,
      },
    ],
  },

  // -------------------------------------------------------------------
  // 4. LOST — decorator quote came in above the customer's budget.
  // -------------------------------------------------------------------
  {
    referenceCode: 'LE-8RNK2FGS',
    customer: null,
    contactName: 'Rohit Bansal',
    contactEmail: 'rohit.bansal@example.test',
    contactPhone: '+91 90000 00104',
    contactCitySlug: 'amer-road',
    contactMethod: 'EMAIL',
    eventTypeSlug: 'sangeet-and-mehndi',
    eventDate: '2026-12-04',
    eventDateFlexible: true,
    guestCount: 220,
    budgetMin: 150000,
    budgetMax: 250000,
    requirements: 'Rajasthani-themed decor for a sangeet evening, marigold and brass palette.',
    referralSource: 'Google Ads',
    isPotentialDuplicate: false,
    assignedAdmin: true,
    createdAt: '2026-09-02T09:00:00.000Z',
    listings: [
      {
        listingSlug: 'dhundh-floral-and-decor',
        status: 'LOST',
        assignedAdmin: true,
        firstContactedMinutes: 300,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: 5760,
        lostReason: 'Customer chose a local decorator at a lower quote.',
        providerResponseNote: 'Minimum viable budget is around ₹4L for this scope.',
      },
    ],
    activities: [
      {
        listingSlug: null,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'NEW',
        message: 'Enquiry received from the sangeet decor page.',
        isCustomerVisible: true,
        offsetMinutes: 0,
        actor: SYSTEM,
      },
      {
        listingSlug: 'dhundh-floral-and-decor',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Designer called to discuss the palette and scope.',
        isCustomerVisible: true,
        offsetMinutes: 300,
        actor: ADMIN,
      },
      {
        listingSlug: 'dhundh-floral-and-decor',
        type: 'STATUS_CHANGED',
        fromStatus: 'CONTACTED',
        toStatus: 'LOST',
        message: 'Customer confirmed they booked another decorator.',
        isCustomerVisible: true,
        offsetMinutes: 5760,
        actor: ADMIN,
      },
      {
        listingSlug: 'dhundh-floral-and-decor',
        type: 'PROVIDER_RESPONSE_RECORDED',
        fromStatus: null,
        toStatus: null,
        message: 'Studio minimum for this scope is ₹4L.',
        isCustomerVisible: false,
        offsetMinutes: 900,
        actor: ADMIN,
      },
    ],
    notes: [
      {
        listingSlug: null,
        body: 'Budget mismatch: customer capped at ₹2.5L, shortlist started at ₹4L. Re-approach for the 2027 season.',
        offsetMinutes: 5800,
      },
    ],
  },

  // -------------------------------------------------------------------
  // 5. CONTACTED — waiting on the band.
  // -------------------------------------------------------------------
  {
    referenceCode: 'LE-TW5JX9PB',
    customer: null,
    contactName: 'Devika Shetty',
    contactEmail: 'devika.shetty@example.test',
    contactPhone: '+91 90000 00105',
    contactCitySlug: 'baner',
    contactMethod: 'WHATSAPP',
    eventTypeSlug: 'reception',
    eventDate: '2026-11-14',
    eventDateFlexible: false,
    guestCount: 500,
    budgetMin: 200000,
    budgetMax: 400000,
    requirements: 'Live band for a reception in Pune, four hours, Marathi and Hindi repertoire.',
    referralSource: 'Direct',
    isPotentialDuplicate: false,
    assignedAdmin: true,
    createdAt: '2026-09-27T13:20:00.000Z',
    listings: [
      {
        listingSlug: 'raag-bahar-live-band',
        status: 'CONTACTED',
        assignedAdmin: true,
        firstContactedMinutes: 180,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: 'Waiting on the final guest count before quoting the PA package.',
      },
    ],
    activities: [
      {
        listingSlug: null,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'NEW',
        message: 'Enquiry received for live band coverage.',
        isCustomerVisible: true,
        offsetMinutes: 0,
        actor: SYSTEM,
      },
      {
        listingSlug: 'raag-bahar-live-band',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Band manager briefed on the date and repertoire.',
        isCustomerVisible: true,
        offsetMinutes: 180,
        actor: ADMIN,
      },
      {
        listingSlug: 'raag-bahar-live-band',
        type: 'NOTE_ADDED',
        fromStatus: null,
        toStatus: null,
        message: 'Internal note: band is holding the date informally.',
        isCustomerVisible: false,
        offsetMinutes: 240,
        actor: ADMIN,
      },
    ],
    notes: [
      {
        listingSlug: null,
        body: 'Band will not confirm until the guest count is final. Chase the customer on 5 October.',
        offsetMinutes: 260,
      },
    ],
  },

  // -------------------------------------------------------------------
  // 6. QUALIFIED and flagged as a potential duplicate of enquiry 2.
  // -------------------------------------------------------------------
  {
    referenceCode: 'LE-VC6QK3DZ',
    customer: null,
    contactName: 'Kavya Raman',
    contactEmail: 'kavya.raman@example.test',
    contactPhone: '+91 90000 00102',
    contactCitySlug: 'whitefield',
    contactMethod: 'EMAIL',
    eventTypeSlug: 'wedding',
    eventDate: '2026-11-28',
    eventDateFlexible: true,
    guestCount: 300,
    budgetMin: 1000000,
    budgetMax: 2200000,
    requirements:
      'Following up on the November wedding: also need floral decor for the mandap and a DJ for the sangeet.',
    referralSource: 'Instagram',
    isPotentialDuplicate: true,
    assignedAdmin: true,
    createdAt: '2026-10-06T06:05:00.000Z',
    listings: [
      {
        listingSlug: 'phoolpatte-designs',
        status: 'QUALIFIED',
        assignedAdmin: true,
        firstContactedMinutes: 420,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: null,
      },
      {
        listingSlug: 'skyline-sound-djs',
        status: 'CONTACTED',
        assignedAdmin: true,
        firstContactedMinutes: 540,
        sharedWithProviderMinutes: null,
        convertedMinutes: null,
        lostMinutes: null,
        lostReason: null,
        providerResponseNote: null,
      },
    ],
    activities: [
      {
        listingSlug: null,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'NEW',
        message: 'Second enquiry received from the same contact details.',
        isCustomerVisible: true,
        offsetMinutes: 0,
        actor: SYSTEM,
      },
      {
        listingSlug: null,
        type: 'DUPLICATE_FLAGGED',
        fromStatus: null,
        toStatus: null,
        message: 'Same email address and event date as LE-3BDP9TWX.',
        isCustomerVisible: false,
        offsetMinutes: 30,
        actor: SYSTEM,
      },
      {
        listingSlug: 'phoolpatte-designs',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'Decor studio briefed on the mandap scope.',
        isCustomerVisible: true,
        offsetMinutes: 420,
        actor: ADMIN,
      },
      {
        listingSlug: 'phoolpatte-designs',
        type: 'STATUS_CHANGED',
        fromStatus: 'CONTACTED',
        toStatus: 'QUALIFIED',
        message: 'Studio can cover the date and has sent a concept note.',
        isCustomerVisible: true,
        offsetMinutes: 900,
        actor: ADMIN,
      },
      {
        listingSlug: 'skyline-sound-djs',
        type: 'STATUS_CHANGED',
        fromStatus: 'NEW',
        toStatus: 'CONTACTED',
        message: 'DJ crew asked for the sangeet timeline.',
        isCustomerVisible: true,
        offsetMinutes: 540,
        actor: ADMIN,
      },
    ],
    notes: [
      {
        listingSlug: null,
        body: 'Potential duplicate of LE-3BDP9TWX (same email and date). Confirm with the customer before merging.',
        offsetMinutes: 45,
      },
      {
        listingSlug: 'skyline-sound-djs',
        body: 'Crew is available but wants the venue sound limit before confirming.',
        offsetMinutes: 600,
      },
    ],
  },
];
