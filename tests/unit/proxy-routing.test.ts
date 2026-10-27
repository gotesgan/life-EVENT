import { describe, expect, it } from 'vitest';
import { resolveHostRoute } from '@/proxy';

/**
 * Host routing for the admin panel.
 *
 * `resolveHostRoute` is the pure decision behind `proxy.ts`; the Next.js request
 * wrapper only translates its result. Extracted so the rules can be tested
 * without booting a server: which host serves which path, and exactly which
 * paths are allowed through on the admin host.
 */
const adminOrigin = new URL('https://admin.example.com');
const publicOrigin = new URL('https://www.example.com');

function route(host: string, pathname: string, search = '') {
  return resolveHostRoute({ host, pathname, search, adminOrigin, publicOrigin });
}

describe('resolveHostRoute', () => {
  it('sends the public host /admin to the admin host', () => {
    expect(route('www.example.com', '/admin')).toEqual({
      kind: 'redirect',
      to: 'https://admin.example.com/admin',
    });
    expect(route('www.example.com', '/admin/enquiries', '?status=NEW')).toEqual({
      kind: 'redirect',
      to: 'https://admin.example.com/admin/enquiries?status=NEW',
    });
  });

  it('leaves ordinary public pages alone', () => {
    expect(route('www.example.com', '/')).toEqual({ kind: 'next' });
    expect(route('www.example.com', '/vendors')).toEqual({ kind: 'next' });
  });

  it('sends the admin host root to /admin', () => {
    expect(route('admin.example.com', '/')).toEqual({
      kind: 'redirect',
      to: 'https://admin.example.com/admin',
    });
  });

  it('keeps /admin, auth and API paths on the admin host', () => {
    expect(route('admin.example.com', '/admin')).toEqual({ kind: 'next' });
    expect(route('admin.example.com', '/admin/listings')).toEqual({ kind: 'next' });
    expect(route('admin.example.com', '/sign-in', '?next=/admin')).toEqual({ kind: 'next' });
    expect(route('admin.example.com', '/api/auth/session')).toEqual({ kind: 'next' });
  });

  it('rewrites bare admin-host paths to their /admin equivalent', () => {
    expect(route('admin.example.com', '/vendor-applications')).toEqual({
      kind: 'rewrite',
      to: '/admin/vendor-applications',
    });
    expect(route('admin.example.com', '/enquiries', '?status=NEW&page=2')).toEqual({
      kind: 'rewrite',
      to: '/admin/enquiries?status=NEW&page=2',
    });
  });

  it('never routes assets through the admin redirects', () => {
    for (const asset of ['/_next/static/chunk.js', '/media/seed/a.jpg', '/brand/le-mark.png']) {
      expect(route('www.example.com', asset)).toEqual({ kind: 'next' });
      expect(route('admin.example.com', asset)).toEqual({ kind: 'next' });
    }
  });

  it('does not treat a lookalike host as either origin', () => {
    expect(route('admin.example.com.evil.test', '/admin')).toEqual({ kind: 'next' });
    expect(route('www.example.com.evil.test', '/admin')).toEqual({ kind: 'next' });
  });
});
