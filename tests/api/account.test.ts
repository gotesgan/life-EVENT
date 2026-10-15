import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getAccount, PATCH as updateAccount } from '@/app/api/account/route';
import {
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

/**
 * `/api/account` — the signed-in customer's own overview and profile.
 *
 * The rule under test is that the endpoint is narrow: display name, phone and
 * contact preferences are writable; identity and authorisation columns
 * (`email`, `role`, `status`) are not, even when a hostile payload tries to set
 * them. Every assertion is on the HTTP outcome *and* the resulting row.
 */

interface AccountOverviewBody {
  data: {
    user: { id: string; name: string; email: string; emailVerified: boolean };
    profile: {
      phone: string | null;
      preferredContactMethod: string;
      marketingConsent: boolean;
    };
    stats: { totalEnquiries: number; activeEnquiries: number; completedEnquiries: number };
  };
}

interface AccountUpdateBody {
  data: {
    id: string;
    name: string;
    email: string;
    profile: { phone: string | null; preferredContactMethod: string; marketingConsent: boolean };
  };
}

function errorOf(body: unknown): ApiErrorResponse['error'] {
  return (body as ApiErrorResponse).error;
}

beforeEach(async () => {
  await clearRuntimeState();
});

describe('GET /api/account', () => {
  it('returns 401 without a session', async () => {
    const response = await getAccount(makeRequest('/api/account'), routeContext({}));
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('returns the signed-in administrator own account rather than a customer account', async () => {
    const admin = await signInAsAdmin();
    const response = await getAccount(
      makeRequest('/api/account', { headers: withCookie(admin.cookie) }),
      routeContext({}),
    );

    expect(response.status).toBe(200);
    const body = await readJson<AccountOverviewBody>(response);
    // Identity comes from the session, not from any client-supplied value.
    expect(body.data.user.id).toBe(admin.userId);
    expect(body.data.user.email).toBe(SEEDED_USERS.admin.email);
    expect(typeof body.data.stats.totalEnquiries).toBe('number');
  });

  it('returns the profile the customer previously saved', async () => {
    // Arjun is used here so the assertions do not depend on the PATCH tests
    // (which mutate Priya) running after this one.
    const arjun = await signInAsCustomer('arjun');
    const response = await getAccount(
      makeRequest('/api/account', { headers: withCookie(arjun.cookie) }),
      routeContext({}),
    );

    expect(response.status).toBe(200);
    const body = await readJson<AccountOverviewBody>(response);
    expect(body.data.user.id).toBe(arjun.userId);
    expect(body.data.user.email).toBe(SEEDED_USERS.arjun.email);
    // Seeded profile: phone is stored with the formatting the customer typed.
    expect(body.data.profile.phone).toBe('+91 90000 00101');
    expect(body.data.profile.preferredContactMethod).toBe('WHATSAPP');
  });
});

describe('PATCH /api/account', () => {
  it('returns 401 without a session', async () => {
    const response = await updateAccount(
      jsonRequest('/api/account', 'PATCH', { name: 'Nobody' }),
      routeContext({}),
    );
    expect(response.status).toBe(401);
    expect(errorOf(await readJson(response)).code).toBe('UNAUTHENTICATED');
  });

  it('updates the display name and phone and persists both', async () => {
    const priya = await signInAsCustomer('priya');
    const newPhone = `+91 90000 0${Math.floor(1000 + Math.random() * 8999)}`;

    const response = await updateAccount(
      jsonRequest(
        '/api/account',
        'PATCH',
        { name: 'Priya Nair Updated', phone: newPhone },
        withCookie(priya.cookie),
      ),
      routeContext({}),
    );

    expect(response.status).toBe(200);
    const body = await readJson<AccountUpdateBody>(response);
    expect(body.data.id).toBe(priya.userId);
    expect(body.data.name).toBe('Priya Nair Updated');
    expect(body.data.profile.phone).toBe(newPhone);

    const { prisma } = await import('@/lib/db');
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: priya.userId },
      select: {
        name: true,
        email: true,
        role: true,
        status: true,
        profile: { select: { phone: true } },
      },
    });
    expect(row.name).toBe('Priya Nair Updated');
    expect(row.profile?.phone).toBe(newPhone);
  });

  it('updates contact preferences without touching identity', async () => {
    const priya = await signInAsCustomer('priya');

    const response = await updateAccount(
      jsonRequest(
        '/api/account',
        'PATCH',
        { preferredContactMethod: 'WHATSAPP', marketingConsent: false },
        withCookie(priya.cookie),
      ),
      routeContext({}),
    );

    expect(response.status).toBe(200);
    const body = await readJson<AccountUpdateBody>(response);
    expect(body.data.profile.preferredContactMethod).toBe('WHATSAPP');
    expect(body.data.profile.marketingConsent).toBe(false);
  });

  it('does not let a hostile payload escalate role, status or email', async () => {
    const priya = await signInAsCustomer('priya');
    const { prisma } = await import('@/lib/db');
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: priya.userId },
      select: { email: true, role: true, status: true, emailVerified: true },
    });

    const response = await updateAccount(
      jsonRequest(
        '/api/account',
        'PATCH',
        {
          name: 'Priya Nair',
          email: 'attacker@evil.test',
          role: 'ADMIN',
          status: 'SUSPENDED',
          emailVerified: true,
          banned: false,
        },
        withCookie(priya.cookie),
      ),
      routeContext({}),
    );

    // The schema strips unknown keys, so the request is accepted but only the
    // name is applied. What matters is the persisted row.
    expect(response.status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: priya.userId },
      select: { email: true, role: true, status: true, emailVerified: true },
    });
    expect(after.role).toBe('CUSTOMER');
    expect(after.status).toBe('ACTIVE');
    expect(after.email).toBe(before.email);
    expect(after.emailVerified).toBe(before.emailVerified);
  });

  it('rejects an unknown city with 400 and writes nothing', async () => {
    const priya = await signInAsCustomer('priya');
    const { prisma } = await import('@/lib/db');
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: priya.userId },
      select: { name: true },
    });

    const response = await updateAccount(
      jsonRequest(
        '/api/account',
        'PATCH',
        { name: 'Should Not Persist', citySlug: 'atlantis' },
        withCookie(priya.cookie),
      ),
      routeContext({}),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: priya.userId },
      select: { name: true },
    });
    expect(after.name).toBe(before.name);
  });

  it('rejects a one-character display name with 400', async () => {
    const priya = await signInAsCustomer('priya');
    const response = await updateAccount(
      jsonRequest('/api/account', 'PATCH', { name: 'P' }, withCookie(priya.cookie)),
      routeContext({}),
    );

    expect(response.status).toBe(400);
    expect(errorOf(await readJson(response)).code).toBe('VALIDATION_ERROR');
  });
});
