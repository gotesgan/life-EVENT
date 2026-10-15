import 'server-only';
import { getServerEnv } from '@/lib/env';

/**
 * Resolves the client IP that rate limiting and audit logging key on.
 *
 * `x-forwarded-for` is a comma-separated chain: a client may send its own value,
 * and each proxy appends the address it observed. Taking the **first** entry —
 * which is what this used to do — takes the value the *client* chose, so a caller
 * could rotate the header and get a fresh rate-limit bucket on every request,
 * defeating the per-IP limit entirely (and the per-email limit too, by rotating
 * the contact address alongside it).
 *
 * The trustworthy entry is the one appended by the proxy closest to us: counting
 * from the right. `TRUSTED_PROXY_HOPS` says how many proxies in front of the
 * application we control, so the client address sits that many entries from the
 * end. The default of 1 matches a single managed platform proxy (Vercel's edge),
 * where the last entry is the address that proxy actually observed.
 *
 * Returns `null` when no header is present, so callers can refuse to bucket
 * rather than silently sharing one bucket for everyone.
 */
export function getClientIp(headers: Headers): string | null {
  const hops = Math.max(getServerEnv().TRUSTED_PROXY_HOPS, 0);

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const chain = forwarded
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    // Index from the end: the value appended by the proxy nearest to us. A client
    // can prepend entries but cannot remove the ones a proxy appended.
    const index = chain.length - 1 - hops;
    const candidate = chain[index];
    if (candidate) return candidate;
  }

  // `x-real-ip` is set by some proxies instead of, or in addition to, XFF. It is
  // a single value rather than a chain, so only the trusted-hop count of 0 makes
  // it meaningful.
  const realIp = headers.get('x-real-ip');
  if (realIp && hops === 0) return realIp.trim() || null;

  return null;
}
