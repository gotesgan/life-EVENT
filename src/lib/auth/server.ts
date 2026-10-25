import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db';
import { getAdminUrl, getAppUrl, getServerEnv } from '@/lib/env';

/**
 * Better Auth server instance.
 *
 * Design notes:
 *  - Sessions are stored in PostgreSQL (not JWTs) so suspending a customer or
 *    changing a role takes effect immediately. See ADR-3.
 *  - `role` and `status` are declared with `input: false`, which means the
 *    HTTP API will not accept them from a client. A sign-up request cannot
 *    promote itself to administrator — the values are server-owned and are only
 *    changed through the admin service.
 *  - The Better Auth `admin` plugin is deliberately NOT used: it would add a
 *    second, competing notion of roles and a set of endpoints we do not need.
 *    Moderation (suspend/reactivate) is implemented in the customer service
 *    against our own `status` column instead.
 */
/**
 * The cookie domain for a panel served from a sibling host.
 *
 * `app.example.com` + `admin.example.com` share `.example.com`, so one login is
 * valid on both. The rule is deliberately strict: strip the leading label from
 * each host, and only use the remainder when it is a proper registrable domain
 * (two labels). That refuses public suffixes (`nip.io`, `vercel.app`) where a
 * `Domain=` cookie would be rejected or unsafe. `AUTH_COOKIE_DOMAIN` overrides
 * the derivation where an operator knows better.
 */
function sharedCookieDomain(): string | null {
  const adminUrl = getAdminUrl();
  if (!adminUrl) return null;

  const override = getServerEnv().AUTH_COOKIE_DOMAIN;
  if (override) return override.startsWith('.') ? override : `.${override}`;

  try {
    const publicHost = new URL(getAppUrl()).hostname;
    const adminHost = new URL(adminUrl).hostname;
    if (publicHost === adminHost) return null;

    const remainder = (hostname: string): string | null => {
      const labels = hostname.split('.');
      if (labels.length < 3) return null;
      return labels.slice(1).join('.');
    };

    const fromPublic = remainder(publicHost);
    const fromAdmin = remainder(adminHost);
    if (!fromPublic || fromPublic !== fromAdmin) return null;

    // Two labels is a registrable domain; more is usually a public suffix
    // (`nip.io`, `vercel.app`), where a Domain= cookie would be rejected.
    if (fromPublic.split('.').length !== 2) return null;

    return `.${fromPublic}`;
  } catch {
    return null;
  }
}

const adminUrl = getAdminUrl();
const cookieDomain = sharedCookieDomain();

export const auth = betterAuth({
  baseURL: getAppUrl(),
  secret: getServerEnv().BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 60,
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'CUSTOMER',
        // Server-owned: never accepted from a request body.
        input: false,
      },
      status: {
        type: 'string',
        required: false,
        defaultValue: 'ACTIVE',
        input: false,
      },
    },
  },

  advanced: {
    // Cookie is HttpOnly + SameSite=Lax by default; Secure is enabled whenever
    // the app is served over HTTPS.
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      sameSite: 'lax',
      httpOnly: true,
    },
    ...(cookieDomain ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } : {}),
  },

  /**
   * Brute-force protection on the auth endpoints.
   *
   * Better Auth ships a hard-coded special rule for `/sign-in*` and `/sign-up*`
   * of 3 requests per 10 seconds, which the global `max` does **not** override.
   * That ceiling is far too low for a legitimate shared-network client (an
   * office or a family behind one NAT address) and made every end-to-end run
   * fail with 429s. `customRules` are applied last and do win, so the credential
   * endpoints are given the configured ceiling instead — still rate limited,
   * just not at three attempts per ten seconds.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: getServerEnv().RATE_LIMIT_AUTH_PER_IP,
    customRules: {
      '/sign-in/email': { window: 60, max: getServerEnv().RATE_LIMIT_AUTH_PER_IP },
      '/sign-up/email': { window: 60, max: getServerEnv().RATE_LIMIT_AUTH_PER_IP },
    },
  },

  // Both hosts are legitimate origins for one Better Auth instance. Authorization
  // is still decided by the actor's role, never by the host.
  trustedOrigins: adminUrl ? [getAppUrl(), adminUrl] : [getAppUrl()],

  // Required so cookies set during a Server Action / Route Handler response are
  // actually written. Must be the last plugin.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
