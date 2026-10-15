import { beforeEach, describe, expect, it } from 'vitest';
import { POST as assignLead } from '@/app/api/admin/enquiries/[id]/assign/route';
import { POST as createEnquiry } from '@/app/api/enquiries/route';
import {
  SEEDED_LISTINGS,
  clearRuntimeState,
  jsonRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
} from './api-helpers';
import { uniqueEmail, uniquePhone, uniqueSlug } from '../integration/helpers';

/**
 * `POST /api/admin/enquiries/[id]/assign` — assignment-target validation.
 *
 * The rule: a lead may only be assigned to an `ACTIVE` account whose role is
 * `ADMIN`. A missing id, a deactivated administrator and a customer account are
 * all refused. On success the lead persists `assignedAdminId` and stamps
 * `assignedAt`.
 */

interface AssignBody {
  data: { enquiryId: string; assignedAdminId: string | null };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

async function seedEnquiry(): Promise<{ enquiryId: string; leadId: string }> {
  const response = await createEnquiry(
    jsonRequest(
      '/api/enquiries',
      'POST',
      {
        listings: [SEEDED_LISTINGS.published],
        contactName: 'Assignment Guest',
        contactEmail: uniqueEmail('assign-guest'),
        contactPhone: uniquePhone(),
        consentPrivacy: true,
      },
      { 'idempotency-key': uniqueSlug('assign-key') },
    ),
    routeContext({}),
  );
  expect(response.status).toBe(201);
  const body = await readJson<{ data: { referenceCode: string } }>(response);

  const { prisma } = await import('@/lib/db');
  const enquiry = await prisma.enquiry.findUniqueOrThrow({
    where: { referenceCode: body.data.referenceCode },
    select: { id: true, listings: { select: { id: true }, orderBy: { sortOrder: 'asc' } } },
  });

  return { enquiryId: enquiry.id, leadId: enquiry.listings[0]!.id };
}

async function createAccount(
  role: 'ADMIN' | 'CUSTOMER',
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',
) {
  const { prisma } = await import('@/lib/db');
  const suffix = `${Date.now()}${Math.floor(Math.random() * 100_000)}`;
  return prisma.user.create({
    data: {
      name: `Assignment Target ${suffix}`,
      email: `assignment-target.${suffix}@example.test`,
      role,
      status,
    },
    select: { id: true, name: true },
  });
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('POST /api/admin/enquiries/[id]/assign authorization', () => {
  it('returns 401 without a session', async () => {
    const { enquiryId } = await seedEnquiry();
    const response = await assignLead(
      jsonRequest(`/api/admin/enquiries/${enquiryId}/assign`, 'POST', { assignedAdminId: null }),
      routeContext({ id: enquiryId }),
    );
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 for a signed-in customer', async () => {
    const customer = await signInAsCustomer('priya');
    const { enquiryId } = await seedEnquiry();
    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: null },
        withCookie(customer.cookie),
      ),
      routeContext({ id: enquiryId }),
    );
    expect(response.status).toBe(403);
    expect(errorOf(await readJson(response)).code).toBe('FORBIDDEN');
  });
});

describe('POST /api/admin/enquiries/[id]/assign target validation', () => {
  it('refuses an enquiry that does not exist', async () => {
    const admin = await signInAsAdmin();
    const target = await createAccount('ADMIN', 'ACTIVE');
    const missingId = crypto.randomUUID();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${missingId}/assign`,
        'POST',
        { assignedAdminId: target.id },
        withCookie(admin.cookie),
      ),
      routeContext({ id: missingId }),
    );

    expect(response.status).toBe(404);
    expect(errorOf(await readJson(response)).code).toBe('NOT_FOUND');
  });

  it('refuses an administrator id that does not exist', async () => {
    const admin = await signInAsAdmin();
    const { enquiryId, leadId } = await seedEnquiry();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: crypto.randomUUID() },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { assignedAdminId: true, assignedAt: true },
    });
    expect(lead.assignedAdminId).toBeNull();
    expect(lead.assignedAt).toBeNull();
  });

  it('refuses a deactivated administrator', async () => {
    const admin = await signInAsAdmin();
    const deactivated = await createAccount('ADMIN', 'DEACTIVATED');
    const { enquiryId, leadId } = await seedEnquiry();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: deactivated.id },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { assignedAdminId: true },
    });
    expect(lead.assignedAdminId).toBeNull();
  });

  it('refuses a customer account', async () => {
    const admin = await signInAsAdmin();
    const customer = await createAccount('CUSTOMER', 'ACTIVE');
    const { enquiryId, leadId } = await seedEnquiry();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: customer.id },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { assignedAdminId: true },
    });
    expect(lead.assignedAdminId).toBeNull();
  });

  it('rejects a payload with no assignedAdminId at all', async () => {
    const admin = await signInAsAdmin();
    const { enquiryId } = await seedEnquiry();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { scope: 'lead' },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/admin/enquiries/[id]/assign success', () => {
  it('persists the assignment and stamps assignedAt on the lead', async () => {
    const admin = await signInAsAdmin();
    const target = await createAccount('ADMIN', 'ACTIVE');
    const { enquiryId, leadId } = await seedEnquiry();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: target.id, note: 'Take this one' },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(200);
    const body = await readJson<AssignBody>(response);
    expect(body.data.enquiryId).toBe(enquiryId);
    expect(body.data.assignedAdminId).toBe(target.id);

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { assignedAdminId: true, assignedAt: true },
    });
    expect(lead.assignedAdminId).toBe(target.id);
    expect(lead.assignedAt).not.toBeNull();

    // Assignment is internal operational detail: the activity row must not be
    // customer-visible.
    const activity = await prisma.enquiryActivity.findFirst({
      where: { enquiryId, type: 'ASSIGNED' },
      select: { isCustomerVisible: true, actorUserId: true, message: true },
    });
    expect(activity).not.toBeNull();
    expect(activity?.isCustomerVisible).toBe(false);
    expect(activity?.actorUserId).toBe(admin.userId);
    expect(activity?.message).toBe('Take this one');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'enquiry.assigned', entityId: enquiryId },
      select: { actorUserId: true },
    });
    expect(audit?.actorUserId).toBe(admin.userId);
  });

  it('unassigns a lead and clears assignedAt', async () => {
    const admin = await signInAsAdmin();
    const target = await createAccount('ADMIN', 'ACTIVE');
    const { enquiryId, leadId } = await seedEnquiry();

    await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: target.id },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: null },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(200);
    const body = await readJson<AssignBody>(response);
    expect(body.data.assignedAdminId).toBeNull();

    const { prisma } = await import('@/lib/db');
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { assignedAdminId: true, assignedAt: true },
    });
    expect(lead.assignedAdminId).toBeNull();
    expect(lead.assignedAt).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'enquiry.unassigned', entityId: enquiryId },
      select: { action: true, actorUserId: true },
    });
    expect(audit?.action).toBe('enquiry.unassigned');
    expect(audit?.actorUserId).toBe(admin.userId);
  });

  it('assigns the whole enquiry when scope is enquiry', async () => {
    const admin = await signInAsAdmin();
    const target = await createAccount('ADMIN', 'ACTIVE');
    const { enquiryId, leadId } = await seedEnquiry();

    const response = await assignLead(
      jsonRequest(
        `/api/admin/enquiries/${enquiryId}/assign`,
        'POST',
        { assignedAdminId: target.id, scope: 'enquiry' },
        withCookie(admin.cookie),
      ),
      routeContext({ id: enquiryId }),
    );

    expect(response.status).toBe(200);

    const { prisma } = await import('@/lib/db');
    const enquiry = await prisma.enquiry.findUniqueOrThrow({
      where: { id: enquiryId },
      select: { assignedAdminId: true },
    });
    expect(enquiry.assignedAdminId).toBe(target.id);

    // Enquiry-scope assignment is on the parent; the per-lead SLA timestamp is
    // not stamped.
    const lead = await prisma.enquiryListing.findUniqueOrThrow({
      where: { id: leadId },
      select: { assignedAdminId: true, assignedAt: true },
    });
    expect(lead.assignedAdminId).toBeNull();
    expect(lead.assignedAt).toBeNull();
  });
});
