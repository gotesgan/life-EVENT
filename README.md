# Life Events

A multi-category **wedding and event business discovery and lead-generation platform**. Customers
discover providers, filter results, open a profile and send an enquiry; one central admin panel
manages listings, the category/attribute catalogue and the resulting leads.

This is deliberately **not** a booking, payment or vendor-marketplace system. The unit of value is a
qualified enquiry reaching a business.

---

## Stack

| Layer       | Choice                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Application | Next.js 16.4 (App Router), React 19, TypeScript strict, RSC by default                               |
| UI          | Mantine 9.7 — the only component and styling system (no Tailwind, no shadcn)                         |
| Font        | Manrope (UI family, weights 200–800, self-hosted via `next/font`; monospace for code/reference text) |
| Database    | PostgreSQL 16 (Neon in production)                                                                   |
| ORM         | Prisma 7 with the `@prisma/adapter-pg` driver adapter                                                |
| Auth        | Better Auth 1.7 — database sessions, `CUSTOMER` / `ADMIN` roles                                      |
| Media       | Cloudflare R2 via presigned uploads, with a local filesystem driver for dev/test                     |
| Validation  | Zod 4, with types inferred from the schemas                                                          |
| Tests       | Vitest 5 (unit / integration / API) and Playwright 1.64 (end-to-end)                                 |

Full reasoning for each choice, including the rejections: [docs/technology-decisions.md](docs/technology-decisions.md).

---

## Getting started

Requires Node 24+, pnpm 9+, and a running PostgreSQL 16.

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET (both required)
                              # DIRECT_URL is optional but recommended: without it migrations use DATABASE_URL
                              # NEXT_PUBLIC_APP_URL defaults to http://localhost:3000
                              # R2_* may be left blank — the local storage driver is used instead

# 3. Create the schema and seed realistic development data
pnpm db:deploy                # apply migrations
pnpm db:generate              # generate the Prisma client (Prisma 7 does not do this automatically)
pnpm db:seed                  # 21 listings, 25 categories, 24 attributes, 6 enquiries

# 4. Run
pnpm dev                      # http://localhost:3000
```

Or in one step after configuring `.env`:

```bash
pnpm setup
```

### Seeded sign-in accounts

| Role          | Email                 | Password           |
| ------------- | --------------------- | ------------------ |
| Administrator | `admin@liveenvt.test` | `AdminPass123!`    |
| Customer      | `priya@example.test`  | `CustomerPass123!` |
| Customer      | `arjun@example.test`  | `CustomerPass123!` |

These exist only in seed data for local development. Passwords are hashed with Better Auth's own
hasher, so they sign in through the normal flow — no special-casing in the application.

---

## Commands

| Command                             | What it does                                                     |
| ----------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                          | Development server                                               |
| `pnpm build` / `pnpm start`         | Production build and server                                      |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (`eslint-config-next`)                                    |
| `pnpm format` / `pnpm format:check` | Prettier                                                         |
| `pnpm typecheck`                    | `tsc --noEmit`, strict                                           |
| `pnpm test`                         | Unit + integration + API tests                                   |
| `pnpm test:unit`                    | No database required                                             |
| `pnpm test:integration`             | Real PostgreSQL, isolated `TEST_DATABASE_URL`                    |
| `pnpm e2e`                          | Playwright against a production build (`pnpm e2e:install` first) |
| `pnpm check`                        | Format check → lint → typecheck → tests                          |
| `pnpm db:migrate`                   | Create and apply a migration in development                      |
| `pnpm db:deploy`                    | Apply migrations (deploy step)                                   |
| `pnpm db:seed`                      | Re-run the idempotent seed                                       |
| `pnpm db:reset`                     | Drop, re-migrate, regenerate and re-seed                         |
| `pnpm db:studio`                    | Prisma Studio                                                    |

Integration tests **refuse to run** if `TEST_DATABASE_URL` is unset or equals `DATABASE_URL`, so they
cannot truncate development or production data.

**Continuous integration:** `.github/workflows/ci.yml` runs a `quality` job (format check, lint,
typecheck, unit + component tests, all without a database) and an `integration` job that starts a
`postgres:16` service, applies migrations, and runs the integration/API suites against
`TEST_DATABASE_URL`. Nothing else is enforced automatically — there is no pre-commit hook, so the
workflow is the gate.

### Verified state

Re-measured for this revision unless a row says otherwise:

| Check               | Result                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| `pnpm format:check` | Clean                                                                            |
| `pnpm lint`         | 0 problems (`npx eslint .`)                                                      |
| `pnpm typecheck`    | 0 errors (`npx tsc --noEmit`, `strict`)                                          |
| `pnpm test`         | **612 passed**, 0 failed, 0 skipped (36 files) — `npx vitest run`                |
| `pnpm build`        | Compiled successfully, 58/58 pages, no errors, local `.env` only                 |
| `pnpm e2e`          | **222 passed** (74 per project) across `desktop-light`, `desktop-dark`, `mobile` |

The repository contains 33 page routes, 50 API route files (48 wrapped in `apiHandler`), 6 migrations
and 12 documents in `docs/`.

---

## How the code is organised

```
src/app/                  Routes: pages (RSC) and api/**/route.ts (thin controllers)
src/components/           UI: ui/ primitives, listing/, filters/, enquiry/, layout/, admin/
src/server/domain/        Pure business rules — status machine, search clauses, disclosure, display
src/server/services/      Business rules, authorization, transactions (server-only)
src/server/repositories/  Complex queries — the only place that knows how search executes
src/server/dto/           Response projections — the boundary that keeps private fields private
src/lib/validation/       Zod schemas and every inferred request type
src/lib/                  errors, pagination, formatting, slug, filter URL state, storage drivers
src/theme/                Design tokens, Mantine theme, colour-scheme management
prisma/                   schema, migrations, idempotent seed and seed data
tests/                    unit/, integration/, api/, component/, e2e/, setup/
```

**Layering rule:** `Controllers → Services → Schemas → Models`. Controllers are HTTP-only; services
never see a `Request`; Server Components call services in-process rather than fetching our own API.
See [docs/system-design.md](docs/system-design.md).

---

## Documentation

| Document                                                                                                                                  | Contents                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [system-design.md](docs/system-design.md)                                                                                                 | Architecture, module boundaries, filtering, lead lifecycle, ADRs |
| [database-design.md](docs/database-design.md)                                                                                             | ERD, every model and constraint, index justification, migrations |
| [api-design.md](docs/api-design.md)                                                                                                       | Endpoints, parameters, error semantics, idempotency contract     |
| [security.md](docs/security.md)                                                                                                           | Threat model, authorization matrix, upload security, known gaps  |
| [testing-strategy.md](docs/testing-strategy.md)                                                                                           | Test layers, database isolation, what is and is not covered      |
| [implementation-plan.md](docs/implementation-plan.md)                                                                                     | Phases, gates, current state, next steps                         |
| [technology-decisions.md](docs/technology-decisions.md)                                                                                   | Every stack choice with its reasoning and rejections             |
| [design-system.md](docs/design-system.md)                                                                                                 | Tokens, typography, both themes, component conventions           |
| [ui-reference-research.md](docs/ui-reference-research.md)                                                                                 | Competitor research and the patterns adopted or rejected         |
| [nextjs-16-notes.md](docs/nextjs-16-notes.md), [prisma-7-notes.md](docs/prisma-7-notes.md), [mantine-9-notes.md](docs/mantine-9-notes.md) | Verified platform API notes used to build this codebase          |

---

## Environment variables

`getServerEnv()` validates configuration at the boundary, so a missing or malformed variable fails
loudly rather than surfacing as `undefined` deep inside a request. Nothing secret is exposed to the
browser: no secret is prefixed `NEXT_PUBLIC_`.

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET`. Recommended: `DIRECT_URL` (an unpooled connection for
migrations; without it `prisma migrate` falls back to the pooled `DATABASE_URL`) and
`NEXT_PUBLIC_APP_URL` (used for canonical URLs and auth callbacks; defaults to
`http://localhost:3000`).
Optional: `TEST_DATABASE_URL`, `BETTER_AUTH_URL`, `R2_*`, `ALLOW_LOCAL_MEDIA_STORAGE`,
`MEDIA_MAX_UPLOAD_BYTES`, `IP_HASH_SALT`, `RATE_LIMIT_*`. See [.env.example](.env.example) for
descriptions.

Under `NODE_ENV=production` the schema fails closed: `BETTER_AUTH_SECRET` must be at least 32
characters and not a placeholder, `IP_HASH_SALT` must not be the development default, and media
storage must be configured (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_PUBLIC_BASE_URL`) unless `ALLOW_LOCAL_MEDIA_STORAGE=true` is set for a host with a persistent
disk. Those checks run when the server first reads its configuration, not during `pnpm build`, so
building needs only the ordinary local `.env` and a misconfigured deployment fails at startup rather
than serving with a default salt. Outside production the `R2_*` variables stay optional: media
uploads then use the local filesystem driver (`.local-storage/`) served through a development-only
route, which is how the seeded SVG placeholders and upload tests run without cloud credentials.

---

## Known limitations

- **No reviews or ratings.** The brief permits ratings only where trustworthy data exists and forbids
  fabricated trust signals, so they are out of scope rather than seeded. Trust is represented by the
  administrator-set **verification** status, published pricing and media completeness.
- **No email or SMS delivery.** `NotificationPort` is the seam; the MVP ships a no-op implementation.
  Because there is no email verification, guest enquiries are **not** auto-claimed by a later
  sign-up (that would be an account-takeover vector). Guests track progress with their reference code
  plus contact email.
- **No dedicated search relevance ranking or per-facet counts** — see ADR-11. Text filters results
  correctly through a trigram-indexed column; it does not re-rank them.
- **Placeholder imagery.** No real photography was available, so seeded listings use abstract
  generated SVG covers rather than fabricated photographs. Their alt text says so explicitly.
- **No provider/vendor portal.** Administrators manage provider data, as the brief requires.
- Integration and end-to-end tests need a local PostgreSQL instance; they are not runnable in an
  environment without one.
