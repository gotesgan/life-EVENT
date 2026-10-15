import { beforeEach, describe, expect, it } from 'vitest';
import { PATCH as moderateCustomer } from '@/app/api/admin/customers/[id]/route';
import {
  clearRuntimeState,
  jsonRequest,
  readJson,
  routeContext,
  signInAsAdmin,
  signInAsCustomer,
  withCookie,
  type ApiErrorResponse,
} from './api-helpers';
import { createTestCustomer, uniqueSuffix } from '../integration/helpers';

/**
 * `PATCH /api/admin/customers/[id]` — account moderation.
 *
 * Suspending sets both `status` and the Better Auth `banned` flag (which is what
 * actually revokes access); reactivating clears them; an administrator account
 * may not be suspended here, and the acting administrator may not change their
 * own account. Each case asserts the persisted row.
 */

interface ModeratedBody {
  data: { id: string; email: string; status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

async function createAdminAccount() {
  const { prisma } = await import('@/lib/db');
  return prisma.user.create({
    data: {
      name: `Moderation Admin ${uniqueSuffix()}`,
      email: `moderation-admin.${uniqueSuffix()}@example.test`,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    select: { id: true },
  });
}

async function callModerate(
  userId: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: ModeratedBody & ApiErrorResponse }> {
  const response = await moderateCustomer(
    jsonRequest(`/api/admin/customers/${userId}`, 'PATCH', body, withCookie(cookie)),
    routeContext({ id: userId }),
  );
  return {
    status: response.status,
    body: await readJson<ModeratedBody & ApiErrorResponse>(response),
  };
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('PATCH /api/admin/customers/[id] authorization', () => {
  it('returns 401 without a session', async () => {
    const customer = await createTestCustomer('moderate');
    const response = await moderateCustomer(
      jsonRequest(`/api/admin/customers/${customer.id}`, 'PATCH', { status: 'SUSPENDED' }),
      routeContext({ id: customer.id }),
    );
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 for a signed-in customer', async () => {
    const session = await signInAsCustomer('priya');
    const customer = await createTestCustomer('moderate');
    const { status, body } = await callModerate(customer.id, session.cookie, {
      status: 'SUSPENDED',
    });
    expect(status).toBe(403);
    expect(errorOf(body).code).toBe('FORBIDDEN');
  });
});

describe('PATCH /api/admin/customers/[id] moderation', () => {
  it('suspends a customer, sets the ban flag and writes an audit row', async () => {
    const admin = await signInAsAdmin();
    const customer = await createTestCustomer('moderate');

    const { status, body } = await callModerate(customer.id, admin.cookie, {
      status: 'SUSPENDED',
      reason: 'Repeated abusive enquiries',
    });

    expect(status).toBe(200);
    expect(body.data.id).toBe(customer.id);
    expect(body.data.status).toBe('SUSPENDED');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: customer.id },
      select: { status: true, banned: true, banReason: true },
    });
    expect(row.status).toBe('SUSPENDED');
    expect(row.banned).toBe(true);
    expect(row.banReason).toBe('Repeated abusive enquiries');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'customer.suspended', entityId: customer.id },
      select: { actorUserId: true },
    });
    expect(audit?.actorUserId).toBe(admin.userId);
  });

  it('reactivates a suspended customer and clears the ban fields', async () => {
    const admin = await signInAsAdmin();
    const customer = await createTestCustomer('moderate');
    const { prisma } = await import('@/lib/db');

    await callModerate(customer.id, admin.cookie, { status: 'SUSPENDED' });
    const { status, body } = await callModerate(customer.id, admin.cookie, { status: 'ACTIVE' });

    expect(status).toBe(200);
    expect(body.data.status).toBe('ACTIVE');

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: customer.id },
      select: { status: true, banned: true, banReason: true },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.banned).toBe(false);
    expect(row.banReason).toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'customer.reactivated', entityId: customer.id },
      select: { action: true, actorUserId: true },
    });
    expect(audit?.action).toBe('customer.reactivated');
    expect(audit?.actorUserId).toBe(admin.userId);
  });

  it('deactivates a customer and records the distinct audit action', async () => {
    const admin = await signInAsAdmin();
    const customer = await createTestCustomer('moderate');

    const { status, body } = await callModerate(customer.id, admin.cookie, {
      status: 'DEACTIVATED',
    });

    expect(status).toBe(200);
    expect(body.data.status).toBe('DEACTIVATED');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: customer.id },
      select: { status: true, banned: true },
    });
    expect(row.status).toBe('DEACTIVATED');
    expect(row.banned).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'customer.deactivated', entityId: customer.id },
      select: { action: true, actorUserId: true },
    });
    expect(audit?.action).toBe('customer.deactivated');
    expect(audit?.actorUserId).toBe(admin.userId);
  });

  it('refuses to suspend another administrator', async () => {
    const admin = await signInAsAdmin();
    const otherAdmin = await createAdminAccount();

    const { status, body } = await callModerate(otherAdmin.id, admin.cookie, {
      status: 'SUSPENDED',
    });

    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');

    const { prisma } = await import('@/lib/db');
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: otherAdmin.id },
      select: { status: true, banned: true },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.banned).toBe(false);
  });

  it('returns 404 for an unknown account', async () => {
    const admin = await signInAsAdmin();
    const missingId = crypto.randomUUID();
    const { status, body } = await callModerate(missingId, admin.cookie, {
      status: 'SUSPENDED',
    });
    expect(status).toBe(404);
    expect(errorOf(body).code).toBe('NOT_FOUND');
  });

  it('rejects an unknown status value', async () => {
    const admin = await signInAsAdmin();
    const customer = await createTestCustomer('moderate');
    const { status, body } = await callModerate(customer.id, admin.cookie, {
      status: 'BANISHED',
    });
    expect(status).toBe(400);
    expect(errorOf(body).code).toBe('VALIDATION_ERROR');
  });
});
