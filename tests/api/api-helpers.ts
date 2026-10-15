import { NextRequest } from 'next/server';

/**
 * API test helpers.
 *
 * Route handlers are invoked directly with a real `NextRequest` and a
 * `{ params: Promise<...> }` context, against the real test database wired up
 * by `tests/setup/integration.ts`. Sessions are real Better Auth sessions, so
 * the same `getSession` path used in production is exercised.
 */

export { clearRuntimeState } from '../setup/integration';

const BASE_URL = 'http://localhost:3000';

/** Seeded credentials from `prisma/seed-data/users.ts`. */
export const SEEDED_USERS = {
  admin: { email: 'admin@liveenvt.test', password: 'AdminPass123!' },
  priya: { email: 'priya@example.test', password: 'CustomerPass123!' },
  arjun: { email: 'arjun@example.test', password: 'CustomerPass123!' },
} as const;

/** Seeded listing slugs used across API suites. */
export const SEEDED_LISTINGS = {
  published: 'gulmohar-banjara-banquets',
  draft: 'navrang-convention-centre',
  unpublished: 'raatrani-rovers',
} as const;

/** The init type Next's `NextRequest` constructor accepts. */
type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

export function makeRequest(path: string, init: NextRequestInit = {}): NextRequest {
  return new NextRequest(new URL(path, BASE_URL), init);
}

export function jsonRequest(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return makeRequest(path, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function withCookie(cookie: string, headers: Record<string, string> = {}) {
  return { cookie, ...headers };
}

/** Route context helper — Next 16 hands `params` in as a Promise. */
export function routeContext<TParams extends Record<string, string>>(
  params: TParams,
): { params: Promise<TParams> } {
  return { params: Promise.resolve(params) };
}

export interface Session {
  cookie: string;
  userId: string;
  email: string;
}

/**
 * Signs a seeded user in through Better Auth's own API and returns the
 * `Cookie` header value from the `set-cookie` response.
 */
export async function signInAs(email: string, password: string): Promise<Session> {
  const { auth } = await import('@/lib/auth/server');

  const result = (await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  })) as { headers: Headers; response: { user?: { id?: string } } };

  const setCookies = result.headers.getSetCookie();
  const cookie = setCookies.map((value) => value.split(';')[0]).join('; ');

  if (!cookie) throw new Error(`Sign-in for ${email} did not return a session cookie`);

  const { prisma } = await import('@/lib/db');
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });

  return { cookie, userId: user.id, email };
}

export async function signInAsAdmin(): Promise<Session> {
  return signInAs(SEEDED_USERS.admin.email, SEEDED_USERS.admin.password);
}

export async function signInAsCustomer(which: 'priya' | 'arjun' = 'priya'): Promise<Session> {
  const user = SEEDED_USERS[which];
  return signInAs(user.email, user.password);
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Standard error envelope produced by `jsonError`. */
export interface ApiErrorResponse {
  error: { code: string; message: string; details?: unknown };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
