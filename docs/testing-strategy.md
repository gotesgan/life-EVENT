# Testing Strategy — Live Envt

Status: **Accepted** · Last updated: 2026-10-14 · Owner: Backend lead
Companion documents: [system-design](./system-design.md) §11, [security](./security.md),
[implementation-plan](./implementation-plan.md).

## Final verified state

| Layer                       | Files  | Tests                                                                            | Command                 |
| --------------------------- | ------ | -------------------------------------------------------------------------------- | ----------------------- |
| Unit                        | 11     | 397                                                                              | `pnpm test:unit`        |
| Component                   | 5      | 29                                                                               | `pnpm test`             |
| Integration + API           | 20     | 186 (integration 86, API 100)                                                    | `pnpm test:integration` |
| **Total (Vitest)**          | **36** | **612 passed, 0 failed, 0 skipped**                                              | `pnpm test`             |
| **End-to-end (Playwright)** | **7**  | **222 passed** (74 per project) across `desktop-light`, `desktop-dark`, `mobile` | `pnpm e2e`              |

Numbers above are the output of `npx vitest run` (`Test Files 36 passed (36)`,
`Tests 612 passed (612)`) and `npx playwright test` (`222 passed`) in this repository at this
revision; `npx playwright test --list` reports `Total: 222 tests in 7 files`. `pnpm format:check`,
`pnpm lint` (`npx eslint .`), `pnpm typecheck` (`npx tsc --noEmit`) and `pnpm build` were all re-run
and are green. Where a rule is _not_ covered, this document says so rather than implying otherwise.

---

## 1. Layered strategy

| Layer       | Runner / project                             | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                    | Deliberately does **not** cover                                                     |
| ----------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Unit        | Vitest `unit` (Node, no DB)                  | Pure functions: Zod schemas and normalisation, `buildListingWhere`/`buildListingOrderBy`, the `EnquiryStatus` state machine and `deriveEnquiryStatus`, duplicate heuristics, `deriveContactDisclosure`, slug generation, pagination maths, attribute display formatting, storage validation and key building.                                                                                                                           | Anything that touches PostgreSQL, the filesystem or the network. No HTTP, no React. |
| Integration | Vitest `integration` (Node, real PostgreSQL) | Constraints, cascades and `onDelete` behaviour; transaction rollback; listing publication/verification; category + attribute configuration and inheritance; combined multi-filter search correctness; pagination/sort/result-count agreement; enquiry creation with multiple leads; activity history; **customer data isolation**; admin authorization; rate limiting; idempotency replay; media verification against the local driver. | HTTP status codes and headers (that is the API layer); presentation.                |
| API         | Vitest `integration` project, `tests/api/**` | Route-handler behaviour with a real session and real DB: 200/201/400/401/403/404/409/429 shapes, malformed JSON, unknown/ill-typed filters, cross-customer access, invalid status transitions, `Retry-After`.                                                                                                                                                                                                                           | Business rules already covered by integration tests; UI.                            |
| Component   | Vitest `component` (jsdom + Testing Library) | Filter chips, form validation messages, empty/error states, disabled/loading states.                                                                                                                                                                                                                                                                                                                                                    | Data-layer correctness; anything requiring a live server.                           |
| End-to-end  | Playwright (real server, seeded DB)          | The user journeys in §10.                                                                                                                                                                                                                                                                                                                                                                                                               | Exhaustive rule coverage — E2E proves the wiring, not every branch.                 |

The split is **by responsibility, not by tool convenience**. A rule proven at the unit level is not
re-proven in E2E; E2E exists to prove that the pieces are actually connected.

---

## 2. Why the Vitest projects are split this way

`vitest.config.ts` defines three projects, because the three layers have genuinely different
runtimes:

1. **`unit`** runs in `environment: 'node'` with no setup files. It must never touch a database, so
   `pnpm test:unit` is safe in CI without PostgreSQL.
2. **`component`** runs in `environment: 'jsdom'`, adds the React plugin and loads
   `tests/setup/component.ts` for Testing Library matchers. It is separate so the React plugin and
   DOM globals never leak into server-side suites.
3. **`integration`** covers both `tests/integration/**` and `tests/api/**` — deliberately **one
   project**. API tests are integration tests with an HTTP entry point; they need the same global
   setup, the same seed and the same truncation, and splitting them would duplicate the harness.
   `fileParallelism: false` serialises the files because they share one database.

The alias map is shared by all three projects so `@/…` resolves identically to the application.

```ts
// vitest.config.ts (shape, verbatim)
const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  'server-only': fileURLToPath(new URL('./tests/setup/empty-module.ts', import.meta.url)),
};
```

Project summary:

| Project       | environment | include                                                    | setupFiles                   | globalSetup                   | parallelism                                                                 |
| ------------- | ----------- | ---------------------------------------------------------- | ---------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `unit`        | `node`      | `tests/unit/**/*.test.ts`                                  | —                            | —                             | default                                                                     |
| `component`   | `jsdom`     | `tests/component/**/*.test.tsx`                            | `tests/setup/component.ts`   | —                             | default                                                                     |
| `integration` | `node`      | `tests/integration/**/*.test.ts`, `tests/api/**/*.test.ts` | `tests/setup/integration.ts` | `tests/setup/global-setup.ts` | **`fileParallelism: false`**, `hookTimeout: 120_000`, `testTimeout: 60_000` |

> **Resolved:** `tests/setup/component.ts` exists and loads `@testing-library/jest-dom`.
> `tests/component/` holds five spec files (`ui-primitives`, `enquiry-form`, `admin-enquiry-inbox`,
> `admin-enquiry-status-control`, `admin-customer-moderation`) and the `component` project runs clean
> in `pnpm test`.

---

## 3. Test database isolation

### 3.1 The guard

Both `tests/setup/global-setup.ts` and `tests/setup/integration.ts` refuse to run unless:

1. `TEST_DATABASE_URL` is set, **and**
2. `TEST_DATABASE_URL !== DATABASE_URL`.

```ts
if (!testUrl) throw new Error('TEST_DATABASE_URL must be set…');
if (devUrl && testUrl === devUrl) {
  throw new Error(
    'Refusing to run: TEST_DATABASE_URL and DATABASE_URL point at the same database.',
  );
}
```

This is the single most important safety property of the suite: a misconfigured environment can never
truncate development or production data, because the run aborts before any client is constructed.
The same check is duplicated in the per-file setup on purpose — `globalSetup` runs in the Vitest
parent process, while `integration.ts` runs inside each worker before application modules are
imported, and a future refactor of one must not silently drop the guard.

### 3.2 Global setup (`tests/setup/global-setup.ts`)

Runs **once** for the whole integration/API run:

1. loads `.env` with `dotenv/config`;
2. applies the guard;
3. builds an env with `DATABASE_URL` and `DIRECT_URL` both pointed at the test database — both,
   because `prisma.config.ts` reads `DIRECT_URL || DATABASE_URL` and Prisma's CLI uses that value;
4. runs `npx prisma migrate deploy` (so the test schema is the migrated schema, not a `db push`
   approximation);
5. runs `npx tsx prisma/seed.ts` (so catalogue/reference fixtures exist for every file);
6. writes `DATABASE_URL`/`DIRECT_URL` back into `process.env` so worker processes inherit them.

### 3.3 Per-file harness (`tests/setup/integration.ts`)

Imported as a `setupFiles` entry, so it executes **before any application module** is imported:

- calls `config()` and repeats the guard;
- assigns `process.env.DATABASE_URL = TEST_DATABASE_URL` and `DIRECT_URL` likewise, so the shared
  Prisma singleton in `src/lib/db.ts` (which reads `getServerEnv().DATABASE_URL` lazily) points at the
  test database;
- exports `truncateAllTables()`, `seedTestDatabase()` and `clearRuntimeState()`;
- registers `beforeAll` that re-runs the seed (cheap, because the seed is idempotent) with a 120 s
  timeout, and `afterAll` that calls `prisma.$disconnect()`.

### 3.4 Truncation strategy and its trade-offs

```ts
export async function truncateAllTables(): Promise<void> {
  const { prisma } = await import('@/lib/db');
  const list = TABLES_IN_DELETE_ORDER.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
```

- **`TRUNCATE … CASCADE` rather than ordered `DELETE`s.** A forgotten table cannot leave rows behind
  and leak state between files; `TABLES_IN_DELETE_ORDER` documents the intended dependency order but
  the `CASCADE` is what actually guarantees completeness. `RESTART IDENTITY` is moot for cuid keys
  but harmless.
- **`clearRuntimeState()`** truncates only the accumulating tables (`enquiry_notes`,
  `enquiry_activities`, `enquiry_listings`, `enquiries`, `idempotency_keys`, `rate_limit_buckets`,
  `audit_logs`), which is what a test that wants to keep catalogue fixtures will use.
- **Trade-offs, stated plainly:** truncation is fast and total, but it destroys fixtures, so a suite
  that needs seed data must call `seedTestDatabase()` (or rely on the per-file `beforeAll`). Because
  files share one database and run serially, a suite that truncates must not assume another file's
  work survives. Seeds are cheap but not free — hence the 120 s `hookTimeout`.
- **Raw SQL is used deliberately** (`$executeRawUnsafe`). The table names are hard-coded in the
  module, never taken from input, so there is no injection surface; this is the documented pattern in
  `docs/prisma-7-notes.md` §6.
- **Previously a known failure, now fixed.** An earlier revision of this document recorded that
  `pnpm test:integration` failed because `tests/integration/database-constraints.test.ts` left
  `constraints-*` listings behind and the next file's `seedTestDatabase()` then failed
  `verifySeededData()`. The harness now truncates and re-seeds per file under a PostgreSQL advisory
  lock, and `pnpm test:integration` (and `pnpm test`) pass in full — 612 tests, 0 failed — as measured
  in this snapshot. The §8 warning about shared mutable state remains the reason the per-file reset
  exists.

### 3.5 Why `fileParallelism` is disabled

All integration/API files point at the same PostgreSQL database and several truncate it. Running them
concurrently would make one file delete another's rows mid-test — the classic source of
"passes locally, fails in CI" flakiness. Serial execution is slower but deterministic. If the suite
ever needs to scale, the correct fix is one database (or one schema) per worker, not re-enabling
parallelism against a shared instance.

---

## 4. The `server-only` alias trick

`server-only` is a package that throws when imported outside a React Server Component environment.
Vitest runs in plain Node, so every server module that begins `import 'server-only'` — `src/lib/db.ts`,
`src/lib/env.ts`, `src/lib/auth/*`, all of `src/server/**`, the storage drivers — would throw before a
single assertion ran.

`vitest.config.ts` therefore aliases the bare specifier to `tests/setup/empty-module.ts`, which
exports nothing. Consequences worth understanding:

- The guard is **disabled under test**, so unit/integration tests can import server code freely; this
  is exactly the point.
- The alias does **not** weaken the production guarantee: Next.js still resolves the real package, so
  importing a service from a Client Component still fails the build. The alias lives only in the test
  config.
- The alias is applied to all three projects, including `component`, so a component test that
  accidentally imports a server module will run in jsdom instead of failing. That is a deliberate
  trade (testability over a jsdom-specific error) but it means "it imported fine" is not evidence
  that a module is client-safe.

---

## 5. What is tested, and why it matters

| Business-critical rule                                                                                                                                                                                                     | Test that covers it                                                                                     | Status                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload allow-list, size cap, MIME-derived extension, deterministic keys, alt-text sanitisation, stored-type/size verification, local-driver round trip and path-traversal rejection                                        | `tests/unit/storage.test.ts` (33 tests)                                                                 | **Covered.**                                                                                                                                          |
| `buildListingWhere` publication guarantee, core facets, text search, price/capacity overlap, typed attribute clauses, purity                                                                                               | `tests/unit/search-filters.test.ts` (79 tests)                                                          | **Covered.**                                                                                                                                          |
| `EnquiryStatus` full from→to matrix, terminal states, `CONVERTED` reachability, `deriveEnquiryStatus`, customer copy                                                                                                       | `tests/unit/enquiry-status.test.ts` (110 tests)                                                         | **Covered.**                                                                                                                                          |
| Provider contact disclosure: published channels, private channels with and without a shared lead, `hasWithheldChannels`                                                                                                    | `tests/unit/contact-disclosure.test.ts` (19 tests)                                                      | **Covered.**                                                                                                                                          |
| Contact normalisation (`normaliseEmail`, `normalisePhone`, `areSameContact`), hashing, reference codes                                                                                                                     | `tests/unit/contact.test.ts` (25 tests)                                                                 | **Covered.**                                                                                                                                          |
| Error hierarchy, `AppError` status mapping, `toError`/`isAppError`                                                                                                                                                         | `tests/unit/errors.test.ts` (37 tests)                                                                  | **Covered.**                                                                                                                                          |
| Slugify/disambiguation, price/date/capacity formatting, pagination maths, env schema                                                                                                                                       | `tests/unit/{slug,format,pagination,client-env}.test.ts`                                                | **Covered.**                                                                                                                                          |
| Fail-closed production environment: placeholder/too-short `BETTER_AUTH_SECRET`, default/too-short `IP_HASH_SALT`, unconfigured media storage, `ALLOW_LOCAL_MEDIA_STORAGE` opt-in parsing, and permissive dev/test defaults | `tests/unit/env-hardening.test.ts` (13 tests)                                                           | **Covered.**                                                                                                                                          |
| Unique constraints (slug, `(listingId, attributeId)`, `(enquiryId, listingId)`, `(scope, key)`) and `onDelete` cascade vs restrict                                                                                         | `tests/integration/database-constraints.test.ts` (9 tests)                                              | **Covered.**                                                                                                                                          |
| Idempotency: fresh claim, replay, mismatch, scope isolation, concurrent double-claim and claim storm, `ATTACH` result, `createEnquiry` replay/conflict                                                                     | `tests/integration/idempotency.test.ts` (9 tests)                                                       | **Covered.**                                                                                                                                          |
| Rate limiting: budget, exhaustion, `Retry-After`, key isolation, fixed-window reset, one bucket per window, `enforceRateLimit`                                                                                             | `tests/integration/rate-limit.test.ts` (8 tests)                                                        | **Covered.**                                                                                                                                          |
| Admin metrics agree with direct `prisma.count`, conversion-rate shape, empty-database behaviour                                                                                                                            | `tests/integration/admin-metrics.test.ts` (5 tests)                                                     | **Covered.**                                                                                                                                          |
| Better Auth sign-in for seeded customer/admin, wrong password, client-supplied `role` ignored                                                                                                                              | `tests/integration/better-auth.test.ts` (3 tests)                                                       | **Covered.**                                                                                                                                          |
| Public search: published-only, combined filters, unknown/invalid filters rejected, no row repetition across pages, page-size cap                                                                                           | `tests/api/listings.test.ts` (9 tests)                                                                  | **Covered.**                                                                                                                                          |
| Draft listing 404 by guessed slug; published listing returned                                                                                                                                                              | `tests/api/listings.test.ts`                                                                            | **Covered.**                                                                                                                                          |
| Guest enquiry accepted; missing consent rejected; unpublished slug rejected; idempotent replay; customer attached                                                                                                          | `tests/api/enquiries.test.ts` (11 tests)                                                                | **Covered.**                                                                                                                                          |
| Customer isolation: list returns only own enquiries; another customer's reference → 404                                                                                                                                    | `tests/api/enquiries.test.ts`                                                                           | **Covered.**                                                                                                                                          |
| Guest tracking with reference + email; wrong email → 404                                                                                                                                                                   | `tests/api/enquiries.test.ts`                                                                           | **Covered.**                                                                                                                                          |
| Admin authorization: 401 anonymous, 403 customer, 200 admin; catalogue mutation denied to customer                                                                                                                         | `tests/api/admin.test.ts` (8 tests)                                                                     | **Covered.**                                                                                                                                          |
| Invalid status transition → 409; allowed transition applied; self-suspension refused; catalogue create writes an audit entry                                                                                               | `tests/api/admin.test.ts`                                                                               | **Covered.**                                                                                                                                          |
| Duplicate detection: 15-minute window on the same contact identity, phone matching with/without country code, window expiry, and flagging when only the listing set differs                                                | `tests/api/enquiry-duplicates.test.ts` (5 tests)                                                        | **Covered.**                                                                                                                                          |
| Enquiry cancellation: own-lead ownership, 401/404, cancellable and terminal stages, recomputing the parent status, and the guarded write under a concurrent status change                                                  | `tests/api/enquiry-cancel.test.ts` (8 tests)                                                            | **Covered.**                                                                                                                                          |
| Account profile: update name/phone/preferences, email and role read-only, hostile role/status escalation rejected, invalid city and short name → 400                                                                       | `tests/api/account.test.ts` (9 tests)                                                                   | **Covered.**                                                                                                                                          |
| Lead assignment target must be an existing, active `ADMIN`; whole-enquiry scope; unassign clears `assignedAt`                                                                                                              | `tests/api/admin-enquiries-assign.test.ts` (10 tests)                                                   | **Covered.**                                                                                                                                          |
| Customer moderation: suspend sets the ban flag and writes an audit row, reactivate clears it, deactivate records a distinct action, other admins are protected, unknown status → 400                                       | `tests/api/admin-customers-moderation.test.ts` (8 tests)                                                | **Covered.**                                                                                                                                          |
| Audit-log listing: authorization, action + entityType filters, entityId filter, empty page, newest-first ordering with a total tie-break, and pagination without repeats/skips                                             | `tests/api/admin-audit-logs.test.ts` (8 tests)                                                          | **Covered.**                                                                                                                                          |
| Media completion re-verification end-to-end through the local driver (missing object, wrong stored type, disallowed stored type, size mismatch, over-cap size, wrong listing, already READY, blank alt text)               | `tests/api/media-complete.test.ts` (11 tests)                                                           | **Covered.**                                                                                                                                          |
| Attribute validation against category bindings (unknown attribute, option validity, required fields, numeric bounds, mismatched typed column, replacement semantics)                                                       | `tests/integration/listing-lifecycle.test.ts` (17 tests)                                                | **Covered.**                                                                                                                                          |
| Publication requires ≥1 `READY` image and a description; published→unpublished→archived→restored; audit row per transition                                                                                                 | `tests/api/admin-listings-publication.test.ts` (9 tests)                                                | **Covered.**                                                                                                                                          |
| Listing create/update replaces relations atomically and refreshes `searchText`; catalogue renames (category, location, event type, amenity) refresh it too                                                                 | `tests/integration/listing-lifecycle.test.ts`, `tests/api/catalog-rename-search-text.test.ts` (4 tests) | **Covered.**                                                                                                                                          |
| Lead status change writes lead + activity + derived overall status + audit in one transaction                                                                                                                              | `tests/api/admin.test.ts`, `tests/api/enquiry-cancel.test.ts`                                           | **Partially covered** — cancellation recomputation and the transition/409 are asserted; the audit-row coupling of a normal lead status change is not. |
| API error envelope shape: `Retry-After`, no stack trace in a 500                                                                                                                                                           | _no dedicated suite_                                                                                    | **Not covered.** Error mapping is partly exercised via 400/401/403/404/409 responses.                                                                 |
| Filter chips and form validation messages                                                                                                                                                                                  | `tests/component/**` (5 files, 29 tests)                                                                | **Covered.**                                                                                                                                          |
| Full journeys, two-customer isolation in the browser, admin panel, mobile, colour schemes                                                                                                                                  | Playwright specs (7 files, 222 tests)                                                                   | **Covered** — see §10 for what each spec actually asserts.                                                                                            |

**Honest summary:** the pure domain layer, the constraint/cascade layer, idempotency, rate limiting,
the listing lifecycle (attribute write-validation, publication guards, relation replacement and
`searchText` refresh, including catalogue renames), media completion re-verification, the
duplicate-detection and cancellation windows, audit-log querying, lead assignment, customer moderation,
account profile updates and the main public/admin API surfaces are covered. The remaining gaps are the
audit-row coupling on a normal lead status change and the structured 500 envelope. Twenty of the 50
route files under `src/app/api` are imported by a Vitest suite: `account`, `admin/audit-logs`,
`admin/catalog/amenities/[id]`, `admin/catalog/categories/[id]`, `admin/catalog/event-types` (+
`[id]`), `admin/catalog/locations/[id]`, `admin/customers/[id]`, `admin/enquiries/[id]/assign`,
`admin/enquiries/[id]/status`, `admin/listings/[id]/media/[mediaId]/complete`,
`admin/listings/[id]/media/presign`, `admin/listings/[id]/publication`, `admin/overview`, `enquiries`,
`enquiries/[referenceCode]` (+ `/cancel`), `enquiries/track`, `listings` and `listings/[slug]`. The
other 30 are exercised only through Playwright or not at all, so "the API surfaces are covered" applies
to that list, not to the whole route tree.

---

## 6. How to run everything

Scripts from `package.json`:

| Command                           | What it does                                                                                                                                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                       | `vitest run` — all three projects. **Passes: 36 files, 612 tests, 0 failed, 0 skipped** (`npx vitest run`).                                                                                   |
| `pnpm test:unit`                  | `vitest run --project unit` — safe without PostgreSQL. **Verified: 11 files, 397 passing.**                                                                                                   |
| `pnpm test:integration`           | `vitest run --project integration` — runs `tests/integration/**` **and** `tests/api/**` (20 files, 186 tests); requires `TEST_DATABASE_URL`, migrations and seed.                             |
| `pnpm test:watch`                 | `vitest` in watch mode.                                                                                                                                                                       |
| `pnpm test:coverage`              | `vitest run --coverage`. `@vitest/coverage-v8` is installed (`package.json`), so the provider resolves; no threshold is enforced (see §9).                                                    |
| `pnpm e2e`                        | `playwright test` — 222 tests (74 per project) across three projects. Needs `pnpm build` first (the web server runs the production build) and `pnpm e2e:install` once for the browser binary. |
| `pnpm e2e:install`                | `playwright install chromium`.                                                                                                                                                                |
| `pnpm e2e:report`                 | `playwright show-report`.                                                                                                                                                                     |
| `pnpm typecheck`                  | `tsc --noEmit`.                                                                                                                                                                               |
| `pnpm lint` / `pnpm format:check` | ESLint / Prettier checks.                                                                                                                                                                     |
| `pnpm check`                      | `format:check && lint && typecheck && test` — the intended pre-commit gate.                                                                                                                   |

Prerequisites: `source .dev-env.sh` exports `DATABASE_URL`, `DIRECT_URL` and `TEST_DATABASE_URL`
(local PostgreSQL 16), and redirects the npm/pnpm/Playwright caches out of the repository. Then
`pnpm db:deploy && pnpm db:seed` for development, or just `pnpm test:integration` for the test
database (the harness migrates and seeds it itself).

---

## 7. Test data

- **Fixtures come from the seed.** `tests/setup/integration.ts` runs `prisma/seed.ts` in `beforeAll`,
  so catalogue data (locations, categories, attributes, amenities, event types) and a handful of
  listings/enquiries are available. The seed is idempotent, so re-running it is safe.
- **Tests create their own mutable rows with unique identifiers.** A test that needs a listing,
  customer or enquiry should create one with a unique slug/email/reference derived from the test name
  (or a `randomUUID` suffix), and clean up through truncation. Shared mutable rows are the main source
  of order-dependent failures: never `update` a seeded listing and assume the next file sees the
  original values.
- **Catalogue/reference rows are the exception** — they are read-only fixtures, and the seed is the
  only writer.
- **Production data is banned.** No test may read from `DATABASE_URL`, no fixture may be copied from a
  production dump, and the guard in §3.1 exists precisely to make an accidental production run
  impossible. `.env.example` documents `TEST_DATABASE_URL` as an isolated database.
- **No realistic-but-fabricated vendor data in assertions.** The seed deliberately contains no
  reviews, ratings or booking statistics, so a test must not assert on such values. Media are
  placeholder SVGs.

---

## 8. Flakiness and determinism rules

1. **No `Date.now()` dependence without an injectable clock.** `consumeRateLimit(rule, now = new Date())`
   already accepts `now`; use it in unit tests. Services that call `Date.now()` directly
   (`enquiry.service.ts` for the derived idempotency bucket, the duplicate window and the flag window)
   are **not yet injectable** — integration tests around those windows must either use relative
   timestamps (`new Date(Date.now() - 20 * 60_000)` written into the row) or the service should gain
   a clock parameter. This is a real flakiness risk today.
2. **No reliance on row ordering that is not explicitly ordered.** `findMany` without `orderBy` has
   no guaranteed order in PostgreSQL. Assert sets, or supply `orderBy` — the application's own sorts
   always end with an `id` tie-break for exactly this reason (`buildListingOrderBy`).
3. **No network access in unit or integration tests.** The R2 driver tests construct the client and
   call `getSignedUrl`, which is offline signing; they do not perform a request. The local driver
   writes to a temporary directory created per test (`mkdtemp`) and removed in `afterEach`.
4. **No shared mutable state between files.** `fileParallelism: false` prevents concurrent
   truncation, but a file that leaves dirty rows still affects the next file; prefer explicit
   truncation or unique identifiers. (An earlier revision of this document cited the `constraints-*`
   listings left by `database-constraints.test.ts` as a live example; the per-file truncate-and-reseed
   in §3.4 now prevents that class of failure.)
5. **Randomness is seeded or bounded.** `generateReferenceCode()` and `randomUUID()` are collision-safe
   in practice; tests should assert shape/format, not a specific value. `reapStalePendingMedia` and
   the prune functions sample with `Math.random()`, so a unit test for them must either accept a
   probabilistic outcome or the sampling threshold must be made injectable.
6. **Timeouts are explicit.** Integration hooks get 120 s and tests 60 s at the project level, because
   migration + seed is genuinely slow; a test that needs more must raise its own timeout rather than
   the global one.

---

## 9. Coverage philosophy

- **Cover what can silently corrupt data or leak data.** That means every pure domain function
  (`buildListingWhere`, `deriveEnquiryStatus`, `canTransition`, `deriveContactDisclosure`,
  `normalisePhone`, hash payloads), every validation schema edge case that is user-reachable, every
  `onDelete`/unique-constraint behaviour the integrity story depends on, and every ownership check.
  A bug in `deriveContactDisclosure` leaks phone numbers; a bug in `idempotency.service` duplicates
  leads. Those are the tests worth writing first.
- **Do not chase line coverage.** Line coverage rewards executing code, not asserting correct
  behaviour; a route handler can be 100 % covered by one happy-path test while every error branch is
  wrong. The meaningful measures here are rule coverage (the table in §5) and mutation-resistance of
  the pure functions.
- **Which code need not be covered:** Prisma-generated client (`src/generated/prisma/**`),
  `prisma/seed-data/*` literal data, theme token tables and CSS-variable resolvers, Next.js layout
  and metadata boilerplate, and error-message wording. Coverage tooling should exclude generated code
  and the seed; it must not exclude `src/server/**` or `src/lib/**`.
- **No coverage threshold is enforced yet.** `pnpm test:coverage` uses `@vitest/coverage-v8`, which is
  installed (`@vitest/coverage-v8` `5.0.4` in `package.json`), so the provider resolves; a threshold
  should not be added until the §5 table is substantially green, because a threshold over a partial
  suite only creates pressure to write assertion-free tests.

---

## 10. End-to-end scope (Playwright)

`package.json` exposes `e2e`, `e2e:install` and `e2e:report`; `@playwright/test` is installed and
`playwright.config.ts` defines three projects (`desktop-light`, `desktop-dark`, `mobile`) with
`fullyParallel: false`, `workers: 1`, and a `webServer` that runs `pnpm start` against the isolated
test database. `tests/e2e/global-setup.ts` truncates and re-seeds that database under a PostgreSQL
advisory lock, so a run always starts from the same state and two runs cannot race.

**7 spec files / 222 tests** (`npx playwright test --list` → `Total: 222 tests in 7 files`;
`npx playwright test` → 222 passed, 74 per project). What the specs actually assert is:

1. **Discovery and filtering** (`browse-and-filter.spec.ts`): the home search routes to `/vendors`
   with the chosen category; the directory opens a category; **category, location and verified**
   filters compose and never grow the result set; removing one chip removes only that filter; clear
   all keeps the category; page two preserves filters; an impossible combination shows the empty
   state; a venue card highlight renders the option label rather than a raw identifier; a
   category-declared attribute filter appears only for that category. No attribute filter is
   _applied_ by these specs.
2. **Listing profile** (`listing-profile.spec.ts`): opens from results and by direct URL; never
   renders `₹0` for a business with no published price; does not publish a withheld phone number as
   page text; an unknown slug renders not-found; shared provider contact details appear on the
   customer's own enquiry.
3. **Enquiry journey** (`enquiry-flow.spec.ts`): a guest submits and receives a reference code;
   consent is required; the honeypot field is hidden and out of the tab order; submitting twice does
   not create a second lead; multiple providers can be selected **and submitted** in one enquiry; a
   rejected submission recovers once the business address is corrected; tracking requires both
   reference code and matching email and shows a real seeded enquiry.
4. **Admin panel and listing lifecycle** (`admin-journey.spec.ts`): authorization (signed-out
   redirect, signed-in customer refused); the overview, listings table, listing editor, enquiry
   inbox, audit log and catalogue render seeded data; the listings table filters to drafts only;
   every admin "View on site" link resolves to a real page; no horizontal page scroll. The admin
   **mutations** covered are "suspending your own account is refused" and "signing out ends the
   session". The **full lifecycle journey** now exists: create a draft through the real editor →
   upload an image through the real presign/complete pair → publish → `GET /vendors/{slug}` returns
   200 with the listing → open a seeded enquiry → assign the lead → move it through an allowed
   transition with a status note (the timeline renders `<from> → <to>`) → add a private note (the
   body stays in the notes panel; the activity feed records only "Internal note added"). Publishing a
   draft with no image is refused with the service's own message and the listing stays invisible.
5. **Customer account and isolation** (`account-and-isolation.spec.ts`): signed-out redirect; the
   seeded customer's own enquiries with customer-facing wording; an enquiry detail with a
   customer-visible timeline and no admin notes; registration then seeing a submitted enquiry; one
   customer cannot read another's enquiry; the profile page saves permitted details with email
   read-only.
6. **Theming and responsiveness** (`responsive-and-theme.spec.ts`): no horizontal overflow on ten
   page variants and at 320 px; the resolved scheme is applied and persists across navigation; the
   keyboard focus indicator, one `h1` per page, labelled inputs and reduced-motion rules; the mobile
   filter drawer **opens and Escape closes it** (no focus-trap assertion); the mobile navigation is
   reachable. No test measures first paint, so "no flash of incorrect theme" is not asserted.
7. **Crawler surfaces** (`seo-and-metadata.spec.ts`): `robots.txt`, `sitemap.xml`, canonical URLs,
   private surfaces not indexed, and a designed 404 that leaks no stack trace.

E2E must run against the **seeded test database** and the production build (`next build && next
start`) rather than `next dev`, so it exercises the same rendering path users get. It must not assert
on fabricated ratings or review counts, because none exist.

E2E must run against the **seeded test database** and the production build (`next build && next
start`) rather than `next dev`, so it exercises the same rendering path users get. It must not assert
on fabricated ratings or review counts, because none exist.
