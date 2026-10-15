# Next.js 16.4.0 — Conventions Cheat-Sheet (from locally bundled docs)

Source of truth: `node_modules/next/dist/docs/` of the installed `next@16.4.0`.
All paths below are relative to that directory. Nothing here comes from memory or the web.
This scaffold currently has `cacheComponents: true` and `partialPrefetching: true` in `next.config.ts`.

---

## 1. Project / file conventions

Routing files (`01-app/01-getting-started/02-project-structure.md#routing-files`):

| File           | Extensions      | Purpose                      |
| -------------- | --------------- | ---------------------------- |
| `layout`       | `.js .jsx .tsx` | Layout                       |
| `page`         | `.js .jsx .tsx` | Page                         |
| `loading`      | `.js .jsx .tsx` | Loading UI (Suspense)        |
| `not-found`    | `.js .jsx .tsx` | Not found UI                 |
| `error`        | `.js .jsx .tsx` | Error UI                     |
| `global-error` | `.js .jsx .tsx` | Global error UI              |
| `route`        | `.js .ts`       | API endpoint                 |
| `template`     | `.js .jsx .tsx` | Re-rendered layout           |
| `default`      | `.js .jsx .tsx` | Parallel-route fallback page |

Component hierarchy (`02-project-structure.md#component-hierarchy`): `layout.js` → `template.js` → `error.js` → `loading.js` → `not-found.js` → `page.js`/nested `layout.js`.

**Root layout must define `<html>` and `<body>`** and is required: "The `app` directory **must** include a **root layout**" (`03-file-conventions/layout.md`). Do not hand-write `<head>`; use the Metadata API.

**`page.tsx`** props are promises:

```tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const filters = (await searchParams).filters;
}
```

(`03-file-conventions/page.md`)

**`layout.tsx`** gets `children` (required) + `params` (promise). Layouts do **not** rerender on navigation, cannot access `searchParams` or pathname (use `useSearchParams`/`usePathname` in a Client Component), and cannot receive the raw request (`layout.md` "Caveats").

**`loading.tsx`**: no props; wraps `page.js`/`not-found.js`/nested layouts in Suspense, but not `layout.js`/`template.js`/`error.js` in the same segment (`03-file-conventions/loading.md`).

**`error.tsx`** — must be a Client Component; **in 16.4 the stable prop is `retry`, not `reset`**:

```tsx
'use client';
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <button onClick={() => retry()}>Try again</button>;
}
```

Version history: `v16.3.0` `retry` prop became stable; `v16.2.0` `unstable_retry` added (`03-file-conventions/error.md`). `reset()` still exists but docs recommend `retry()`.

**`global-error.tsx`** must include `<html>`/`<body>`, cannot export `metadata`/`generateMetadata` (`error.md#global-error`).

**`not-found.tsx`**: no props. Adds `<meta name="robots" content="noindex" />`; before streaming it returns 404, after streaming the status stays 200 (`03-file-conventions/not-found.md`, `loading.md#status-codes`). New in 16.3 docs: experimental `global-not-found.js` behind `experimental.globalNotFound: true` — must return a full HTML document (`not-found.md`).

**`template.tsx`**: `{ children }` only; given a unique key and remounts on segment change (`03-file-conventions/template.md`).

**`default.tsx`**: parallel-route fallback. **16 breaking change**: every parallel-route slot (including implicit `children`) now requires a `default.js` or the build fails. To keep the old 404 behaviour:

```tsx
// app/@modal/default.tsx
import { notFound } from 'next/navigation';
export default function Default() {
  notFound();
}
```

(`02-guides/upgrading/version-16.md#parallel-routes-defaultjs-requirement`, `03-file-conventions/default.md`)

**Route groups / dynamic segments**: `(folder)` omitted from URL; `[slug]`, `[...slug]` catch-all, `[[...slug]]` optional catch-all (`route-groups.md`, `dynamic-routes.md`). Private folders `_folder` opt a subtree out of routing (`02-project-structure.md#private-folders`).

**`generateStaticParams`** returns `{ segment: value }[]` (`{ slug: string[] }[]` for catch-all); no params argument unless nested; available for Route Handlers too (`04-functions/generate-static-params.md`). **16 change**: returning `[]` errors under Cache Components; must return at least one param (`02-guides/migrating-to-cache-components.md#generatestaticparams-must-return-at-least-one-param`).

**`generateMetadata`** signature (`04-functions/generate-metadata.md`):

```tsx
export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const previousImages = (await parent).openGraph?.images || [];
  return { title: product.title, openGraph: { images: [...previousImages] } };
}
```

Only in Server Components; cannot coexist with the static `metadata` export in the same segment.

**New / renamed in 16** (`02-guides/upgrading/version-16.md`): `middleware` → `proxy` (and `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`); `experimental.turbopack` → top-level `turbopack`; `unstable_cacheLife`/`unstable_cacheTag` → `cacheLife`/`cacheTag`; `unstable_rootParams` → `next/root-params`; `experimental.ppr`/`experimental_ppr`, `experimental.dynamicIO`, `experimental.useCache`, `next lint`, AMP, and runtime config are removed. Full list in §14.

---

## 2. Dynamic (request-time) APIs

`cookies`, `headers`, `draftMode` are **async in 16 — synchronous access is fully removed** ("Starting with **Next.js 16**, synchronous access is fully removed."). Same for `params`/`searchParams` in `layout/page/route/default/opengraph-image/twitter-image/icon/apple-icon` (`02-guides/upgrading/version-16.md#async-request-apis-breaking-change`).

```tsx
import { cookies, headers, draftMode } from 'next/headers';
const cookieStore = await cookies(); // read everywhere; .set/.delete only in Server Action/Route Handler
const theme = cookieStore.get('theme')?.value;
const headersList = await headers(); // read-only Web Headers
const { isEnabled } = await draftMode();
```

`cookies()` methods: `get`, `getAll`, `has`, `set(name, value, options)`, `delete`, `toString`; options `expires`, `maxAge`, `domain`, `path` (default `/`), `secure`, `httpOnly`, `sameSite`, `priority`, `partitioned` (`04-functions/cookies.md`). Setting cookies is **not** supported during Server Component rendering.

`draftMode()`: `isEnabled`, `enable()`, `disable()`; toggling only in Route Handlers/Server Actions; `isEnabled` is readable inside `use cache` but `enable()`/`disable()` throw there (`04-functions/draft-mode.md`).

**`connection()`** — import from `next/server`, `function connection(): Promise<void>`:

```ts
import { connection } from 'next/server';
export async function getVisitorCount() {
  await connection();
  return db.prepare('SELECT value FROM counters WHERE name = ?').get('visitors');
}
```

"`connection` replaces `unstable_noStore`". Under Cache Components the docs prefer `io()` for excluding content from the static shell; use `connection()` when rendering must wait for a real request (`04-functions/connection.md`).

---

## 3. Route Handlers (`src/app/api/**/route.ts`)

Supported: `GET POST PUT PATCH DELETE HEAD OPTIONS`; unsupported → `405`. `route.js` cannot sit at the same route as `page.js` (`01-getting-started/15-route-handlers.md`).

```ts
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params; // context.params is a Promise
  const q = request.nextUrl.searchParams.get('q'); // query params
  return NextResponse.json({ id, q });
}

export async function POST(request: Request) {
  const body = await request.json(); // or await request.formData()
  return Response.json({ ok: true }, { status: 201, headers: { 'x-trace': '1' } });
}
```

- `context.params` type is `Promise<{ team: string }>` etc.; helper `RouteContext<'/users/[id]'>` is global after typegen (`03-file-conventions/route.md#route-context-helper`).
- Status/headers: `new Response(body, { status, headers })`, `Response.json(data, init)`, or `NextResponse.json(data, { status: 500 })` (`route.md`, `04-functions/next-response.md`). `NextResponse.redirect(new URL('/new', request.url))`.
- Cookies in handlers: `await cookies()` then `.get/.set/.delete`, or a `Set-Cookie` header (`route.md#cookies`).
- **Caching**: "Route Handlers are not cached by default." Without Cache Components opt in with `export const dynamic = 'force-static'`. **With Cache Components, `GET` follows the page model**: prerendered when static, request-time when it reads uncached/runtime data; cache data via a helper marked `'use cache'` — "'use cache' cannot be used directly inside a Route Handler body; extract it to a helper function." (`15-route-handlers.md#with-cache-components`, `02-guides/migrating-to-cache-components.md#route-handlers-get`).

---

## 4. Caching in 16

### What `cacheComponents: true` changes

`01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`: "Data fetching is dynamic by default, and you choose what to cache at the page, component, or function level. Next.js prerenders a static HTML shell that is served immediately while dynamic content streams in when ready."

Concretely, with the flag on:

1. **PPR becomes the default**; `experimental.ppr` and `experimental_ppr` are removed. "the `experimental.ppr` configuration flag and the `experimental_ppr` route segment configuration are no longer necessary and have been removed."
2. **`dynamic`, `revalidate`, `fetchCache` exports error**; under Cache Components `dynamicParams` also errors: `Route segment config "dynamicParams" is not compatible with nextConfig.cacheComponents.` (`03-file-conventions/02-route-segment-config/index.md` version history; `02-guides/migrating-to-cache-components.md`).
3. **Node.js runtime only** — `runtime = 'edge'` is not supported.
4. **Uncached data / runtime APIs outside `<Suspense>`** surface `blocking-prerender-*` insights and build errors.
5. `use cache`, `cacheLife`, `cacheTag` become available; `use cache` requires the flag (`01-directives/use-cache.md`).
6. GET Route Handlers follow the page prerender model (`15-route-handlers.md`).
7. Client navigation preserves component state via React `<Activity>` (`cacheComponents.md#navigation-with-activity`).

### `'use cache'`

```tsx
import { cacheLife } from 'next/cache';
export async function getUsers() {
  'use cache';
  cacheLife('hours');
  return db.query('SELECT * FROM users');
}
```

Function/component/file level; cached functions must be async. Cache key = build ID + function ID + serializable args + captured closure values. Args/returns must be serializable; class instances, functions (except pass-through), symbols, URL instances are unsupported; `React.cache` is isolated inside a cache scope. Runtime APIs (`cookies()`, `headers()`, `searchParams`) are **not** allowed inside `use cache` — read them outside and pass values as arguments. Runtime storage defaults to in-memory LRU (not durable on serverless); `'use cache: remote'` for a shared durable handler, `'use cache: private'` for per-request runtime data cached in the browser (`01-directives/use-cache.md`).

### `cacheLife` / `cacheTag` / revalidation (`04-functions/cacheLife.md`, `cacheTag.md`, `revalidateTag.md`, `updateTag.md`, `revalidatePath.md`)

Presets (`stale`/`revalidate`/`expire`): `default` 5m/15m/never · `seconds` 30s/1s/1m · `minutes` 5m/1m/1h · `hours` 5m/1h/1d · `days` 5m/1d/1w · `weeks` 5m/1w/30d · `max` 5m/30d/1y. Client stale time has a **30s minimum**; `cacheLife` can only be called inside a cache directive scope (module scope throws). Custom/redefined profiles live in top-level `cacheLife` in `next.config.ts`. A `revalidate: 0` or `expire < 5min` cache is excluded from prerenders (`#prerendering-behavior`); nesting a short-lived cache inside a `use cache` without an explicit `cacheLife` **fails the build**.

```tsx
async function getPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')          // up to 128 tags/call, ≤256 chars each
  return db.post.findMany()
}

// Server Action, read-your-own-writes
'use server'
import { updateTag, revalidatePath } from 'next/cache'
export async function createPost() {
  await db.post.create({ ... })
  updateTag('posts')          // expires now; next read waits for fresh data
  revalidatePath('/posts')
}
```

- **`updateTag(tag)`** — Server Actions only ("cannot be used in Route Handlers, Client Components, or any other context"), immediate expiry (`updateTag.md`).
- **`revalidateTag(tag, profile)`** — the **second argument is now required**; single-arg form is deprecated and produces a TypeScript error. Use `'max'` for stale-while-revalidate, `{ expire: 0 }` to expire immediately; valid in Server Functions and Route Handlers, not Client Components or Proxy (`04-functions/revalidateTag.md`).
- **`revalidatePath(path, type?: 'page' | 'layout')`** — unchanged; literal path, or route pattern + `type`; with rewrites, pass the destination path (`04-functions/revalidatePath.md`).
- `refresh()` from `next/cache` refetches the current route's RSC payload without invalidating tags (`07-mutating-data.md#refresh-data`).

### When dynamic data requires `<Suspense>`

Under Cache Components, uncached DB reads and runtime APIs must be inside a `<Suspense>` boundary or cached. Without a boundary: "the dev overlay surfaces the **blocking-route** insight"; at build, routes that would otherwise prerender raise an error — "be explicit: cache the access, move it into a `<Suspense>` boundary, or opt the route out" (`01-getting-started/08-caching.md`, `migrating-to-cache-components.md#cookies-headers-and-searchparams`). `useSearchParams` **always** needs a boundary; `usePathname`/`useParams`/`useSelectedLayoutSegment(s)` need one only when the pathname depends on unknown dynamic params. Synchronous IO (`Date.now()`, `Math.random()`, `crypto.randomUUID()`) throws at prerender and is **not** cleared by `instant = false`; fix with `connection()` + `<Suspense>`, or `use cache` (`migrating-to-cache-components.md#adopting-incrementally`).

```tsx
export default function Page({ searchParams }: PageProps<'/search'>) {
  return (
    <Suspense fallback={<p>Loading results...</p>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}
async function Results({ searchParams }: Pick<PageProps<'/search'>, 'searchParams'>) {
  const { q } = await searchParams;
  return <List items={await search(q)} />;
}
```

### What happens at `next build` if a page reads uncached request data

- **`cacheComponents: true`** — the build/validation reports it. `local-development`/migration docs: uncached or runtime data outside `<Suspense>` on an otherwise prerenderable route raises a build error; the build also fails on `dynamic`/`revalidate`/`fetchCache`/`dynamicParams` exports, on an empty `generateStaticParams`, on nested short-lived caches without an explicit outer `cacheLife`, and on prerender-time random/time/crypto calls. So yes — **build failures are the designed enforcement mechanism**, and the same code can pass `next build` and fail at `next start` if the offending branch only runs for params not exercised at build time (`dynamic-routes.md#with-generatestaticparams`).
- **`cacheComponents: false`** — previous model: `cookies()`/`headers()`/`searchParams` (or `dynamic = 'force-dynamic'`) simply opt the whole route into dynamic rendering. No Suspense requirement, no build error, no PPR/static shell; `dynamic`, `revalidate`, `fetchCache`, `dynamicParams` work again (`02-guides/caching-without-cache-components.md`).

### **Is `cacheComponents: true` right for an all-DB, per-user app?**

The bundled docs never answer this directly — **UNVERIFIED as a doc recommendation.** What the docs _do_ state, which drives the decision:

- `readYourOwnData`-per-user content cannot use `use cache` as-is, because `cookies()`/`headers()` are forbidden inside cache scopes; you must read the session outside and pass values in, and per-user results in the default in-memory cache are not durable on serverless (`use-cache.md#runtime-caching-considerations`).
- Under `true`, every such read must sit behind `<Suspense>` (or be opted out with `instant = false`). The reward is a real static shell for nav/layout/chrome and instant navigations (`08-caching.md#maximizing-the-static-shell`, `02-guides/instant-navigation.md`).
- Under `false`, a uniformly dynamic app needs no Suspense plumbing at all, but you lose `use cache`/`cacheLife`/`cacheTag`/PPR **and** `partialPrefetching` becomes invalid — "`partialPrefetching` requires `cacheComponents`. Without it, `next dev` and `next build` throw at config validation." (`05-config/01-next-config-js/partialPrefetching.md`).

**Recommendation (engineering judgment, not a doc quote):** keep `cacheComponents: true` **and** `partialPrefetching: true`, because (a) `partialPrefetching` is already set and is invalid without it, (b) docs state both "will be enabled everywhere in the next major release", and (c) per-user pages still get an instantly-served shell for their layout/nav while the DB data streams. Pay the cost explicitly: wrap each DB-reading subtree in `<Suspense>` (or call `connection()` + `<Suspense>`), give every `page`/`layout`/`default` a `loading.tsx`-style fallback, and use `export const instant = false` on segments you are not ready to restructure. If the team wants zero build friction and is willing to abandon PPR/partial prefetching for now, `cacheComponents: false` + removing `partialPrefetching` is a legitimate, simpler alternative — with the documented note that migrating later "is not a rename-only change: it can surface build errors for uncached data outside of `<Suspense>`" (`version-16.md#experimentaldynamicio-and-experimentalusecache`).

---

## 5. Partial prefetching and `<Link>`

`05-config/01-next-config-js/partialPrefetching.md`: with the flag on, "Next.js prefetches one reusable App Shell per route instead" of ~N per-link prefetches. Routes that read `cookies()`/`headers()` produce a session-specific App Shell cached per session on the client. `<Link prefetch={true}>` additionally resolves URL data (`params`, `searchParams`, full URL) and the cached content behind it — "It costs a server invocation per prefetchable link."

`<Link prefetch>` values (`02-components/link.md#prefetch`): `"auto"`/`null` (default; App Shell under Partial Prefetching), `true` (full/per-link), `false` (never). Prefetching is production-only.

Per-segment override, Cache Components only (`03-file-conventions/02-route-segment-config/prefetch.md`):

```tsx
export const prefetch = 'partial'; // 'auto' | 'partial' | 'force-disabled'
```

`'force-disabled'` never prefetches that segment (use for rarely visited auth pages). `<Link prefetch={false}>` wins at link level. Also new in 16: Turbopack by default, layout deduplication and incremental prefetching (no code changes required) (`version-16.md#enhanced-routing-and-navigation`).

---

## 6. `next.config.ts` options

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  images: {
    remotePatterns: [
      // Object form (or `new URL('https://cdn.example.com/**')`)
      { protocol: 'https', hostname: 'assets.example.com', port: '', pathname: '/**', search: '' },
    ],
    localPatterns: [{ pathname: '/assets/**', search: '?v=1' }],
  },

  serverExternalPackages: ['@acme/ui'],
  typedRoutes: true,
  reactCompiler: true, // stable in 16, not enabled by default
  turbopack: {/* top-level since 16 */},
};

export default nextConfig;
```

- **Allow an external image host (Cloudflare R2 / custom domain)**: `images.remotePatterns` with `protocol`/`hostname`/`pathname`(/`port`/`search`). Wildcards: `*` one segment/subdomain, `**` any number (only at the end/beginning). Omitting a field implies `**` "and is not recommended". Any non-matching request returns `400` (`02-components/image.md#remotepatterns`). The config reference also shows `remotePatterns: [new URL('https://example.com/account123/**')]` (`05-config/01-next-config-js/images.md`). `images.domains` is deprecated in favour of `remotePatterns` (`version-16.md#imagesdomains-configuration-deprecated`).
- **`serverExternalPackages`**: opts a dependency out of Server Component bundling and uses native `require`. `@prisma/client` and `prisma` are **already in the auto-external list**, so Prisma needs no entry (`05-config/01-next-config-js/serverExternalPackages.md`).
- **`typedRoutes: true`** is now stable — use it instead of `experimental.typedRoutes` (`05-config/01-next-config-js/typedRoutes.md`).
- **`experimental`** relevant options: `serverActions.allowedOrigins` / `serverActions.bodySizeLimit` (`05-config/01-next-config-js/serverActions.md`), `typedEnv` (`05-config/02-typescript.md`), `taint` (`05-config/01-next-config-js/taint.md`), `globalNotFound`, `hideLogsAfterAbort`, `instantInsights.validationLevel`, `useTypeScriptCli`. `experimental.turbopack`, `experimental.dynamicIO`, `experimental.useCache`, `experimental.ppr`, `experimental.serverComponentsExternalPackages` are gone/renamed.
- Version-16 image default changes to be aware of (`version-16.md#nextimage-changes`): `minimumCacheTTL` 60s → **4h**; `16` removed from `imageSizes`; `qualities` now defaults to **`[75]`** (other values coerced/`400` on direct requests); `maximumRedirects` default now **3**; local IPs blocked unless `dangerouslyAllowLocalIP: true`; local images with query strings require `localPatterns.search`.

---

## 7. `next/image`

Props (`02-components/image.md#props`): `src` (required), `alt` (required), `width`/`height` (both required unless static import or `fill`), `fill`, `loader`, `sizes`, `quality` (1–100, default 75), `preload`, `placeholder` (`'empty'` default | `'blur'` | data URL), `blurDataURL`, `loading` (`'lazy'` default | `'eager'`), `unoptimized`, `overrideSrc`, `decoding`, `style`, `onLoad`, `onError`. Deprecated: `onLoadingComplete`, and **`priority` — "Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property."**

```tsx
// Responsive fill image
<div className="relative">
  <Image fill src={url} alt="" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
</div>

// Hero / LCP image
<Image src={hero} alt="" width={1200} height={630} preload />
```

- `sizes` should be used with `fill` or responsive CSS; without it the browser assumes `100vw` and Next generates only `deviceSizes` for a `fill` image (`image.md#sizes`).
- `fill`: parent **must** set `position: relative|fixed|absolute`; control cropping with `objectFit` (`image.md#fill`).
- `placeholder="blur"` requires `blurDataURL` except for static imports of jpg/png/webp/avif (auto) (`image.md#placeholder`).
- "In most cases, you should use `loading=\"eager\"` or `fetchPriority=\"high\"` instead of `preload`" (`image.md#preload`).
- `next/legacy/image` is deprecated — import from `next/image` (`version-16.md`).

---

## 8. `next/font` (Google variable font, e.g. Manrope)

Props table (`02-components/font.md#reference`): `weight`, `style`, `subsets` (Google only), `axes` (Google only), `display` (default `'swap'`), `preload` (default `true`), `fallback`, `adjustFontFallback`, `variable`, `declarations` (local only). For a variable font you do **not** set `weight` ("If loading a variable font, you don't need to specify the font weight").

```tsx
// app/fonts.ts — load once, import everywhere
import { Manrope } from 'next/font/google';

export const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});
```

```tsx
// app/layout.tsx — apply globally via the CSS variable
import { manrope } from './fonts';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* globals.css */
body {
  font-family: var(--font-manrope);
}
```

Alternative to the CSS variable is `className={manrope.className}` on `<html>` (`font.md#applying-styles`). Docs: load the font once and import the font object, do not call the loader in multiple files (`font.md#using-a-font-definitions-file`). `subsets` values get a preload link when `preload` is true (the default) (`font.md#subsets`). No v16-specific font changes were found in the bundled docs.

---

## 9. Metadata & SEO

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://acme.com'),
  title: { default: 'Acme', template: '%s | Acme' },
  description: '...',
  alternates: { canonical: '/', languages: { 'en-US': '/en-US' } },
  openGraph: {
    title: 'Acme',
    url: 'https://acme.com',
    siteName: 'Acme',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Acme', images: ['https://acme.com/og.png'] },
  robots: { index: true, follow: true },
};
```

- **`metadataBase`** resolves relative URL fields; "Using a relative path in a URL-based `metadata` field without configuring a `metadataBase` will cause a build error" and it is typically set in the root layout (`generate-metadata.md#metadatabase`). With `use cache` in `generateMetadata`, `URL` is not serializable — return `url.toString()`.
- Fields: `title` (string or `{ default, template }`), `description`, `openGraph`, `twitter`, `robots`, `icons`, `alternates`, `verification`, `manifest`, `other` (`generate-metadata.md#metadata-fields`). `metadataBase` must be absolute; absolute field URLs ignore it.
- **`viewport` is separate** (`04-functions/generate-viewport.md`):
  ```tsx
  import type { Viewport } from 'next';
  export const viewport: Viewport = {
    themeColor: [{ media: '(prefers-color-scheme: dark)', color: 'black' }],
    colorScheme: 'dark',
  };
  ```
  The `metadata.viewport`/`themeColor`/`colorScheme` options are deprecated in favour of this export.
- **File-based metadata** (higher priority than the object): `robots.ts`, `sitemap.ts`, `opengraph-image`, `twitter-image`, `icon`, `apple-icon`, `favicon`, `manifest` (`02-project-structure.md#metadata-file-conventions`).
  ```ts
  // app/robots.ts
  import type { MetadataRoute } from 'next';
  export default function robots(): MetadataRoute.Robots {
    return {
      rules: { userAgent: '*', allow: '/', disallow: '/private/' },
      sitemap: 'https://acme.com/sitemap.xml',
    };
  }
  ```
  (`03-file-conventions/01-metadata/robots.md`; new in 16.3: per-agent `other` directives.)
  ```ts
  // app/sitemap.ts
  import type { MetadataRoute } from 'next';
  export default function sitemap(): MetadataRoute.Sitemap {
    return [
      { url: 'https://acme.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ];
  }
  ```
  **16 breaking change**: with `generateSitemaps`, the default export's `id` is now `Promise<string>`: `const id = await props.id` (`03-file-conventions/01-metadata/sitemap.md`, `version-16.md#async-id-parameter-for-sitemap`). Same async-`params`/`id` change for `opengraph-image`/`twitter-image`/`icon`/`apple-icon` generation functions (`version-16.md#async-parameters-for-icon-and-open-graph-image`).
- Streaming metadata: tags resolve after the initial UI and are appended to `<body>` for JS-capable bots; HTML-limited bots block (`generate-metadata.md#streaming-metadata`). Under Cache Components, `generateMetadata` reading runtime data on an otherwise-prerenderable page raises an error — use `use cache`, or add a `<Suspense>`-wrapped `connection()` "DynamicMarker" (`generate-metadata.md#with-cache-components`, `generateViewport.md#with-cache-components`).
- SEO/streaming: streaming responses start at `200`; a streamed `notFound()` gets a `noindex` meta tag (`loading.md#status-codes`).

---

## 10. Server Actions vs Route Handlers

```ts
// app/lib/actions.ts
'use server';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  await db.post.create({ data: { title: String(formData.get('title')) } });
  revalidatePath('/posts');
}
```

- `'use server'` at file top makes all exports Server Functions; inline at the top of an async function marks just that one. Server Functions are invoked over **POST only**; forms use `<form action={createPost}>`, buttons `formAction` (`07-mutating-data.md`, `01-directives/use-server.md`).
- Client Component integration: "It's not possible to define Server Functions in Client Components" — import from a `'use server'` file, or pass the action as a prop (`07-mutating-data.md`).
- Pending UI: `const [state, action, pending] = useActionState(createPost, false)` (`07-mutating-data.md#showing-a-pending-state`). Server Functions are dispatched one at a time on the client.
- Security: `Origin` vs `Host` CSRF check (`experimental.serverActions.allowedOrigins`), 1 MB default body limit (`bodySizeLimit`), encrypted action IDs, closure encryption via `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Every action is a public POST endpoint — always authenticate/authorize and validate input inside it (`02-guides/server-actions.md#security`, `05-config/01-next-config-js/serverActions.md`).
- Cache interaction: `updateTag` (immediate, Server Actions only), `revalidateTag(tag, 'max')` (SWR; works in actions and Route Handlers), `revalidatePath`, `refresh()`. `updateTag`/`revalidatePath`/`refresh` re-render the current route server-side and ship a new RSC payload in the same response; `revalidateTag` with a stale profile intentionally does not (`server-actions.md#choosing-a-cache-update`).
- **Server Actions vs Route Handlers**: use Route Handlers (`route.ts`) for HTTP endpoints, webhooks, non-UI responses, and third-party callers; use Server Actions for in-app mutations and forms. Route Handlers are the only place to read the raw `Request`/set CORS, and `updateTag` is unavailable there (`updateTag.md`, `route.md#cors`).

---

## 11. Middleware → Proxy (16 rename)

`middleware.ts` is **deprecated and renamed to `proxy.ts`** in 16; the file must export a single function named `proxy` (or default export). "The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured." `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize` (`version-16.md#middleware-to-proxy`, `03-file-conventions/middleware.md`, `proxy.md`).

```ts
// proxy.ts (project root, or inside src/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  if (!request.cookies.get('session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
```

- Matcher may be a string, array, or array of objects with `source`, `locale`, `has`, `missing`; values must be statically analyzable. Without a matcher, proxy runs on **every** request including `_next/static`, `_next/image` and `public/` (`proxy.md#matcher`).
- `runtime` config throws in Proxy. `NextProxy` type is available. `event.waitUntil(promise)` keeps background work alive (`proxy.md#params`).
- CORS via proxy, or returning `Response.json(..., { status: 401 })` directly (`proxy.md#producing-a-response`, `#cors`).
- **Gotcha**: Server Functions are POSTs to the route that uses them, "so a Proxy matcher that excludes a path will also skip Server Function calls on that path... Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone" (`proxy.md#execution-order`).
- Migration: `npx @next/codemod@canary middleware-to-proxy .` (`proxy.md#migration-to-proxy`).

---

## 12. Environment variables

- `.env*` files load into `process.env`; load order (first match wins): `process.env` → `.env.$(NODE_ENV).local` → `.env.local` (skipped when `NODE_ENV=test`) → `.env.$(NODE_ENV)` → `.env`. With a `src/` folder, env files stay in the project root. `$VAR` expansion is supported (`02-guides/environment-variables.md`).
- **`NEXT_PUBLIC_`** is required to expose a variable to the browser; such values are **inlined at build time** and "After being built, your app will no longer respond to changes to these environment variables." Dynamic lookups (`process.env[varName]`, `env.X`) are not inlined.
- Server-only values: read `process.env.*` in Server Components/handlers. To force a runtime (not build-time) read, call `await connection()` first (`version-16.md#runtime-configuration`). `serverRuntimeConfig`/`publicRuntimeConfig` are removed.
- Server-only enforcement: the docs use the [`server-only`](https://www.npmjs.com/package/server-only) package (`caching-without-cache-components.md#preloading-data`) and the experimental `taint` config to prevent leaking sensitive values to Client Components (`05-config/01-next-config-js/taint.md`). `experimental.typedEnv` generates env IntelliSense (`05-config/02-typescript.md`).

---

## 13. TypeScript

- **`next-env.d.ts`** is generated in the project root by `next dev`/`next build`/`next typegen`; "Its contents are an implementation detail and may change over time. Add it to `.gitignore`... Do not edit this file manually." It must be in the `tsconfig.json` `include` array (`05-config/02-typescript.md#next-envdts`).
- **`.next/types` include pattern** (required if you did not use `create-next-app`):
  ```json
  {
    "include": ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
    "exclude": ["node_modules"]
  }
  ```
  This repo's `tsconfig.json` additionally includes `.next/dev/types/**/*.ts` (16 splits dev/build output: "`next dev` command outputs to `.next/dev`" — `version-16.md#concurrent-dev-and-build`).
- **Generated global helpers** (no import needed; generated by `next dev`/`next build`/`next typegen`): `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>` (`page.md`, `layout.md`, `route.md`).
- **`typedRoutes: true`** validates literal `href`s and `next/navigation` `push`/`replace`/`prefetch`; non-literal hrefs need `as Route` (`02-typescript.md#statically-typed-links`).
- `next build` fails on TypeScript errors unless `typescript.ignoreBuildErrors: true`; `typescript.tsconfigPath` selects an alternate config. TS 7 can be used via the project-local `tsc` CLI (`experimental.useTypeScriptCli: false` reverts to the JS compiler API) (`05-config/01-next-config-js/typescript.md`, `02-typescript.md`).
- Requirements: Node.js 20.9+, TypeScript 5.1+ (`version-16.md#nodejs-runtime-and-browser-support`).

---

## 14. Deprecations & gotchas vs Next 15

**Hard removals / breaking (`02-guides/upgrading/version-16.md`)**

- Synchronous `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` — removed; must `await` (or React `use`).
- `opengraph-image`/`twitter-image`/`icon`/`apple-icon` image functions now receive `params` **and** `id` as promises; `generateImageMetadata` still gets sync `params`.
- `sitemap` with `generateSitemaps`: `id` is now `Promise<string>`.
- `experimental.ppr` and the `experimental_ppr` segment export **removed** — PPR is via `cacheComponents`.
- `experimental.dynamicIO` and `experimental.useCache` **removed** → `cacheComponents`.
- `unstable_rootParams` **removed** → `next/root-params`.
- `serverRuntimeConfig`/`publicRuntimeConfig` removed → env vars (+ `connection()` for runtime reads).
- AMP removed (`next/amp`, `useAmp`, `amp` config); `next lint` removed (`next build` no longer lints); `eslint` config option removed; `devIndicators.{appIsrStatus,buildActivity,buildActivityPosition}` removed.
- All parallel-route slots now require `default.js` or the build fails.
- Custom `webpack` config makes `next build` fail (Turbopack is default) — use `--webpack` to opt out. `next dev` and `next build` write separate output dirs (`.next/dev`); a lockfile prevents concurrent duplicates. `process.argv` no longer contains `'dev'` inside `next.config`.

**Renamed / re-signatured**

- `middleware.ts` → `proxy.ts`, export `middleware` → `proxy`; edge runtime unsupported in proxy; `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.
- `experimental.turbopack` → top-level `turbopack`.
- `revalidateTag(tag)` → **`revalidateTag(tag, profile)`** (single-arg deprecated, TS error); new `updateTag` and `refresh`.
- `unstable_cacheLife`/`unstable_cacheTag` → `cacheLife`/`cacheTag` (stable).
- `tag` limits: `revalidateTag`/`updateTag` tags ≤256 chars (longer tags are silently never assigned); `cacheTag()` accepts ≤128 tags per call.

**Under `cacheComponents: true` only**

- `dynamic`, `revalidate`, `fetchCache` exports error; `dynamicParams` errors; `generateStaticParams` returning `[]` errors; `runtime = 'edge'` unsupported; `unstable_noStore`/`noStore()` unnecessary (nothing is cached by default).
- Uncached data / `cookies()`/`headers()`/`searchParams` / random-time-crypto sync IO outside `<Suspense>` → build/validation errors.
- `useSearchParams` always needs `<Suspense>`; nav hooks need it when pathname depends on unknown params.
- Nested short-lived `use cache` without explicit outer `cacheLife` fails the build.
- Component state now persists across navigations via React `<Activity>` (dropdowns/dialogs/forms may need explicit resets).
- `use cache` entries are per-deployment and (by default) in-memory only — they do not carry across deploys or serverless instances, unlike `fetch` cache/`unstable_cache`.

**Other**

- `next/image`: `priority` deprecated → `preload`; `qualities` default `[75]`; `minimumCacheTTL` 4h; `imageSizes` drops `16`; `maximumRedirects` 3; local IPs blocked; `images.domains` deprecated; `next/legacy/image` deprecated.
- `next-env.d.ts` should be gitignored (previously commonly tracked).
- `error.tsx` `reset` → prefer `retry` (stable in 16.3).
- Turbopack does not support the Sass `~` prefix (`version-16.md#sass-node_modules-imports`).
- Next.js no longer overrides `scroll-behavior` during navigation unless `<html data-scroll-behavior="smooth">` (`version-16.md#scroll-behavior-override`).
- `next build` output no longer prints `size` / `First Load JS`.

---

## 15. Recommended config for this project

Justified by the docs above; the key tension is `cacheComponents` (see §4).

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Decision: keep both, or drop BOTH if you opt out.
  // partialPrefetching is invalid without cacheComponents (partialPrefetching.md).
  cacheComponents: true,
  partialPrefetching: true,

  typedRoutes: true, // stable; type-safe <Link> hrefs (typedRoutes.md)

  images: {
    // Cloudflare R2 custom domain / CDN — object or `new URL(...)` form (image.md#remotepatterns)
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com', port: '', pathname: '/**' }],
    localPatterns: [{ pathname: '/assets/**', search: '?v=1' }], // 16 requires this for local query strings
    minimumCacheTTL: 14400, // default in 16 (was 60); set explicitly to document intent
  },

  // Prisma is already auto-external (@prisma/client, prisma) — no entry needed.
  // serverExternalPackages: [],

  experimental: {
    serverActions: {
      // Add your production host(s) if you sit behind a proxy/CDN (server-actions.md#security)
      allowedOrigins: ['*.example.com'],
      bodySizeLimit: '2mb',
    },
    typedEnv: true, // env var IntelliSense (02-typescript.md)
  },
};

export default nextConfig;
```

`tsconfig.json`: keep the `create-next-app` defaults, but the `include` array **must** contain `next-env.d.ts` plus the generated type dirs — this repo already has `".next/types/**/*.ts"` and `".next/dev/types/**/*.ts"` (`version-16.md#concurrent-dev-and-build`, §13).

Operational rules that follow from the docs for this app:

1. Every `src/app/api/**/route.ts` handler that touches the DB is request-time by default under Cache Components; extract cacheable queries into `'use cache'` helpers, never put the directive in the handler itself (§3).
2. Put each DB-reading component in a `page`/`layout` behind `<Suspense>` with a real fallback; add `loading.tsx` per segment. Use `export const instant = false` on segments you have not restructured (Cache Components only) to keep the build green (`migrating-to-cache-components.md#opting-out-of-validation`).
3. Cookie-session auth: read the session with `await cookies()` in Server Components; write/clear it only in Server Actions or Route Handlers (§2). Consider `proxy.ts` for coarse redirects, but re-check auth inside every Server Action and Route Handler (§11).
4. Use `updateTag` after admin mutations and `revalidateTag(tag, 'max')` from webhooks/Route Handlers (§4); use `images.remotePatterns` for the R2 domain and replace any `priority` with `preload` (§6–7).
5. `next build` is the enforcement point under `cacheComponents: true` — verify there, not by memory (§4).

### Not answered by the bundled docs

- No explicit doc recommendation on `cacheComponents: true` vs `false` for an all-dynamic per-user app (the §4 decision is reasoned from the consequences the docs describe).
- No doc guidance on Prisma-specific patterns with `use cache` (serialization limits for Prisma model instances apply via the generic serialization rules in `use-cache.md#serialization`).
- Nothing in the bundled docs about a `cacheComponents`-specific `next/image` interaction or a Prisma `serverExternalPackages` requirement beyond the auto-external list.
