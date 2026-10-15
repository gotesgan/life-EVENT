import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/actor';
import { getClientIp as resolveClientIp } from '@/lib/client-ip';
import { getServerEnv } from '@/lib/env';
import { hashIp } from '@/server/domain/contact';
import type { AuditContext } from '@/server/services/audit.service';
import type { AdminActorContext } from '@/server/services/listing.service';

/**
 * Admin route plumbing.
 *
 * Every administrative handler calls `requireAdmin(request.headers)` itself —
 * routing is never the only check, and the services repeat the authorisation
 * internally. Identity, role and permissions come from the session cookie
 * alone; nothing is read from the body, query string or a client-supplied
 * header.
 */

/**
 * The client IP, resolved from the trusted end of the `x-forwarded-for` chain.
 *
 * Delegates to the shared helper so the enquiry rate limiter and the audited
 * admin IP can never disagree about who the caller is — and so neither of them
 * trusts the client-supplied first entry, which is what made the per-IP limit
 * bypassable by rotating a header.
 */
export function getClientIp(request: NextRequest): string | null {
  return resolveClientIp(request.headers);
}

/**
 * Resolves the admin actor context every admin service expects. Throws
 * `UnauthenticatedError`/`ForbiddenError` for a guest or a non-admin.
 */
export async function getAdminActorContext(request: NextRequest): Promise<AdminActorContext> {
  const actor = await requireAdmin(request.headers);

  return {
    userId: actor.user.id,
    name: actor.user.name,
    // Raw IP addresses are never stored or audited — only a salted hash.
    ipHash: hashIp(getClientIp(request), getServerEnv().IP_HASH_SALT),
    userAgent: request.headers.get('user-agent'),
  };
}

/** Adapts the route-level actor context to the audit service's shape. */
export function toAuditContext(actor: AdminActorContext): AuditContext {
  return {
    actorUserId: actor.userId,
    actorName: actor.name,
    ipHash: actor.ipHash ?? null,
    userAgent: actor.userAgent ?? null,
  };
}
