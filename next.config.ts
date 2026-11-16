import type { NextConfig } from 'next';

/**
 * `outputFileTracingRoot` is pinned to this project on purpose.
 *
 * The local filesystem storage driver resolves paths at runtime, which the
 * bundler correctly cannot analyse statically. Without a tracing root, Next
 * walks up from the project, finds a `package-lock.json` in the parent home
 * directory, and warns that it would include the entire home directory in the
 * server output. Pinning the root keeps the deployment bundle scoped to this
 * repository.
 *
 * `turbopack.root` fixes the same walk-up for module resolution.
 */
const projectRoot = process.cwd();

/**
 * The bucket's public host, when it is a custom domain.
 *
 * `next/image` only optimises remote sources whose hostname is allow-listed, and
 * `R2_PUBLIC_BASE_URL` is often a branded CDN domain rather than `*.r2.dev`. The
 * value is inlined at build time, which is why it must be set before the build.
 */
const r2PublicHost = (() => {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;

  try {
    const url = new URL(base);
    return {
      protocol: url.protocol === 'http:' ? ('http' as const) : ('https' as const),
      hostname: url.hostname,
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // The static shell plus streamed dynamic content model. Kept on deliberately:
  // see docs/design-system.md §10.3 for what it costs and why that cost was
  // accepted.
  cacheComponents: true,
  partialPrefetching: true,

  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },

  images: {
    // Listing media is served from the R2 public domain in production and from
    // the local driver in development. `next/image` is used with `unoptimized`
    // for those URLs, because the image is already transformed and cached
    // downstream — re-optimising it would double the transformation cost.
    // Seed photography is committed under `public/media/seed/`, so there is no
    // third-party image host to allow-list.
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      ...(r2PublicHost ? [r2PublicHost] : []),
    ],
  },
};

export default nextConfig;
