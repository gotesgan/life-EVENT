import { beforeEach, describe, expect, it } from 'vitest';
import { GET as adminOverview } from '@/app/api/admin/overview/route';
import { POST as changeEnquiryStatus } from '@/app/api/admin/enquiries/[id]/status/route';
import { PATCH as updateCustomer } from '@/app/api/admin/customers/[id]/route';
import {
  GET as listCatalogEventTypes,
  POST as createEventType,
} from '@/app/api/admin/catalog/event-types/route';
import { POST as createEnquiry } from '@/app/api/enquiries/route';
import {
  SEEDED_LISTINGS,
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

interface OverviewBody {
  metrics: { total: number };
  recentListings: Array<{ id: string }>;
}

interface CreatedEventTypeBody {
  data: { id: string; slug: string; name: string };
}

interface StatusChangeBody {
  data: { status: string; updatedLeads: number };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

async function seedGuestEnquiry(): Promise<{
  referenceCode: string;
  enquiryId: string;
  leadId: string;
}> {
  const response = await createEnquiry(
    jsonRequest('/api/enquiries', 'POST', {
      listings: [SEEDED_LISTINGS.published],
      contactName: 'Admin Test Guest',
      contactEmail: 'admin-route-test@example.test',
      contactPhone: '+91 90000 00042',
      consentPrivacy: true,
    }),
    routeContext({}),
  );
  expect(response.status).toBe(201);
  const body = await readJson<{ data: { referenceCode: string } }>(response);

  const { prisma } = await import('@/lib/db');
  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { referenceCode: body.data.referenceCode },
    select: { id: true, listings: { select: { id: true } } },
  });

  return {
    referenceCode: body.data.referenceCode,
    enquiryId: enquiry.id,
    leadId: enquiry.listings[0]!.id,
  };
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('admin authorization', () => {
  it('returns 401 without a session', async () => {
    const response = await adminOverview(makeRequest('/api/admin/overview'), routeContext({}));
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 for a signed-in customer', async () => {
    const customer = await signInAsCustomer('priya');
    const response = await adminOverview(
      makeRequest('/api/admin/overview', { headers: withCookie(customer.cookie) }),
      routeContext({}),
    );
    expect(response.status).toBe(403);
    expect(errorOf(await readJson(response)).code).toBe('FORBIDDEN');
  });

  it('returns data for an administrator', async () => {
    const admin = await signInAsAdmin();
    const response = await adminOverview(
      makeRequest('/api/admin/overview', { headers: withCookie(admin.cookie) }),
      routeContext({}),
    );
    expect(response.status).toBe(200);

    const body = await readJson<OverviewBody>(response);
    expect(body.recentListings.length).toBeLessThanOrEqual(5);
    expect(typeof body.metrics.total).toBe('number');
  });
});

describe('POST /api/admin/enquiries/[id]/status', () => {
  it('rejects a disallowed NEW to CONVERTED transition with 409', async () => {
    const admin = await signInAsAdmin();
    const { enquiryId, leadId } = await seedGuestEnquiry();

    const response = await changeEnquiryStatus(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/status`,
        'POST',
        { status: 'CONVERTED', enquiryListingId: leadId },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(409);
    const error = errorOf(await readJson(response));
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toMatchObject({ from: 'NEW', to: 'CONVERTED' });
  });

  it('applies an allowed transition', async () => {
    const admin = await signInAsAdmin();
    const { enquiryId, leadId } = await seedGuestEnquiry();

    const response = await changeEnquiryStatus(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/status`,
        'POST',
        { status: 'CONTACTED', enquiryListingId: leadId },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(200);
    const body = await readJson<StatusChangeBody>(response);
    expect(body.data.updatedLeads).toBe(1);
  });
});

describe('PATCH /api/admin/customers/[id]', () => {
  it('refuses to change the acting administrator own account', async () => {
    const admin = await signInAsAdmin();

    const response = await updateCustomer(
      jsonRequest(
        `/api/admin/customers/${admin.userId}`,
        'PATCH',
        { status: 'SUSPENDED' },
        withCookie(admin.cookie),
      ),
      routeContext({ id: admin.userId }),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');
  });
});

describe('admin catalogue', () => {
  it('creates event types with unique slugs and writes an audit entry', async () => {
    const admin = await signInAsAdmin();
    const { slugify } = await import('@/lib/slug');

    // Unique per run: the catalogue tables are reference data and are not
    // truncated between tests, so a fixed name would collide with leftovers.
    const name = `API Test Event Type ${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const baseSlug = slugify(name);

    const first = await createEventType(
      jsonRequest('/api/admin/catalog/event-types', 'POST', { name }, withCookie(admin.cookie)),
      routeContext({}),
    );
    expect(first.status).toBe(201);
    const firstBody = await readJson<CreatedEventTypeBody>(first);
    expect(firstBody.data.slug).toBe(baseSlug);

    const second = await createEventType(
      jsonRequest('/api/admin/catalog/event-types', 'POST', { name }, withCookie(admin.cookie)),
      routeContext({}),
    );
    expect(second.status).toBe(201);
    const secondBody = await readJson<CreatedEventTypeBody>(second);
    expect(secondBody.data.slug).toBe(`${baseSlug}-2`);

    const { prisma } = await import('@/lib/db');
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'event_type.created', entityId: firstBody.data.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(admin.userId);

    const list = await listCatalogEventTypes(
      makeRequest('/api/admin/catalog/event-types', { headers: withCookie(admin.cookie) }),
      routeContext({}),
    );
    expect(list.status).toBe(200);
    const listBody = await readJson<{ data: Array<{ slug: string }> }>(list);
    expect(listBody.data.map((row) => row.slug)).toContain(`${baseSlug}-2`);

    // Leave the catalogue as it was found.
    await prisma.eventType.deleteMany({ where: { name } });
    await prisma.auditLog.deleteMany({
      where: {
        action: 'event_type.created',
        entityId: { in: [firstBody.data.id, secondBody.data.id] },
      },
    });
  });

  it('denies catalogue mutations to a customer', async () => {
    const customer = await signInAsCustomer('priya');
    const response = await createEventType(
      jsonRequest(
        '/api/admin/catalog/event-types',
        'POST',
        { name: 'Should Not Exist' },
        withCookie(customer.cookie),
      ),
      routeContext({}),
    );
    expect(response.status).toBe(403);
  });
});
