import 'server-only';
import { prisma } from '@/lib/db';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { buildPaginated } from '@/lib/pagination';
import type { CreateEnquiryInput } from '@/lib/validation/enquiry';
import {
  generateReferenceCode,
  hashIp,
  hashPayload,
  normaliseEmail,
  normalisePhone,
} from '@/server/domain/contact';
import { deriveContactDisclosure } from '@/server/domain/contact';
import {
  CUSTOMER_CANCELLABLE_STATUSES,
  CUSTOMER_STATUS_DESCRIPTIONS,
  CUSTOMER_STATUS_LABELS,
  canCustomerCancel,
  deriveEnquiryStatus,
  type EnquiryStatusValue,
} from '@/server/domain/enquiry-status';
import { getServerEnv } from '@/lib/env';
import {
  enforceRateLimit,
  pruneExpiredRateLimitBuckets,
} from '@/server/services/rate-limit.service';
import {
  attachIdempotencyResult,
  claimIdempotencyKey,
  findIdempotencyClaim,
  pruneExpiredIdempotencyKeys,
  releaseIdempotencyKey,
} from '@/server/services/idempotency.service';
import { sendNotification } from '@/server/services/notification.service';
import type {
  CustomerEnquiryDetail,
  CustomerEnquiryListingView,
  CustomerEnquirySummary,
  TrackedEnquiryView,
} from '@/server/dto/enquiry.dto';

/** Window inside which an identical enquiry is treated as a duplicate. */
const DUPLICATE_WINDOW_MINUTES = 15;
/** Window inside which a same-contact enquiry is flagged for admin review. */
const FLAG_WINDOW_HOURS = 24;
const MAX_LISTINGS_PER_ENQUIRY = 10;

export interface EnquirySubmissionContext {
  /** Present when the submitter is signed in; null for a guest enquiry. */
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** Optional `Idempotency-Key` header value. */
  idempotencyKey: string | null;
}

export interface EnquirySubmissionResult {
  referenceCode: string;
  status: EnquiryStatusValue;
  /** True when an existing enquiry was returned instead of creating a new one. */
  duplicate: boolean;
  listingNames: string[];
}

/**
 * Creates a customer enquiry — the platform's core business action.
 *
 * Order of operations matters and is deliberate:
 *  1. rate limit before doing any work, so abuse is cheap to reject;
 *  2. claim the idempotency key with a single atomic insert, so a retry storm
 *     cannot create duplicate leads;
 *  3. resolve and authorise the target listings (published only);
 *  4. detect semantically identical submissions;
 *  5. write the brief, its per-provider leads and their initial history in one
 *     transaction, deriving the overall status from the children.
 */
export async function createEnquiry(
  input: CreateEnquiryInput,
  context: EnquirySubmissionContext,
): Promise<EnquirySubmissionResult> {
  const env = getServerEnv();
  const ipHash = hashIp(context.ipAddress, env.IP_HASH_SALT);
  const email = normaliseEmail(input.contactEmail);
  const phoneNormalised = normalisePhone(input.contactPhone);

  const windowSeconds = env.RATE_LIMIT_WINDOW_SECONDS;

  await enforceRateLimit(
    {
      key: `enquiry:ip:${ipHash ?? 'unknown'}`,
      limit: env.RATE_LIMIT_ENQUIRY_PER_IP,
      windowSeconds,
    },
    'You have sent several enquiries already. Please try again a little later.',
  );

  await enforceRateLimit(
    {
      key: `enquiry:email:${email}`,
      limit: env.RATE_LIMIT_ENQUIRY_PER_EMAIL,
      windowSeconds,
    },
    'You have sent several enquiries already. Please try again a little later.',
  );

  // Honeypot: a bot that fills the hidden field gets a normal-looking response
  // and a stored SPAM lead, so it has nothing to learn from the reply.
  const isHoneypotTripped = (input.companyWebsite ?? '').length > 0;

  const idempotencyScope = 'enquiry.create';
  const requestHash = hashPayload({
    listings: [...input.listings].sort(),
    email,
    phoneNormalised,
    eventDate: input.eventDate ? input.eventDate.toISOString() : null,
    requirements: input.requirements ?? null,
  });

  let idempotencyKey = context.idempotencyKey;
  if (!idempotencyKey) {
    // Without a client-supplied key, derive a stable one from the intent plus a
    // coarse time bucket. Retries inside the same bucket collapse into one lead.
    const bucket = Math.floor(Date.now() / (DUPLICATE_WINDOW_MINUTES * 60 * 1000));
    idempotencyKey = `derived:${requestHash}:${bucket}`;
  }

  // The key is *inspected* before validation but only *claimed* after it.
  //
  // Claiming first meant a rejected submission — a typo'd business address, a
  // missing field — burned the key for its whole retention window, so the
  // customer's corrected retry was answered with "that enquiry was already
  // submitted" for an enquiry that was never created. The key must only be spent
  // on an intent that is actually going to be attempted.
  //
  // But a key that has *already* been used with a different payload is a client
  // bug, and that must be reported as such before the body is validated:
  // otherwise changing the body to something invalid hides the real problem
  // behind a field error. So the existing claim is read first, then validation
  // runs, then the key is taken.
  const prior = await findIdempotencyClaim(idempotencyKey, idempotencyScope);
  if (prior && prior.requestHash !== requestHash) {
    throw new ConflictError(
      'This idempotency key was already used with a different enquiry. Use a new key for a new enquiry.',
    );
  }
  if (prior && prior.enquiryId === null) {
    // A previous attempt claimed the key but never produced an enquiry — it
    // failed, or the process died in between. That is not a commitment, so
    // release it and let this attempt own it.
    await releaseIdempotencyKey(idempotencyKey, idempotencyScope);
  }

  const listings = await resolveEnquiryListings(input.listings);

  const claim = await claimOrRecoverKey({
    key: idempotencyKey,
    scope: idempotencyScope,
    requestHash,
  });

  if (claim.state === 'mismatch') {
    throw new ConflictError(
      'This idempotency key was already used with a different enquiry. Use a new key for a new enquiry.',
    );
  }

  if (claim.state === 'fulfilled') {
    return {
      referenceCode: claim.enquiry.referenceCode,
      status: claim.enquiry.status,
      duplicate: true,
      listingNames: claim.enquiry.listingNames,
    };
  }

  const duplicate = await findRecentDuplicate({
    email,
    phoneNormalised,
    listingIds: listings.map((listing) => listing.id),
  });

  if (duplicate) {
    await attachIdempotencyResult(idempotencyKey, idempotencyScope, duplicate.id);
    return {
      referenceCode: duplicate.referenceCode,
      status: duplicate.status,
      duplicate: true,
      listingNames: duplicate.listings.map((row) => row.listing.name),
    };
  }

  const flaggedAsDuplicate = await hasRecentContactEnquiry(email, phoneNormalised);

  const contactCity = input.contactCitySlug
    ? await prisma.location.findUnique({
        where: { slug: input.contactCitySlug },
        select: { id: true },
      })
    : null;

  if (input.contactCitySlug && !contactCity) {
    throw new ValidationError('That city could not be found', {
      contactCitySlug: input.contactCitySlug,
    });
  }

  const eventType = input.eventTypeSlug
    ? await prisma.eventType.findUnique({
        where: { slug: input.eventTypeSlug },
        select: { id: true, name: true },
      })
    : null;

  if (input.eventTypeSlug && !eventType) {
    throw new ValidationError('That event type could not be found', {
      eventTypeSlug: input.eventTypeSlug,
    });
  }

  const initialStatus: EnquiryStatusValue = isHoneypotTripped ? 'SPAM' : 'NEW';

  const created = await prisma.$transaction(async (tx) => {
    const referenceCode = await generateUniqueReferenceCode(tx);

    const enquiry = await tx.enquiry.create({
      data: {
        referenceCode,
        customerUserId: context.actorUserId,
        contactName: input.contactName,
        contactEmail: email,
        contactPhone: input.contactPhone,
        contactPhoneNormalised: phoneNormalised,
        contactCityId: contactCity?.id ?? null,
        contactMethod: input.contactMethod,
        eventTypeId: eventType?.id ?? null,
        eventDate: input.eventDate ?? null,
        eventDateFlexible: input.eventDateFlexible,
        guestCount: input.guestCount ?? null,
        budgetMin: input.budgetMin ?? null,
        budgetMax: input.budgetMax ?? null,
        requirements: input.requirements ?? null,
        referralSource: input.referralSource ?? null,
        status: deriveEnquiryStatus(listings.map(() => initialStatus)),
        isPotentialDuplicate: flaggedAsDuplicate,
        consentPrivacy: input.consentPrivacy,
        consentPolicyVersion: input.consentPolicyVersion,
        consentedAt: new Date(),
        source: 'WEB',
        submittedIpHash: ipHash,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
        listings: {
          create: listings.map((listing, index) => ({
            listingId: listing.id,
            status: initialStatus,
            sortOrder: index,
          })),
        },
      },
      select: {
        id: true,
        referenceCode: true,
        status: true,
        listings: { select: { id: true, listingId: true } },
      },
    });

    await tx.enquiryActivity.createMany({
      data: [
        {
          enquiryId: enquiry.id,
          type: 'CREATED',
          toStatus: initialStatus,
          message: `Enquiry submitted for ${listings.length} ${listings.length === 1 ? 'business' : 'businesses'}`,
          // The customer should be able to see that their enquiry arrived.
          isCustomerVisible: true,
          actorUserId: context.actorUserId,
          actorName: input.contactName,
          metadata: { listingIds: listings.map((listing) => listing.id) },
        },
        ...(flaggedAsDuplicate
          ? [
              {
                enquiryId: enquiry.id,
                type: 'DUPLICATE_FLAGGED' as const,
                message: 'Same contact submitted another enquiry in the last 24 hours',
                // Internal only: never shown to the customer.
                isCustomerVisible: false,
              },
            ]
          : []),
      ],
    });

    return enquiry;
  });

  await attachIdempotencyResult(idempotencyKey, idempotencyScope, created.id);

  // Fire-and-forget: a notification failure must never fail a committed lead.
  await sendNotification((port) =>
    port.enquiryCreated({
      enquiryId: created.id,
      referenceCode: created.referenceCode,
      customerName: input.contactName,
      customerEmail: email,
      listingNames: listings.map((listing) => listing.name),
      eventDate: input.eventDate ?? null,
    }),
  );

  await Promise.all([pruneExpiredRateLimitBuckets(), pruneExpiredIdempotencyKeys()]);

  return {
    referenceCode: created.referenceCode,
    status: created.status,
    duplicate: false,
    listingNames: listings.map((listing) => listing.name),
  };
}

interface ClaimOrRecoverInput {
  key: string;
  scope: string;
  requestHash: string;
}

type ClaimOutcome =
  | { state: 'claimed' }
  | { state: 'mismatch' }
  | {
      state: 'fulfilled';
      enquiry: { referenceCode: string; status: EnquiryStatusValue; listingNames: string[] };
    };

/**
 * Claims the key, or recovers the outcome of a previous claim.
 *
 * Three cases matter:
 *  - the key is free → this attempt owns it;
 *  - the key was claimed by an attempt that produced an enquiry → replay that
 *    enquiry, so a retry cannot create a second lead;
 *  - the key was claimed but never fulfilled (the request failed, or the process
 *    died between the claim and the insert) → release it and take it over. A
 *    claim with no enquiry behind it is not a commitment, and treating it as one
 *    is what turns a correctable error into a lost lead.
 */
async function claimOrRecoverKey(input: ClaimOrRecoverInput): Promise<ClaimOutcome> {
  const first = await claimIdempotencyKey(input);
  if (first.state === 'claimed') return { state: 'claimed' };
  if (first.state === 'mismatch') return { state: 'mismatch' };

  const existing = first.enquiryId
    ? await prisma.enquiry.findUnique({
        where: { id: first.enquiryId },
        select: {
          referenceCode: true,
          status: true,
          listings: { select: { listing: { select: { name: true } } } },
        },
      })
    : null;

  if (existing) {
    return {
      state: 'fulfilled',
      enquiry: {
        referenceCode: existing.referenceCode,
        status: existing.status,
        listingNames: existing.listings.map((row) => row.listing.name),
      },
    };
  }

  await releaseIdempotencyKey(input.key, input.scope);
  const retry = await claimIdempotencyKey(input);
  if (retry.state === 'claimed') return { state: 'claimed' };

  throw new ConflictError('That enquiry was already submitted');
}

/** Resolves listing slugs, refusing anything not publicly visible. */
async function resolveEnquiryListings(slugs: readonly string[]) {
  if (slugs.length > MAX_LISTINGS_PER_ENQUIRY) {
    throw new ValidationError(
      `You can enquire with up to ${MAX_LISTINGS_PER_ENQUIRY} businesses at once`,
    );
  }

  const listings = await prisma.businessListing.findMany({
    where: { slug: { in: [...slugs] } },
    select: { id: true, slug: true, name: true, publicationStatus: true, archivedAt: true },
  });

  const foundSlugs = new Set(listings.map((listing) => listing.slug));
  const missing = slugs.filter((slug) => !foundSlugs.has(slug));
  if (missing.length > 0) {
    throw new ValidationError('Some businesses could not be found', { listings: missing });
  }

  const unavailable = listings.filter(
    (listing) => listing.publicationStatus !== 'PUBLISHED' || listing.archivedAt !== null,
  );
  if (unavailable.length > 0) {
    throw new ValidationError('Some businesses are no longer accepting enquiries', {
      listings: unavailable.map((listing) => listing.slug),
    });
  }

  // Preserve the order the customer chose so the confirmation reads sensibly.
  const bySlug = new Map(listings.map((listing) => [listing.slug, listing]));
  return slugs.map((slug) => bySlug.get(slug)!);
}

async function generateUniqueReferenceCode(tx: {
  enquiry: { findUnique: (args: { where: { referenceCode: string } }) => Promise<unknown> };
}): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferenceCode();
    const existing = await tx.enquiry.findUnique({ where: { referenceCode: code } });
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique enquiry reference');
}

/** An enquiry with the same contact and the same listing set, very recently. */
async function findRecentDuplicate(input: {
  email: string;
  phoneNormalised: string;
  listingIds: readonly string[];
}) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000);

  const candidates = await prisma.enquiry.findMany({
    where: {
      createdAt: { gte: since },
      OR: [
        { contactEmail: input.email },
        ...(input.phoneNormalised.length >= 10
          ? [{ contactPhoneNormalised: input.phoneNormalised }]
          : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      referenceCode: true,
      status: true,
      listings: { select: { listingId: true, listing: { select: { name: true } } } },
    },
  });

  const wanted = new Set(input.listingIds);

  return (
    candidates.find((candidate) => {
      const ids = new Set(candidate.listings.map((row) => row.listingId));
      if (ids.size !== wanted.size) return false;
      for (const id of wanted) if (!ids.has(id)) return false;
      return true;
    }) ?? null
  );
}

/** Same contact, any listing, recently — used to flag for admin review only. */
async function hasRecentContactEnquiry(email: string, phoneNormalised: string): Promise<boolean> {
  const since = new Date(Date.now() - FLAG_WINDOW_HOURS * 60 * 60 * 1000);

  const count = await prisma.enquiry.count({
    where: {
      createdAt: { gte: since },
      OR: [
        { contactEmail: email },
        ...(phoneNormalised.length >= 10 ? [{ contactPhoneNormalised: phoneNormalised }] : []),
      ],
    },
  });

  return count > 0;
}

// ---------------------------------------------------------------------------
// Customer reads
// ---------------------------------------------------------------------------

const customerEnquirySelect = {
  referenceCode: true,
  status: true,
  createdAt: true,
  eventDate: true,
  eventDateFlexible: true,
  guestCount: true,
  budgetMin: true,
  budgetMax: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  contactMethod: true,
  requirements: true,
  contactCity: { select: { name: true } },
  eventType: { select: { name: true } },
  listings: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      status: true,
      listing: {
        select: {
          id: true,
          name: true,
          slug: true,
          contactPhone: true,
          contactEmail: true,
          contactWhatsapp: true,
          websiteUrl: true,
          showPhone: true,
          showEmail: true,
          showWhatsapp: true,
          showWebsite: true,
          primaryCategory: { select: { name: true } },
          primaryLocation: { select: { name: true } },
        },
      },
    },
  },
} as const;

type CustomerEnquiryRow = {
  referenceCode: string;
  status: EnquiryStatusValue;
  createdAt: Date;
  eventDate: Date | null;
  eventDateFlexible: boolean;
  guestCount: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactMethod: (typeof import('@/generated/prisma/enums').ContactMethod)[keyof typeof import('@/generated/prisma/enums').ContactMethod];
  requirements: string | null;
  contactCity: { name: string } | null;
  eventType: { name: string } | null;
  listings: Array<{
    status: EnquiryStatusValue;
    listing: {
      id: string;
      name: string;
      slug: string;
      contactPhone: string | null;
      contactEmail: string | null;
      contactWhatsapp: string | null;
      websiteUrl: string | null;
      showPhone: boolean;
      showEmail: boolean;
      showWhatsapp: boolean;
      showWebsite: boolean;
      primaryCategory: { name: string } | null;
      primaryLocation: { name: string } | null;
    };
  }>;
};

function toCustomerListingView(
  row: CustomerEnquiryRow['listings'][number],
): CustomerEnquiryListingView {
  const disclosure = deriveContactDisclosure(
    {
      contactPhone: row.listing.contactPhone,
      contactEmail: row.listing.contactEmail,
      contactWhatsapp: row.listing.contactWhatsapp,
      websiteUrl: row.listing.websiteUrl,
      showPhone: row.listing.showPhone,
      showEmail: row.listing.showEmail,
      showWhatsapp: row.listing.showWhatsapp,
      showWebsite: row.listing.showWebsite,
    },
    row.status,
  );

  return {
    listingId: row.listing.id,
    name: row.listing.name,
    slug: row.listing.slug,
    categoryName: row.listing.primaryCategory?.name ?? null,
    locationName: row.listing.primaryLocation?.name ?? null,
    statusLabel: CUSTOMER_STATUS_LABELS[row.status],
    statusDescription: CUSTOMER_STATUS_DESCRIPTIONS[row.status],
    contact: {
      phone: disclosure.phone,
      email: disclosure.email,
      whatsapp: disclosure.whatsapp,
      website: disclosure.website,
      message: disclosure.hasWithheldChannels
        ? 'We will share this business\u2019s direct contact details once they have confirmed availability.'
        : null,
    },
  };
}

function toCustomerSummary(row: CustomerEnquiryRow): CustomerEnquirySummary {
  return {
    referenceCode: row.referenceCode,
    status: row.status,
    statusLabel: CUSTOMER_STATUS_LABELS[row.status],
    statusDescription: CUSTOMER_STATUS_DESCRIPTIONS[row.status],
    createdAt: row.createdAt,
    eventDate: row.eventDate,
    eventDateFlexible: row.eventDateFlexible,
    eventTypeName: row.eventType?.name ?? null,
    guestCount: row.guestCount,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    listings: row.listings.map(toCustomerListingView),
  };
}

/**
 * Lists the signed-in customer's own enquiries.
 *
 * Ownership is applied in the `where` clause, never as a filter after the
 * fetch — a customer cannot cause another customer's rows to be loaded at all.
 */
export async function listCustomerEnquiries(
  customerUserId: string,
  query: { page: number; pageSize: number; status?: EnquiryStatusValue },
) {
  const where = {
    customerUserId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [rows, totalItems] = await prisma.$transaction([
    prisma.enquiry.findMany({
      where,
      // `id` is the tie-break: `createdAt` is not unique, and offset
      // pagination has no defined order between equal timestamps.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: customerEnquirySelect,
    }),
    prisma.enquiry.count({ where }),
  ]);

  const paginated = buildPaginated(rows, totalItems, query.page, query.pageSize);
  return {
    ...paginated,
    data: (rows as CustomerEnquiryRow[]).map(toCustomerSummary),
  };
}

export async function getCustomerEnquiry(
  customerUserId: string,
  referenceCode: string,
): Promise<CustomerEnquiryDetail> {
  const row = (await prisma.enquiry.findFirst({
    where: { referenceCode, customerUserId },
    select: {
      ...customerEnquirySelect,
      id: true,
      activities: {
        where: { isCustomerVisible: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          createdAt: true,
          message: true,
          enquiryListing: { select: { listing: { select: { name: true } } } },
        },
      },
    },
  })) as
    | (CustomerEnquiryRow & {
        id: string;
        activities: Array<{
          id: string;
          type: string;
          createdAt: Date;
          message: string | null;
          enquiryListing: { listing: { name: string } } | null;
        }>;
      })
    | null;

  if (!row) throw new NotFoundError('Enquiry');

  return {
    ...toCustomerSummary(row),
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    contactMethod: row.contactMethod,
    contactCityName: row.contactCity?.name ?? null,
    requirements: row.requirements,
    canCancel: row.listings.some((listing) => canCustomerCancel(listing.status)),
    timeline: row.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      at: activity.createdAt,
      message: activity.message,
      listingName: activity.enquiryListing?.listing.name ?? null,
    })),
  };
}

/**
 * Customer-initiated cancellation.
 *
 * Allowed only while the lead is still in a cancellable stage: once details
 * have been shared with a provider, cancelling would leave the provider with a
 * lead the platform claims is withdrawn, so that is an administrator action.
 */
export async function cancelCustomerEnquiry(
  customerUserId: string,
  referenceCode: string,
  reason?: string,
) {
  const enquiry = await prisma.enquiry.findFirst({
    where: { referenceCode, customerUserId },
    select: { id: true, referenceCode: true, listings: { select: { id: true, status: true } } },
  });

  if (!enquiry) throw new NotFoundError('Enquiry');

  const cancellable = enquiry.listings.filter((listing) => canCustomerCancel(listing.status));
  if (cancellable.length === 0) {
    throw new ConflictError(
      'This enquiry can no longer be cancelled online because the business is already in contact. Please reply to their message instead.',
    );
  }

  return prisma.$transaction(async (tx) => {
    // The status is re-asserted in the WHERE clause rather than trusted from the
    // read above. An administrator can move a lead to `SHARED_WITH_PROVIDER`
    // between that read and this write, and cancelling a lead the provider has
    // already been given would tell the platform the customer withdrew while the
    // provider is acting on it. A conditional update makes the check and the
    // write one operation, so that race cannot happen.
    const cancelled = await tx.enquiryListing.updateMany({
      where: {
        id: { in: cancellable.map((listing) => listing.id) },
        status: { in: [...CUSTOMER_CANCELLABLE_STATUSES] },
      },
      data: { status: 'CANCELLED' },
    });

    if (cancelled.count === 0) {
      throw new ConflictError(
        'This enquiry can no longer be cancelled online because the business is already in contact. Please reply to their message instead.',
      );
    }

    const remaining = await tx.enquiryListing.findMany({
      where: { enquiryId: enquiry.id },
      select: { status: true },
    });

    const overall = deriveEnquiryStatus(remaining.map((row) => row.status));

    await tx.enquiry.update({ where: { id: enquiry.id }, data: { status: overall } });

    await tx.enquiryActivity.create({
      data: {
        enquiryId: enquiry.id,
        type: 'CANCELLED_BY_CUSTOMER',
        toStatus: 'CANCELLED',
        message: reason ?? 'Cancelled by the customer',
        isCustomerVisible: true,
        actorUserId: customerUserId,
      },
    });

    return { referenceCode: enquiry.referenceCode, status: overall };
  });
}

/**
 * Guest progress tracking.
 *
 * Requires BOTH the reference code and the contact email. Knowing the code
 * alone, or the email alone, reveals nothing.
 */
export async function trackEnquiry(input: {
  referenceCode: string;
  email: string;
}): Promise<TrackedEnquiryView> {
  const email = normaliseEmail(input.email);

  // Rate limited so the pair cannot be brute-forced.
  await enforceRateLimit(
    {
      key: `track:${hashIp(email, getServerEnv().IP_HASH_SALT) ?? email}`,
      limit: 10,
      windowSeconds: 900,
    },
    'Too many tracking attempts. Please try again later.',
  );

  const enquiry = await prisma.enquiry.findFirst({
    where: { referenceCode: input.referenceCode, contactEmail: email },
    select: {
      referenceCode: true,
      status: true,
      createdAt: true,
      eventDate: true,
      listings: {
        orderBy: { sortOrder: 'asc' },
        select: { status: true, listing: { select: { name: true, slug: true } } },
      },
    },
  });

  if (!enquiry) {
    // Deliberately identical to "not found" so the endpoint cannot be used to
    // confirm that a reference code exists.
    throw new NotFoundError(
      'Enquiry',
      'We could not find an enquiry with that reference and email address',
    );
  }

  return {
    referenceCode: enquiry.referenceCode,
    status: enquiry.status,
    statusLabel: CUSTOMER_STATUS_LABELS[enquiry.status],
    statusDescription: CUSTOMER_STATUS_DESCRIPTIONS[enquiry.status],
    createdAt: enquiry.createdAt,
    eventDate: enquiry.eventDate,
    listings: enquiry.listings.map((row) => ({
      name: row.listing.name,
      slug: row.listing.slug,
      statusLabel: CUSTOMER_STATUS_LABELS[row.status],
    })),
  };
}
