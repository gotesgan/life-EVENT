import { Client } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as cancelEnquiry } from '@/app/api/enquiries/[referenceCode]/cancel/route';
import { GET as getEnquiry } from '@/app/api/enquiries/[referenceCode]/route';
import { POST as createEnquiry } from '@/app/api/enquiries/route';
import { POST as changeStatus } from '@/app/api/admin/enquiries/[id]/status/route';
import {
  SEEDED_LISTINGS,
  SEEDED_USERS,
  clearRuntimeState,
  jsonRequest,
  makeRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
} from './api-helpers';
import { uniquePhone, uniqueSlug } from '../integration/helpers';
import { testDatabaseUrl } from '../setup/integration';

/**
 * `POST /api/enquiries/[referenceCode]/cancel` — customer cancellation.
 *
 * A customer may cancel while the lead is still NEW/CONTACTED/QUALIFIED, and
 * cancellation must recompute the parent enquiry status and write a
 * customer-visible activity row. Once the lead is SHARED_WITH_PROVIDER or
 * CONVERTED the customer may no longer cancel it. The guarded write — the
 * status re-check in the `WHERE` clause — is exercised with a real concurrent
 * row lock rather than a mock.
 */

interface CancelBody {
  data: { referenceCode: string; status: string };
}

interface EnquiryDetailBody {
  data: {
    canCancel: boolean;
    status: string;
    timeline: Array<{ type: string; message: string | null }>;
  };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

interface SeededEnquiry {
  referenceCode: string;
  enquiryId: string;
  leadIds: string[];
}

async function seedCustomerEnquiry(
  cookie: string,
  email: string,
  listings: readonly string[] = [SEEDED_LISTINGS.published],
): Promise<SeededEnquiry> {
  const response = await createEnquiry(
    jsonRequest(
      '/api/enquiries',
      'POST',
      {
        listings: [...listings],
        contactName: 'Cancellation Guest',
        contactEmail: email,
        contactPhone: uniquePhone(),
        consentPrivacy: true,
      },
      { ...withCookie(cookie), 'idempotency-key': uniqueSlug('cancel-key') },
    ),
    routeContext({}),
  );
  expect(response.status).toBe(201);
  const body = await readJson<{ data: { referenceCode: string } }>(response);

  const { prisma } = await import('@/lib/db');
  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { referenceCode: body.data.referenceCode },
    select: {
      id: true,
      listings: { select: { id: true }, orderBy: { sortOrder: 'asc' } },
    },
  });

  return {
    referenceCode: body.data.referenceCode,
    enquiryId: enquiry.id,
    leadIds: enquiry.listings.map((lead) => lead.id),
  };
}

async function callCancel(
  referenceCode: string,
  cookie: string | null,
  body: Record<string, unknown> = {},
): Promise<{ status: number; body: CancelBody & ApiErrorResponse }> {
  const headers = cookie ? withCookie(cookie) : {};
  const response = await cancelEnquiry(
    jsonRequest(`/api/enquiries/${referenceCode}/cancel`, 'POST', body, headers),
    routeContext({ referenceCode }),
  );
  return {
    status: response.status,
    body: await readJson<CancelBody & ApiErrorResponse>(response),
  };
}

async function moveLead(
  enquiryId: string,
  leadId: string,
  status: 'QUALIFIED' | 'SHARED_WITH_PROVIDER' | 'CONVERTED',
  adminCookie: string,
): Promise<void> {
  const response = await changeStatus(
    jsonRequest(
      `/api/admin/enquiries/${enquiryId}/status`,
      'POST',
      { status, enquiryListingId: leadId, isCustomerVisible: true },
      withCookie(adminCookie),
    ),
    routeContext({ id: enquiryId }),
  );
  expect(response.status).toBe(200);
}

async function publishedSlugs(count: number): Promise<string[]> {
  const { prisma } = await import('@/lib/db');
  const rows = await prisma.businessListing.findMany({
    where: { publicationStatus: 'PUBLISHED', archivedAt: null },
    select: { slug: true },
    orderBy: { slug: 'asc' },
    take: count,
  });
  expect(rows.length).toBeGreaterThanOrEqual(count);
  return rows.map((row) => row.slug);
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('cancellation authorization and ownership', () => {
  it('returns 401 without a session', async () => {
    const priya = await signInAsCustomer('priya');
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);

    const { status, body } = await callCancel(seeded.referenceCode, null);
    expect(status).toBe(401);
    expect(errorOf(body).code).toBe('UNAUTHENTICATED');
  });

  it("returns 404 for another customer's enquiry", async () => {
    const priya = await signInAsCustomer('priya');
    const arjun = await signInAsCustomer('arjun');
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);

    const { status, body } = await callCancel(seeded.referenceCode, arjun.cookie);
    expect(status).toBe(404);
    expect(errorOf(body).code).toBe('NOT_FOUND');

    const { prisma } = await import('@/lib/db');
    const enquiry = await prisma.enquiry.findUniqueOrThrow({
      where: { id: seeded.enquiryId },
      select: { status: true },
    });
    expect(enquiry.status).toBe('NEW');
  });
});

describe('cancelling a cancellable lead', () => {
  it('cancels a NEW lead, recomputes the enquiry status and writes a visible activity row', async () => {
    const priya = await signInAsCustomer('priya');
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);

    const { status, body } = await callCancel(seeded.referenceCode, priya.cookie, {
      reason: 'Found another venue',
    });

    expect(status).toBe(200);
    expect(body.data.status).toBe('CANCELLED');

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: seeded.leadIds[0]! },
      select: { status: true },
    });
    expect(lead.status).toBe('CANCELLED');

    const enquiry = await prisma.enquiry.findUniqueOrThrow({
      where: { id: seeded.enquiryId },
      select: { status: true },
    });
    expect(enquiry.status).toBe('CANCELLED');

    const activity = await prisma.enquiryActivity.findFirst({
      where: { enquiryId: seeded.enquiryId, type: 'CANCELLED_BY_CUSTOMER' },
      select: { isCustomerVisible: true, actorUserId: true, message: true, toStatus: true },
    });
    expect(activity).not.toBeNull();
    expect(activity?.isCustomerVisible).toBe(true);
    expect(activity?.actorUserId).toBe(priya.userId);
    expect(activity?.message).toBe('Found another venue');
    expect(activity?.toStatus).toBe('CANCELLED');

    // The customer-facing projection reflects it: cancel is no longer offered
    // and the timeline carries the reason.
    const detail = await getEnquiry(
      makeRequest(`/api/enquiries/${seeded.referenceCode}`, {
        headers: withCookie(priya.cookie),
      }),
      routeContext({ referenceCode: seeded.referenceCode }),
    );
    expect(detail.status).toBe(200);
    const detailBody = await readJson<EnquiryDetailBody>(detail);
    expect(detailBody.data.canCancel).toBe(false);
    expect(detailBody.data.timeline.map((entry) => entry.message)).toContain('Found another venue');
  });

  it('cancels a lead in a later cancellable stage (QUALIFIED)', async () => {
    const priya = await signInAsCustomer('priya');
    const admin = await signInAsAdmin();
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);

    await moveLead(seeded.enquiryId, seeded.leadIds[0]!, 'QUALIFIED', admin.cookie);

    const { status, body } = await callCancel(seeded.referenceCode, priya.cookie);
    expect(status).toBe(200);
    expect(body.data.status).toBe('CANCELLED');
  });
});

describe('cancelling a non-cancellable lead', () => {
  it('refuses once the lead is SHARED_WITH_PROVIDER and leaves it untouched', async () => {
    const priya = await signInAsCustomer('priya');
    const admin = await signInAsAdmin();
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);

    await moveLead(seeded.enquiryId, seeded.leadIds[0]!, 'QUALIFIED', admin.cookie);
    await moveLead(seeded.enquiryId, seeded.leadIds[0]!, 'SHARED_WITH_PROVIDER', admin.cookie);

    const { status, body } = await callCancel(seeded.referenceCode, priya.cookie);
    expect(status).toBe(409);
    expect(errorOf(body).code).toBe('CONFLICT');

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: seeded.leadIds[0]! },
      select: { status: true },
    });
    expect(lead.status).toBe('SHARED_WITH_PROVIDER');

    const activity = await prisma.enquiryActivity.findFirst({
      where: { enquiryId: seeded.enquiryId, type: 'CANCELLED_BY_CUSTOMER' },
    });
    expect(activity).toBeNull();
  });

  it('refuses once the lead is CONVERTED', async () => {
    const priya = await signInAsCustomer('priya');
    const admin = await signInAsAdmin();
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);

    await moveLead(seeded.enquiryId, seeded.leadIds[0]!, 'QUALIFIED', admin.cookie);
    await moveLead(seeded.enquiryId, seeded.leadIds[0]!, 'SHARED_WITH_PROVIDER', admin.cookie);
    await moveLead(seeded.enquiryId, seeded.leadIds[0]!, 'CONVERTED', admin.cookie);

    const { status, body } = await callCancel(seeded.referenceCode, priya.cookie);
    expect(status).toBe(409);
    expect(errorOf(body).code).toBe('CONFLICT');

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: seeded.leadIds[0]! },
      select: { status: true },
    });
    expect(lead.status).toBe('CONVERTED');
  });
});

describe('cancellation recomputes the parent from the remaining leads', () => {
  it('cancels only the cancellable lead and derives the overall status from the rest', async () => {
    const priya = await signInAsCustomer('priya');
    const admin = await signInAsAdmin();
    const slugs = await publishedSlugs(2);
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email, slugs);
    expect(seeded.leadIds).toHaveLength(2);

    const [sharedLead, remainingLead] = seeded.leadIds;
    await moveLead(seeded.enquiryId, sharedLead!, 'QUALIFIED', admin.cookie);
    await moveLead(seeded.enquiryId, sharedLead!, 'SHARED_WITH_PROVIDER', admin.cookie);

    const { status, body } = await callCancel(seeded.referenceCode, priya.cookie);
    expect(status).toBe(200);
    expect(body.data.status).toBe('SHARED_WITH_PROVIDER');

    const { prisma } = await import('@/lib/db');
    const leads = await prisma.enquiryListing.findMany({
      where: { enquiryId: seeded.enquiryId },
      select: { id: true, status: true },
    });
    const byId = new Map(leads.map((lead) => [lead.id, lead.status]));
    expect(byId.get(sharedLead!)).toBe('SHARED_WITH_PROVIDER');
    expect(byId.get(remainingLead!)).toBe('CANCELLED');

    const enquiry = await prisma.enquiry.findUniqueOrThrow({
      where: { id: seeded.enquiryId },
      select: { status: true },
    });
    expect(enquiry.status).toBe('SHARED_WITH_PROVIDER');
  });
});

describe('the guarded write survives a status change between read and write', () => {
  it('does not cancel a lead that moved to SHARED_WITH_PROVIDER while the request was in flight', async () => {
    const priya = await signInAsCustomer('priya');
    const seeded = await seedCustomerEnquiry(priya.cookie, SEEDED_USERS.priya.email);
    const leadId = seeded.leadIds[0]!;

    // Hold a row lock so the service's conditional UPDATE blocks after it has
    // already read the lead as NEW, then change the status and release the lock.
    // Under READ COMMITTED the UPDATE re-evaluates its WHERE clause against the
    // new row; a guard-less implementation would cancel it anyway.
    const client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM enquiry_listings WHERE id = $1 FOR UPDATE', [leadId]);

      const pending = cancelEnquiry(
        jsonRequest(
          `/api/enquiries/${seeded.referenceCode}/cancel`,
          'POST',
          { reason: 'Race cancellation' },
          withCookie(priya.cookie),
        ),
        routeContext({ referenceCode: seeded.referenceCode }),
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      await client.query('UPDATE enquiry_listings SET status = $1 WHERE id = $2', [
        'SHARED_WITH_PROVIDER',
        leadId,
      ]);
      await client.query('COMMIT');

      const response = await pending;
      expect(response.status).toBe(409);
      expect(errorOf(await readJson(response)).code).toBe('CONFLICT');
    } finally {
      await client.end().catch(() => undefined);
    }

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { status: true },
    });
    expect(lead.status).toBe('SHARED_WITH_PROVIDER');

    const activity = await prisma.enquiryActivity.findFirst({
      where: { enquiryId: seeded.enquiryId, type: 'CANCELLED_BY_CUSTOMER' },
    });
    expect(activity).toBeNull();
  });
});
