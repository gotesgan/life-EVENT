import { describe, expect, it } from 'vitest';
import { auth } from '@/lib/auth/server';

describe('lead smoke: better auth integration', () => {
  it('signs in a seeded customer and administrator', async () => {
    const customer = await auth.api.signInEmail({
      body: { email: 'priya@example.test', password: 'CustomerPass123!' },
      asResponse: true,
    });
    expect(customer.status).toBe(200);
    expect(customer.headers.get('set-cookie')).toContain('session');

    const admin = await auth.api.signInEmail({
      body: { email: 'admin@liveenvt.test', password: 'AdminPass123!' },
      asResponse: true,
    });
    expect(admin.status).toBe(200);
  });

  it('rejects a wrong password', async () => {
    const bad = await auth.api.signInEmail({
      body: { email: 'priya@example.test', password: 'definitely-wrong' },
      asResponse: true,
    });
    expect(bad.status).toBeGreaterThanOrEqual(400);
  });

  it('ignores a client-supplied role on sign-up', async () => {
    const email = `probe-${Date.now()}@example.test`;
    const response = await auth.api.signUpEmail({
      body: { email, password: 'ProbePass123!', name: 'Probe', role: 'ADMIN' } as never,
      asResponse: true,
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { user?: { role?: string } };
    expect(payload.user?.role).not.toBe('ADMIN');
    expect(payload.user?.role).toBe('CUSTOMER');
  });
});
