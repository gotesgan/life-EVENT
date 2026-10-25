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
 */
const ADMIN_URL = process.env.ADMIN_URL;
const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const ADMIN_ASSET_PREFIXES = ['/_next', '/media', '/brand', '/icon', '/apple-icon', '/favicon'];

function isAsset(pathname: string): boolean {
  return ADMIN_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

  const host = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;
  const onAdminHost = host === adminOrigin.host;
  const onPublicHost = host === publicOrigin.host;

  if (isAsset(pathname)) return NextResponse.next();

  if (onAdminHost) {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/admin', adminOrigin));
    }

    /*
     * The back office keeps `/admin/*` URLs, so a dashboard link and a typed
     * `admin.host/vendor-applications` must both land on the same page. Bare
     * paths are rewritten to their `/admin` equivalent; auth routes, APIs and
     * assets are left alone.
     */
    const passThrough =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/sign-in') ||
      pathname.startsWith('/sign-up') ||
      pathname.startsWith('/brand');

    if (!passThrough) {
      return NextResponse.rewrite(
        new URL(`/admin${pathname}${request.nextUrl.search}`, request.url),
      );
    }

    return NextResponse.next();
  }

  if (onPublicHost && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return NextResponse.redirect(new URL(pathname, adminOrigin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
