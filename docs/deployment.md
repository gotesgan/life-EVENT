# Deploying Life Events

The app is a standard Next.js 16 server (PPR enabled) with PostgreSQL, so it runs
on any Node host: Vercel, Railway, Render, Fly.io, a Docker container, or a VPS.
The deployed build itself needs no special configuration beyond environment
variables — but production **refuses to boot without them** by design, which is
the error below.

## If the deployment shows this

```
Invalid server environment configuration:
  - BETTER_AUTH_SECRET: is a placeholder value
  - IP_HASH_SALT: must be ... at least 16 characters
  - NEXT_PUBLIC_APP_URL: must be the public origin in production
  - R2_BUCKET: Media storage is not configured in production
```

that is `src/lib/env.ts` failing closed. Nothing is wrong with the build; the
platform is missing real values. Set the variables below and redeploy.

## Required variables

| Variable               | Value                                                                         | Where it is needed                    |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`         | Pooled PostgreSQL URL (e.g. Neon `-pooler` host)                              | runtime                               |
| `DIRECT_URL`           | Direct (non-pooled) PostgreSQL URL                                            | `prisma migrate` only                 |
| `NEXT_PUBLIC_APP_URL`  | Real public origin, e.g. `https://life-events.vercel.app` — **not** localhost | build **and** runtime (it is inlined) |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 32` (32+ chars, not a placeholder)                      | runtime                               |
| `IP_HASH_SALT`         | `openssl rand -hex 16` (16+ chars)                                            | runtime                               |
| `R2_ACCOUNT_ID`        | Cloudflare account id                                                         | runtime                               |
| `R2_ACCESS_KEY_ID`     | R2 API token access key                                                       | runtime                               |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret                                                           | runtime                               |
| `R2_BUCKET`            | bucket name                                                                   | runtime                               |
| `R2_PUBLIC_BASE_URL`   | public bucket domain, e.g. `https://media.example.com` (no trailing slash)    | runtime                               |
| `BETTER_AUTH_URL`      | same origin as `NEXT_PUBLIC_APP_URL` (optional but recommended)               | runtime                               |

Everything else in `.env.example` is optional (Resend, Meta, rate limits, admin
host).

### Media without R2

Production deliberately refuses the local filesystem driver because media would
be written to an ephemeral disk and 404 later. On a serverless host (Vercel,
Netlify) **R2 is required for uploads**. As a temporary demo stopgap only, set
`ALLOW_LOCAL_MEDIA_STORAGE=true` so the app boots — seeded listing images still
work (they are static files), but admin uploads will not persist reliably.

## Database setup (once)

```bash
# from your machine, against the hosted database
export DIRECT_URL="postgresql://...direct..."
pnpm db:deploy      # applies prisma/migrations

# demo/staging only: creates the catalogue, seed listings and the admin user
export DATABASE_URL="postgresql://...pooled..."
pnpm db:seed
```

Do not seed a real production database with demo listings unless you want them.
The seeded admin account is `admin@liveenvt.test` / `AdminPass123!` — change it.

## Catalogue bootstrap on deploy

The venue catalogue is data, not code: pushing a branch does not put listings in
the database. `pnpm vercel-build` therefore runs, in order:

```bash
prisma generate
prisma migrate deploy          # needs DIRECT_URL
pnpm tsx scripts/deploy/bootstrap-catalogue.mts
next build
```

The bootstrap loads the reference tables (locations, categories, event types,
attributes, amenities) and then imports every venue from
`data/venues/listings.json`. It is idempotent by slug, so a redeploy repairs the
catalogue rather than duplicating it. It deliberately does **not** run
`prisma/seed.ts`: that also writes demo users, enquiries and audit rows.

It is opt-in. Set `BOOTSTRAP_CATALOGUE_ON_DEPLOY=true` on the environment that
owns the catalogue and leave it unset on previews — a preview deployment shares
the production database unless its variables say otherwise, so an ungated build
would let a branch publish to the live catalogue. Without the flag the script
exits 0 and does nothing.

`CATALOGUE_PUBLISH_MODE` decides what goes live:

| Value           | Effect                                                                                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all` (default) | Every imported venue is published, including the ones `venues:build` held back for having fewer than three photographs or for tripping the location-conflict / spam checks. Those render the placeholder motif. |
| `json`          | Respect the statuses in `listings.json` — only listings with three or more photographs go live.                                                                                                                 |

Run it by hand against any database with
`pnpm tsx scripts/deploy/bootstrap-catalogue.mts --force`.

## Platform notes

### Vercel

1. Project → Settings → Environment Variables: add the table above for
   **Production** (and Preview if you use it).
2. `NEXT_PUBLIC_APP_URL` must be set **before** the build; after changing any
   `NEXT_PUBLIC_*` value, redeploy (Vercel's "Redeploy" is enough).
3. Build command: leave it at the default. Vercel runs `pnpm vercel-build` when
   that script exists, which generates the Prisma client, applies migrations,
   bootstraps the catalogue and then builds. Install command: `pnpm install`
   (its `postinstall` also generates the client).
4. Node.js: project uses Node ≥ 24 (`package.json` engines); select Node 24 if
   the platform default is older.
5. Point the domain at the project and use that exact origin for
   `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`.

### Docker / VPS

Build once (`pnpm build`), run `pnpm start` with the same variables, and mount a
persistent disk only if you intentionally run the local media driver. Put TLS in
front; Better Auth marks cookies `Secure` in production, so sign-in will not
persist over plain HTTP.

### Cloudflare Workers

Not supported for this stack as written — see `docs/cloudflare-workers.md`
(Prisma 7 runtime-WASM and PPR limits). Cloudflare is still useful in front of a
Node host for DNS/CDN/WAF, and for R2 media.

## Health check after deploy

- `GET /` → 200 and the hero renders.
- `GET /vendors` → 200 with listings (proves database access).
- `/sign-in` with the admin account → `/admin` loads (proves auth + sessions).
- Admin → Settings → Email/Meta show delivery logs (rows may be SKIPPED until
  providers are configured).
