# Technology Decisions

Status: **Accepted** · Last updated: 2026-02-14 · Owner: Lead engineer

This document is the short technology-decision report required before implementation. It records
what was selected, why it fits _this_ product, and what was rejected. Decisions here are settled;
they are only reopened if a concrete constraint appears during implementation.

The repository was empty at the start of this build (no `package.json`, no git history). There was
therefore no existing stack to preserve, and the default stack from the brief applies.

---

## 0. Environment baseline (verified, not assumed)

| Fact                   | Value                                         | How verified                                  |
| ---------------------- | --------------------------------------------- | --------------------------------------------- |
| Node.js                | v24.16.0                                      | `node --version`                              |
| Package manager        | pnpm 9.0.0                                    | `pnpm --version` (scaffold pins `pnpm@9.0.0`) |
| PostgreSQL             | 16.14 (Homebrew), running on `localhost:5432` | `postgres --version`, `pg_isready`            |
| Dev/test databases     | `liveenvt_dev`, `liveenvt_test`               | `createdb` + `psql -l`                        |
| Writable scratch space | Workspace + `/tmp`                            | DSH sandbox probe                             |

Consequence: **integration tests run against a real PostgreSQL 16 instance** for the whole build,
so nothing is mocked. Production uses Neon PostgreSQL, which is the same engine and major version
family, so the Prisma provider, migration SQL and query behaviour are identical.

---

## 1. Next.js and React architecture

**Decision: Next.js 16.4.0 (App Router) + React 19.3.0, React Server Components by default, Route
Handlers for all HTTP endpoints.**

- Server Components render every discovery page, listing page, account page and admin page. They
  call **services directly on the server** — no self-`fetch` to our own API, which would add a
  network hop and break request-scoped caching.
- Client Components are used only where browser state is genuinely required: filter controls,
  enquiry form, theme toggle, media gallery, admin tables with client-side interaction.
- HTTP surface lives in `src/app/api/**/route.ts` (Route Handlers). This is a real, documented,
  independently testable REST API — needed because the brief requires API design, API tests,
  pagination contracts and future mobile/partner consumers.
- **Business logic is never duplicated between Route Handlers and Server Components.** Both call
  the same service layer. Route Handlers additionally own HTTP concerns: request parsing, Zod
  validation, status codes, error translation.
- Server Actions are **not** used as the primary mutation path. Rationale: the brief requires an
  explicit, testable API with documented error semantics, and route handlers give one canonical
  path for both browser and non-browser clients (plus easy Playwright/HTTP testing). Server Actions
  are used for nothing in the MVP, so there is exactly one mutation convention to learn.

Layering (identical for every domain):

```
src/app/api/**/route.ts     Controller  — HTTP only: parse, validate, call service, map errors
src/server/services/*.ts    Service     — business rules, transactions, authorization decisions
src/lib/validation/*.ts     Schemas     — Zod schemas + inferred types (single source of truth)
src/server/repositories/*   Data access — only where a query is genuinely complex
prisma/schema.prisma        Models      — relational integrity, indexes, constraints
```

**Rejected:** Pages Router (legacy); tRPC (adds a layer without solving anything the brief asks
for, and makes the "document the REST API" deliverable harder); separate Express/Nest service
(the brief forbids a second framework unless the design proves a need — it does not).

---

## 2. UI component library

**Decision: Mantine 9.7** — `@mantine/core`, `@mantine/hooks`, `@mantine/form`, `@mantine/dates`,
`@mantine/notifications`, `@mantine/modals`. Exactly one component system.

Why it fits:

- **One system covers both surfaces.** The public site needs discovery primitives (Combobox,
  MultiSelect, RangeSlider, SegmentedControl, Drawer, Tabs, AspectRatio, Skeleton, Carousel); the
  admin panel needs data-management primitives (Table, Pagination, Modal, Menu, Badge, Timeline,
  Tooltip, Popover, notifications). Mantine ships all of them accessibly, so no second library is
  needed — which is exactly the "one primary component system" constraint in the brief.
- **Real theming, not a coat of paint.** Mantine's theme is a typed token object compiled to CSS
  variables (`--mantine-*`), so light/dark switching is a single attribute flip with no per-component
  branching. That is what makes a genuinely designed dark theme achievable instead of an inversion.
- **Accessibility is built in**: focus management in overlays, `aria-*` on comboboxes/selects,
  keyboard support in menus and drawers, and reduced-motion support.
- **Customisation depth**: component `defaultProps`, `classNames`, `styles` and variants let us
  restyle every primitive to a single visual identity without forking it.
- Native React 19 and Next.js App Router support (including the server-side `ColorSchemeScript`
  that prevents a wrong-theme flash on first paint).

**Rejected:**

- _shadcn/ui_ — explicitly excluded by the brief.
- _Tailwind + Radix_ — maximum control, but it makes us hand-build ~25 primitives (date picker,
  combobox, multi-select, data table, notifications), which the brief explicitly warns against
  ("do not recreate a new button, input, modal, dropdown... every time"). Higher risk of an
  inconsistent, half-finished component layer within one build.
- _Ant Design_ — excellent admin tables, but a heavy, opinionated, enterprise visual language that
  fights a premium consumer wedding aesthetic, and mixing it with a consumer library would mean two
  systems.
- _HeroUI_ — good consumer polish, thinner data-management surface for the admin panel.
- _Combining two libraries_ — rejected for the theming/bundle/consistency reasons the brief lists.

---

## 3. Styling approach

**Decision: Mantine's CSS-variable theme system + CSS Modules for bespoke composition. No Tailwind.**

- All cross-cutting design decisions live in `src/theme/` as tokens: colour scales, semantic colour
  mappings, spacing, radius, shadow, font sizes/weights/line-heights, breakpoints.
- `postcss-preset-mantine` (+ `postcss-simple-vars`) lets CSS Modules use those tokens directly, so
  component-specific layout CSS stays colocated with the component and free of magic values.
- Global layers (`src/app/globals.css`) define only what Mantine does not: font-face wiring, base
  element resets, focus-visible ring, reduced-motion rules, and the semantic light/dark token map.

**Why not Tailwind:** the brief forbids combining styling frameworks indiscriminately. Mantine
already ships a token system, so adding Tailwind would create two competing sources of truth for
spacing/colour/breakpoints. One token system, one source of truth.

**Enforcement:** arbitrary hex colours and ad-hoc pixel spacing are disallowed in components. ESLint
plus review keeps colour/spacing usage routed through tokens and CSS variables.

---

## 4. Single font family

**Decision: Manrope** (variable, weights 200–800), loaded once with `next/font/google`, exposed as
`--font-manrope`, and applied to `html` so it is inherited by _everything_ — public site, auth
pages, enquiry forms and admin tables.

Why one family satisfies the whole brief:

- Manrope is a geometric-humanist sans with a large x-height and open apertures, so it stays legible
  at 12–13px in dense admin tables while looking composed and premium at 56px in a hero. It has
  enough personality (distinctive `g`, `y`, `R`) to feel chosen rather than defaulted to.
- A true variable font with real weight range (200–800) means hierarchy comes from weight + size +
  colour within one family, which is exactly the brief's requirement.
- Self-hosted through `next/font` at build time: no third-party request, no layout shift, no
  runtime font fetching, and no privacy/GDPR surface.

`next/font` self-hosts; there is no CSS `@import` from a CDN and no second **UI** family. One second
family is deliberate: `--mantine-font-family-monospace` (a system monospace stack defined in
`src/theme/theme.ts`) is used for code-like text — the enquiry reference, `pre`/`code`/`kbd`/`samp` and
admin identifier cells — because tabular identifiers must not be set in a proportional face.

---

## 5. Theme architecture

**Decision: light and dark themes from one semantic token layer, driven by Mantine's
`data-mantine-color-scheme` attribute, with no flash of incorrect theme.**

- `ColorSchemeScript` renders a blocking inline script in `<head>` that resolves the stored preference
  (and, for `auto`, the OS preference) and sets the attribute before first paint. The user therefore
  never sees the wrong theme.
- Preference is `auto | light | dark`, persisted in **both** `localStorage` and a `SameSite=Lax`
  cookie, because Mantine 9 ships no cookie-backed manager. The cookie is what a future
  server-rendered scheme would read.
- Semantic tokens (`--app-surface`, `--app-surface-raised`, `--app-text`, `--app-text-muted`,
  `--app-border`, `--app-brand`, `--app-*-soft`, `--app-success/-warning/-danger`, ...) map onto
  Mantine's variables per scheme through `cssVariablesResolver`. Components reference semantic names,
  never raw palette indexes, so both themes stay intentional.
- Dark is designed, not inverted: separate surface elevation steps, desaturated brand tints for large
  fills, **raised** border contrast, and re-tuned muted text. Measured contrast ratios for both
  schemes are recorded in [design-system.md](./design-system.md#35-measured-contrast-wcag-21-relative-luminance).
- The provider chain lives in `src/theme/app-providers.tsx` (`'use client'`), not in the root layout:
  a theme carrying functions cannot be passed across the server/client boundary, and
  `cssVariablesResolver` is a `MantineProvider` **prop** rather than a `createTheme` option.

**Verified constraint that changed this decision.** The original intent was to read the scheme cookie
in the root layout so the server-rendered `<html>` already carried the resolved value. `next build`
rejects that: `next.config.ts` sets `cacheComponents: true`, and a `cookies()` read in the root layout
cannot be placed inside a `<Suspense>` boundary because an `<html>` attribute sits above every
boundary React can create. The only options were `export const instant = false` (opting the whole app
out of the static shell) or dropping `cacheComponents` — both app-wide changes not justified by a
`View Source` fidelity issue. **What is lost:** a first-time dark-preferring visitor's HTML source
says `light`. **What is not lost:** the rendered pixels, which are correct before first paint. The
cookie is still written and a `resolveColorScheme` helper exists, so restoring the server read is a
small, isolated change if the rendering model is ever revisited.

---

## 6. Authentication

**Decision: Better Auth 1.7 with the Prisma adapter, database-backed cookie sessions,
email + password, and a `role` field (`CUSTOMER | ADMIN`) enforced server-side.**

Why:

- Maintained, TypeScript-first, designed for Next.js App Router (single catch-all route handler),
  and it owns the security-sensitive parts we must not hand-roll: password hashing, session token
  generation/rotation, CSRF, cookie flags, and timing-safe comparison.
- **Database sessions** (not JWTs) because the brief requires revisable authorization: banning a
  customer, demoting an administrator, or revoking a session must take effect immediately without
  waiting for a token to expire.
- Its schema maps cleanly onto entities the brief already asks for (`User`, `Session`, `Account`,
  `Verification`), and the Prisma adapter lets us keep our own `User.role`, `User.status` and
  `CustomerProfile` alongside it.
- Built-in rate limiting on auth endpoints.

**Authorization is never read from the request.** Every protected service call resolves the session
server-side and checks role/ownership inside the service. Hiding a button is not authorization.

**No provider/vendor accounts and no vendor dashboard in the MVP**, per the brief.

**Rejected:** Auth.js v5 (`next-auth@beta` only — a beta auth dependency is not worth it when a
stable alternative exists); Clerk/Auth0 (external SaaS holding customer PII, plus cost, for a
requirement that is only email+password); hand-rolled sessions (forbidden by the brief's
"prefer established libraries over custom implementations of security-sensitive functionality").

---

## 7. Database and Prisma setup

**Decision: PostgreSQL + Prisma ORM 7.10, single provider `postgresql`.**

- Runtime connection: `DATABASE_URL` (Neon pooled via PgBouncer in production; local TCP in dev).
- Migrations: `DIRECT_URL` (unpooled) so `prisma migrate` never runs through a transaction pooler.
- Schema managed exclusively through `prisma migrate` — never by editing a live database by hand.
- Integrity enforced in the database: unique indexes (slugs, `(listingId, attributeId)`,
  `(enquiryId, listingId)`), foreign keys with explicit `onDelete` behaviour, and transactions
  (`prisma.$transaction`) for multi-step writes such as enquiry creation and status transitions.
- **Category-specific filtering** uses normalised relational tables plus typed attribute value
  columns, with JSONB reserved for non-queried option blobs and audit/activity payloads. This is
  expanded with reasoning in `docs/database-design.md`; "store everything in JSONB" is explicitly
  rejected because numeric ranges (capacity, budget) need real B-tree indexes.
- Full-text-ish search uses a service-maintained `searchText` column with a `pg_trgm` GIN index so
  substring/relevance queries are index-accelerated. No dedicated search engine — PostgreSQL is
  sufficient at this scale and the service boundary allows a later swap.

---

## 8. Media upload and delivery

**Decision: Cloudflare R2 through a `StorageDriver` interface, with time-limited presigned `PUT`
uploads issued only after server-side validation, plus a local filesystem driver for dev/test.**

- Interfaces: `StorageDriver` (`createPresignedUpload`, `head`, `delete`, `publicUrl`) with
  `R2StorageDriver` (S3 API via `@aws-sdk/client-s3` + `s3-request-presigner`) and
  `LocalStorageDriver` (writes under `.local-storage/`, served by a route handler in dev).
  This keeps storage SDK calls out of controllers and makes media testable without network access.
- Credentials are server-only. No R2 secret, bucket credential or privileged operation ever reaches
  the browser — the client only ever receives a short-lived, single-object presigned URL.
- Uploads are validated on both sides: the server issues the presigned URL with a fixed
  `Content-Type` and `Content-Length` constraint for an allow-listed image type and a hard size cap;
  the completion step re-`HEAD`s the object to verify the real `Content-Type` and byte size before
  the row is marked `READY`. **File extensions are never trusted.**
- Object key convention: `listings/{listingId}/{mediaId}/{slug}-{sha8}.{ext}`, so keys are
  deterministic, collision-resistant and cheap to clean up.
- Deletion: replacing or deleting a media row soft-deletes and enqueues the object key for removal;
  a cleanup task deletes orphaned objects. Documented in `docs/security.md`.
- Delivery: public objects are served from the R2 public bucket/CDN domain, referenced through
  `next/image` with the host allow-listed in `next.config.ts`. Because image variants are transformed
  downstream, `unoptimized` is used for R2 URLs to avoid double-billing transformation.
- PostgreSQL stores object keys and metadata, never file bytes.

---

## 9. Testing tools

**Decision: Vitest 5 for unit + integration tests; Playwright 1.64 for browser journeys; Testing
Library for component behaviour. No Jest, no Cypress.**

- Unit and integration share one runner but are separate Vitest **projects**, so `pnpm test:unit`
  never touches the database and `pnpm test:integration` always does. Integration tests run against
  the real `liveenvt_test` PostgreSQL database with migrations applied, and truncate between tests.
- Playwright drives the real Next.js production server against a seeded database, covering the
  journeys the brief enumerates (browse → filter → listing → enquiry → sign in → own enquiry;
  admin create/publish/assign/note), two-customer isolation, both colour schemes, and mobile.
- Chosen over Jest because Vitest is ESM/TS-native, needs no transform config for this stack, and
  its `projects` feature gives the unit/integration split cleanly.

---

## 10. Deployment target and compatibility

**Decision: Vercel (Next.js runtime) + Neon (PostgreSQL) + Cloudflare R2 (media).**

Compatibility notes that were checked and are respected by the design:

- Route Handlers and Server Components run on the Node.js runtime for anything touching Prisma;
  the Edge runtime is not used for database access.
- Neon's pooled endpoint requires PgBouncer-compatible settings, so Prisma uses `DATABASE_URL` for
  queries and `DIRECT_URL` for migrations.
- File uploads never pass through the function body (Vercel request-body limits); the browser
  uploads directly to R2 with a presigned URL, and the server only records verified metadata.
- Anything stateful that would break on serverless scaling (rate limiting, idempotency) is stored in
  PostgreSQL rather than process memory.

---

## 11. Deviations from the stack in the brief

| Brief item                    | Action                          | Reason                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tailwind CSS                  | **Not used**                    | Mantine already provides one token/theme system; adding Tailwind creates two competing sources of truth and the brief forbids indiscriminate mixing.                                                                                                                                                               |
| Reviews / rating sort         | **Out of MVP scope**            | The brief permits ratings "only if trustworthy rating data exists" and explicitly forbids fake ratings/metrics. Without real captured reviews, a seeded star rating would be fabricated trust. Trust signals used instead: admin **verification** status, published pricing, media completeness, service coverage. |
| Vendor/provider dashboard     | **Not built**                   | Explicitly excluded by the brief; administrators manage provider data on their behalf.                                                                                                                                                                                                                             |
| Payment/booking/subscriptions | **Not built**                   | The product is discovery + lead generation, per the brief.                                                                                                                                                                                                                                                         |
| Email delivery                | **Not built in MVP**            | Would require a provider and domain; notification delivery is instead isolated behind a single `NotificationPort` seam so it can be added without touching enquiry creation.                                                                                                                                       |
| Dedicated search engine       | **Not built**                   | PostgreSQL with trigram GIN indexes meets the requirement; the search service boundary allows a later swap.                                                                                                                                                                                                        |
| Server Actions                | **Not used as a mutation path** | One canonical mutation convention (Route Handlers) keeps error semantics, validation and testing uniform.                                                                                                                                                                                                          |

---

## 12. Settled-choices summary

| #   | Decision                   | Choice                                                                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Next.js/React architecture | Next.js 16 App Router, RSC-first, Route Handlers, service layer shared by both                   |
| 2   | UI component library       | Mantine 9 (single system, no shadcn)                                                             |
| 3   | Styling                    | Mantine CSS-variable tokens + CSS Modules, no Tailwind                                           |
| 4   | Font                       | **Manrope** — the UI family, weights 200–800, `next/font`; system monospace for code/identifiers |
| 5   | Theme                      | Cookie-backed `auto/light/dark`, `ColorSchemeScript`, semantic token layer                       |
| 6   | Authentication             | Better Auth 1.7, Prisma adapter, DB sessions, `CUSTOMER`/`ADMIN` roles                           |
| 7   | Database/ORM               | PostgreSQL 16 (Neon in prod) + Prisma 7, `DATABASE_URL` + `DIRECT_URL`                           |
| 8   | Media                      | Cloudflare R2, presigned PUT, `StorageDriver` seam, server-verified metadata                     |
| 9   | Testing                    | Vitest (unit/integration projects) + Playwright + Testing Library                                |
| 10  | Deployment                 | Vercel + Neon + Cloudflare R2                                                                    |
| 11  | Validation                 | Zod 4 with inferred types (single source of truth)                                               |
| 12  | Quality                    | ESLint 9 (`eslint-config-next`) + Prettier + `tsc --noEmit` strict                               |
