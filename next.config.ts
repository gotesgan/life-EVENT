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
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
