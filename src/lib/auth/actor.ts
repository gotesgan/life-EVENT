import 'server-only';
import { headers as nextHeaders } from 'next/headers';
import { ForbiddenError, UnauthenticatedError } from '@/lib/errors';
import { auth } from '@/lib/auth/server';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export type Actor =
  | { kind: 'anonymous'; user: null }
  | { kind: 'customer'; user: SessionUser }
  | { kind: 'admin'; user: SessionUser };

export interface CustomerActor {
  kind: 'customer' | 'admin';
  user: SessionUser;
  isAdmin: boolean;
}

export interface AdminActor {
  kind: 'admin';
  user: SessionUser;
  isAdmin: true;
}

/**
 * Resolves the current actor from request headers.
 *
 * This is the ONLY place identity enters the system. Nothing downstream reads a
 * user id, role or permission flag from a request body, query string or header
 * supplied by the client.
 */
export async function getActorFromHeaders(requestHeaders: Headers): Promise<Actor> {
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result?.user) return { kind: 'anonymous', user: null };

  const raw = result.user as unknown as Record<string, unknown>;
  const role = raw.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
  const status = raw.status === 'SUSPENDED' || raw.status === 'DEACTIVATED' ? raw.status : 'ACTIVE';

  const user: SessionUser = {
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : '',
    email: typeof raw.email === 'string' ? raw.email : '',
    emailVerified: raw.emailVerified === true,
    image: typeof raw.image === 'string' ? raw.image : null,
    role,
    status,
  };

  // A suspended account keeps a valid session row, but is an anonymous actor
  // for every authorization decision.
  if (user.status !== 'ACTIVE') return { kind: 'anonymous', user: null };

  return role === 'ADMIN' ? { kind: 'admin', user } : { kind: 'customer', user };
}

/** Actor for Server Components and Server Actions. */
export async function getCurrentActor(): Promise<Actor> {
  return getActorFromHeaders(await nextHeaders());
}

/**
 * Requires any authenticated, active account (customer or administrator).
 * Used for customer-owned resources, where an administrator may also act.
 */
export async function requireActor(requestHeaders?: Headers): Promise<CustomerActor> {
  const actor = requestHeaders
    ? await getActorFromHeaders(requestHeaders)
    : await getCurrentActor();

  if (actor.kind === 'anonymous') {
    throw new UnauthenticatedError();
  }

  return { kind: actor.kind, user: actor.user, isAdmin: actor.user.role === 'ADMIN' };
}

/**
 * Requires an administrator. Applied inside services, not only in routing, so
 * an admin-only mutation cannot be reached by calling the service directly.
 */
export async function requireAdmin(requestHeaders?: Headers): Promise<AdminActor> {
  const actor = requestHeaders
    ? await getActorFromHeaders(requestHeaders)
    : await getCurrentActor();

  if (actor.kind === 'anonymous') {
    throw new UnauthenticatedError();
  }
  if (actor.user.role !== 'ADMIN') {
    throw new ForbiddenError('Administrator access is required');
  }

  return { kind: 'admin', user: actor.user, isAdmin: true };
}

/** Convenience for pages that want to render differently when signed in. */
export async function getOptionalUser(): Promise<SessionUser | null> {
  const actor = await getCurrentActor();
  return actor.kind === 'anonymous' ? null : actor.user;
}
