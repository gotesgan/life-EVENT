import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host routing for the back office.
 *
 * One deployment, two hosts:
 *
 *   public host   → the marketplace. `/admin/*` redirects to the admin host.
 *   admin host    → the back office. `/` redirects to `/admin`, and the pages
 *                   themselves keep their `/admin/*` URLs, so every existing
 *                   link and redirect target still resolves.
 *
 * The feature is **off unless `ADMIN_URL` is set**, which is what keeps local
 * development without a hosts entry, the e2e suite and preview deployments on
 * their existing single-host behaviour.
 *
 * The admin host is not a security boundary on its own — authorization stays in
 * the admin layout and in every service (`requireAdmin`). The host is an
 * operational boundary: separate cookies, separate logs, a URL that can be
 * firewalled or put behind SSO later, and a public site that gives no hint the
 * panel exists.
 *
 * The routing decision is extracted into `resolveHostRoute` so the rules are
 * testable without a server; `proxy` only translates its result into Next
 * responses.
 */
const ADMIN_URL = process.env.ADMIN_URL;
const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const ADMIN_ASSET_PREFIXES = ['/_next', '/media', '/brand', '/icon', '/apple-icon', '/favicon'];

function isAsset(pathname: string): boolean {
  return ADMIN_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Pages that must be reachable on the admin host without an `/admin` prefix. */
const ADMIN_HOST_PASSTHROUGH = ['/admin', '/api', '/sign-in', '/sign-up', '/brand'] as const;

export type HostRoute =
  /** Serve the request unchanged. */
  | { kind: 'next' }
  /** Redirect to an absolute URL. */
  | { kind: 'redirect'; to: string }
  /** Rewrite to another path on the current host. */
  | { kind: 'rewrite'; to: string };

/**
 * The host-routing decision. `null` means host routing is disabled (no
 * `ADMIN_URL` in the environment).
 */
export function resolveHostRoute(input: {
  host: string;
  pathname: string;
  search?: string;
  adminOrigin: URL;
  publicOrigin: URL;
}): HostRoute {
  const { host, pathname, adminOrigin, publicOrigin } = input;
  const search = input.search ?? '';

  if (isAsset(pathname)) return { kind: 'next' };

  const onAdminHost = host === adminOrigin.host;
  const onPublicHost = host === publicOrigin.host;

  if (onAdminHost) {
    if (pathname === '/')
      return { kind: 'redirect', to: new URL('/admin', adminOrigin).toString() };

    /*
     * The back office keeps `/admin/*` URLs, so a dashboard link and a typed
     * `admin.host/vendor-applications` must both land on the same page. Bare
     * paths are rewritten to their `/admin` equivalent; auth routes, APIs and
     * assets are left alone.
     */
    const passThrough = ADMIN_HOST_PASSTHROUGH.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (passThrough) return { kind: 'next' };

    return { kind: 'rewrite', to: `/admin${pathname}${search}` };
  }

  if (onPublicHost && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return { kind: 'redirect', to: new URL(`${pathname}${search}`, adminOrigin).toString() };
  }

  return { kind: 'next' };
}

export function proxy(request: NextRequest): NextResponse {
  if (!ADMIN_URL) return NextResponse.next();

  let adminOrigin: URL;
  let publicOrigin: URL;
  try {
    adminOrigin = new URL(ADMIN_URL);
    publicOrigin = new URL(PUBLIC_URL);
  } catch {
    /* A malformed URL must not take the site down; fall back to one host. */
    return NextResponse.next();
  }

  const route = resolveHostRoute({
    host: request.headers.get('host') ?? '',
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    adminOrigin,
    publicOrigin,
  });

  if (route.kind === 'next') return NextResponse.next();
  if (route.kind === 'redirect') return NextResponse.redirect(route.to);
  return NextResponse.rewrite(new URL(route.to, request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
