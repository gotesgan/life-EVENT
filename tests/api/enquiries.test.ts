import { beforeEach, describe, expect, it } from 'vitest';
import { GET as listEnquiries, POST as createEnquiry } from '@/app/api/enquiries/route';
import { GET as getEnquiry } from '@/app/api/enquiries/[referenceCode]/route';
import { POST as trackEnquiry } from '@/app/api/enquiries/track/route';
import {
  SEEDED_LISTINGS,
  SEEDED_USERS,
  clearRuntimeState,
  jsonRequest,
  makeRequest,
  readJson,
  routeContext,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
} from './api-helpers';

interface CreateEnquiryBody {
  data: {
    referenceCode: string;
    status: string;
    duplicate: boolean;
    listings: string[];
  };
}

interface EnquiryDetailBody {
  data: { referenceCode: string; contactEmail: string };
}

interface EnquiryListBody {
  data: unknown[];
  pagination: { totalItems: number };
}

interface TrackBody {
  data: { referenceCode: string; status: string; listings: Array<{ slug: string }> };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

function enquiryBody(overrides: Record<string, unknown> = {}) {
  return {
    listings: [SEEDED_LISTINGS.published],
    contactName: 'Test Guest',
    contactEmail: 'guest@example.test',
    contactPhone: '+91 90000 00001',
    consentPrivacy: true,
    ...overrides,
  };
}

async function submitEnquiry(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const response = await createEnquiry(
    jsonRequest('/api/enquiries', 'POST', body, headers),
    routeContext({}),
  );
  return {
    status: response.status,
    body: await readJson<CreateEnquiryBody & ApiErrorResponse>(response),
  };
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('POST /api/enquiries', () => {
  it('accepts a guest enquiry without a session', async () => {
    const { status, body } = await submitEnquiry(enquiryBody());
    expect(status).toBe(201);
    expect(body.data.referenceCode).toMatch(/^LE-/);
    expect(body.data.duplicate).toBe(false);
    expect(body.data.listings).toEqual(['Gulmohar Banjara Banquets']);
  });

  it('rejects an enquiry without privacy consent', async () => {
    const body = enquiryBody();
    delete (body as Record<string, unknown>).consentPrivacy;

    const result = await submitEnquiry(body);
    expect(result.status).toBe(400);
    expect(errorOf(result.body).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unpublished listing slug', async () => {
    const result = await submitEnquiry(enquiryBody({ listings: ['chitrakatha-films'] }));
    expect(result.status).toBe(400);
    expect(errorOf(result.body).code).toBe('VALIDATION_ERROR');
  });

  it('replays the same reference code for a repeated idempotency key', async () => {
    const headers = { 'idempotency-key': 'test-key-replay-1' };
    const first = await submitEnquiry(enquiryBody(), headers);
    const second = await submitEnquiry(enquiryBody(), headers);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.referenceCode).toBe(first.body.data.referenceCode);
    expect(second.body.data.duplicate).toBe(true);
  });

  it('rejects the same idempotency key with a different body', async () => {
    const headers = { 'idempotency-key': 'test-key-mismatch-1' };
    const first = await submitEnquiry(enquiryBody(), headers);
    expect(first.status).toBe(201);

    const second = await submitEnquiry(
      enquiryBody({ requirements: 'A completely different brief for the same key' }),
      headers,
    );
    expect(second.status).toBe(409);
    expect(errorOf(second.body).code).toBe('CONFLICT');
  });

  it('attaches a signed-in customer to the lead', async () => {
    const session = await signInAsCustomer('priya');
    const result = await submitEnquiry(
      enquiryBody({ contactEmail: SEEDED_USERS.priya.email }),
      withCookie(session.cookie),
    );

    expect(result.status).toBe(201);

    const { prisma } = await import('@/lib/db');
    const enquiry = await prisma.enquiry.findUniqueOrThrow({
      where: { referenceCode: result.body.data.referenceCode },
      select: { customerUserId: true },
    });
    expect(enquiry.customerUserId).toBe(session.userId);
  });
});

describe('GET /api/enquiries', () => {
  it('returns 401 without a session', async () => {
    const response = await listEnquiries(makeRequest('/api/enquiries'), routeContext({}));
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns only the signed-in customer own enquiries', async () => {
    const session = await signInAsCustomer('priya');
    await submitEnquiry(
      enquiryBody({ contactEmail: SEEDED_USERS.priya.email }),
      withCookie(session.cookie),
    );

    const response = await listEnquiries(
      makeRequest('/api/enquiries', { headers: withCookie(session.cookie) }),
      routeContext({}),
    );
    expect(response.status).toBe(200);

    const body = await readJson<EnquiryListBody>(response);
    expect(body.pagination.totalItems).toBe(1);
  });
});

describe('GET /api/enquiries/[referenceCode]', () => {
  it('returns 404 when the reference belongs to another customer', async () => {
    const priya = await signInAsCustomer('priya');
    const arjun = await signInAsCustomer('arjun');

    const created = await submitEnquiry(
      enquiryBody({ contactEmail: SEEDED_USERS.priya.email }),
      withCookie(priya.cookie),
    );
    const referenceCode = created.body.data.referenceCode;

    const ownerResponse = await getEnquiry(
      makeRequest(`/api/enquiries/${referenceCode}`, {
        headers: withCookie(priya.cookie),
      }),
      routeContext({ referenceCode }),
    );
    expect(ownerResponse.status).toBe(200);
    expect((await readJson<EnquiryDetailBody>(ownerResponse)).data.referenceCode).toBe(
      referenceCode,
    );

    const otherResponse = await getEnquiry(
      makeRequest(`/api/enquiries/${referenceCode}`, {
        headers: withCookie(arjun.cookie),
      }),
      routeContext({ referenceCode }),
    );
    expect(otherResponse.status).toBe(404);
    expect(errorOf(await readJson(otherResponse)).code).toBe('NOT_FOUND');
  });
});

describe('POST /api/enquiries/track', () => {
  it('finds the enquiry with the matching reference and email', async () => {
    const created = await submitEnquiry(enquiryBody());
    const referenceCode = created.body.data.referenceCode;

    const response = await trackEnquiry(
      jsonRequest('/api/enquiries/track', 'POST', {
        referenceCode,
        email: 'guest@example.test',
      }),
      routeContext({}),
    );
    expect(response.status).toBe(200);

    const body = await readJson<TrackBody>(response);
    expect(body.data.referenceCode).toBe(referenceCode);
    expect(body.data.listings[0]?.slug).toBe(SEEDED_LISTINGS.published);
  });

  it('returns 404 for the wrong email', async () => {
    const created = await submitEnquiry(enquiryBody());

    const response = await trackEnquiry(
      jsonRequest('/api/enquiries/track', 'POST', {
        referenceCode: created.body.data.referenceCode,
        email: 'someone-else@example.test',
      }),
      routeContext({}),
    );
    expect(response.status).toBe(404);
    expect(errorOf(await readJson(response)).code).toBe('NOT_FOUND');
  });
});
