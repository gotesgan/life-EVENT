import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/env';
/**
 * Crawl rules.
 *
 * The catalogue is the only thing worth indexing, and it is finite: a handful of
 * category pages, a handful of city pages, and one page per published listing.
 * Every filter combination multiplies that into endless near-duplicate URLs, so
 * the query parameters that describe a *filter* are disallowed while the clean
 * paths stay open.
 *
 * `location` is the deliberate exception. `/vendors?location=<city>` is the only
 * city surface the product has, and those URLs are listed in the sitemap, so they
 * must stay crawlable. Every URL that pairs `location` with another filter is
 * still blocked by that other parameter's rule.
 *
 * Signed-in areas are disallowed as well: they return per-user data and are
 * already marked `noindex` in their own metadata.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  // `Host:` wants a hostname, not a URL — `getAppUrl()` returns the origin.
  const host = new URL(base).host;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          /* Private and per-user surfaces. */
          '/account',
          '/sign-in',
          '/sign-up',
          '/admin',
          '/api/',
          '/local-media/',

          /* Pagination and sorting: the same results in a different order. */
          '/*?*page=',
          '/*?*sort=',

          /* The search term and the boolean/every-value filters. */
          '/*?*q=',
          '/*?*priceMin=',
          '/*?*priceMax=',
          '/*?*capacityMin=',
          '/*?*capacityMax=',
          '/*?*verified=',
          '/*?*featured=',
          '/*?*eventType=',
          '/*?*amenity=',

          /* Category-specific attribute filters (`f.<code>=…`). */
          '/*?*f.',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host,
  };
}
