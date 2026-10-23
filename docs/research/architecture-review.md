# Architecture Review — Engineering Rigour (Review C)

Reviewer: `reviewer-rigour` · Task: `task-3` · Scope: test quality, docs-vs-code drift, operational
readiness, maintainability. Write scope: this file only; nothing was fixed.

Method: read-only inspection (`read`/`grep`/`glob`/`wc`), `source .dev-env.sh` for the sandbox npm
cache, and `npx playwright test --list` (listing only). Per the resource protocol I did **not** run
`next build`, `next dev`, `pnpm start`, `vitest` or `playwright`, so every claim that requires those
runners is recorded under "claims I could not verify" rather than asserted either way.

Headline: the 207 Playwright count **is** true (`npx playwright test --list` → `Total: 207 tests in 7
files`), as are 33 page routes, 50 API route files, 5 migrations and 12 docs. The 527 Vitest count is
**not** independently verifiable under this protocol and is contradicted elsewhere (§R10). The much
bigger problems are that the deployment story is not fail-closed, the seed can reach production, and a
material number of the "verifying" tests cannot fail for the behaviour they name.

---

### R1 — Production storage silently falls back to the local filesystem; the Vercel deploy is not fail-closed

- Severity: **blocker**
- Location: `src/lib/storage/index.ts:20`, `src/lib/storage/local-driver.ts:20`, `src/app/api/dev-media-upload/route.ts:15`, `src/app/local-media/[...key]/route.ts:13`, `README.md:159-161`, `src/lib/env.ts:74-77`
- Status: VERIFIED
- What: `getStorageDriver()` chooses the driver purely from `isR2Configured()` — three optional env
  vars — with no `NODE_ENV` branch. If `R2_*` is absent in production (which README explicitly
  invites: "R2_* may be left blank — the local storage driver is used instead"), the app builds,
  boots and serves, but every media upload is handed a `/api/dev-media-upload?key=…` URL that route
  refuses with 404 in production, and every stored object would live under `.local-storage/` relative
  to `process.cwd()` — read-only on Vercel and ephemeral/unservable even where writable. (The
  predicate also ignores `R2_PUBLIC_BASE_URL`; that omission is less severe because
  `buildPublicUrl` throws a loud `ValidationError` later rather than failing silently.)
- Evidence:
  ```
  src/lib/storage/index.ts:20   cached = isR2Configured() ? createR2StorageDriver() : createLocalStorageDriver();
  src/lib/env.ts:76             return Boolean(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
  src/app/api/dev-media-upload/route.ts:15   return process.env.NODE_ENV !== 'production';
  src/app/local-media/[...key]/route.ts:13   if (process.env.NODE_ENV === 'production') { 404 }
  grep -rn "isR2Configured" src            # only src/lib/storage/index.ts
  ```
- Impact: the claimed "working Vercel + R2 deployment story" is a deploy that appears healthy and
  fails at the first administrator upload, with no startup error. This is the exact class of failure
  the README says `getServerEnv()` prevents.
- Fix: fail closed — when `NODE_ENV === 'production'` and R2 is not configured, throw from
  `getStorageDriver()` (or make `R2_*` required in the production branch of `serverEnvSchema`).

### R2 — Secrets are never checked against the documented placeholders; a `.env.example` copy is accepted in production

- Severity: **high**
- Location: `src/lib/env.ts:22`, `src/lib/env.ts:41`, `.env.example:23`, `.env.example:41`
- Status: VERIFIED
- What: `BETTER_AUTH_SECRET` is only `z.string().min(16)` and `IP_HASH_SALT` is
  `z.string().default('dev-only-ip-salt')`. The example values
  (`"replace-with-a-long-random-secret"`, 33 chars; `"replace-with-a-random-salt"`) pass validation in
  every environment, including production. There is no `superRefine` that rejects the placeholders and
  no production branch anywhere in `env.ts`.
- Evidence:
  ```
  src/lib/env.ts:22   BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 characters'),
  src/lib/env.ts:41   IP_HASH_SALT: z.string().default('dev-only-ip-salt'),
  .env.example:23     BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
  ```
- Impact: a deploy that copies `.env.example` and forgets one value runs with a publicly known session
  signing secret (session forgery) and a known IP salt (rate-limit-key forgery, duplicate-detection
  collision). README:151-153 states the opposite: "a missing or malformed variable fails loudly".
- Fix: add `.refine()` rejecting the documented placeholders, and require a non-default
  `IP_HASH_SALT` when `NODE_ENV === 'production'`.

### R3 — The seed can run against production; the only guard lives in the test harness

- Severity: **high**
- Location: `prisma/seed.ts:43-48`, `prisma.config.ts:17`, `package.json:20-21`
- Status: VERIFIED
- What: `prisma/seed.ts` connects to `process.env.DIRECT_URL ?? process.env.DATABASE_URL` and checks
  only that _some_ URL exists. There is no `NODE_ENV` refusal, no confirmation flag, and no database
  identity check. `pnpm setup` is `prisma migrate deploy && prisma generate && tsx prisma/seed.ts`, and
  `pnpm db:seed` is `prisma db seed`. The README's safety story ("Integration tests refuse to run if
  `TEST_DATABASE_URL` is unset or equals `DATABASE_URL`", README:90-91) covers only tests — nothing
  covers the seed.
- Evidence:
  ```
  prisma/seed.ts:43   const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
  prisma/seed.ts:45   if (!connectionString) throw new Error('DIRECT_URL or DATABASE_URL must be set …');
  package.json:21     "setup": "prisma migrate deploy && prisma generate && tsx prisma/seed.ts",
  grep -rn "NODE_ENV" prisma/seed.ts   # no matches
  ```
- Impact: a shell that has pulled production env (e.g. `vercel env pull`, or a CI job that exports
  `DIRECT_URL`) and then runs `pnpm db:seed` or `pnpm setup` writes the entire fake catalogue,
  seed users and seed enquiries into the production database. The seed is intentionally idempotent, so
  it will overwrite/attach to real reference data.
- Fix: refuse to run when `NODE_ENV === 'production'` unless an explicit `ALLOW_PRODUCTION_SEED=1`
  is set, and print/confirm the target host in the non-production case. Same guard belongs in
  `prisma/seed.ts`, not only in `tests/setup/*`.

### R4 — The documented E2E admin journey does not exist

- Severity: **high**
- Location: `docs/testing-strategy.md` §10 item 4 vs `tests/e2e/admin-journey.spec.ts:122-147`
- Status: VERIFIED
- What: testing-strategy §10 claims journey 4 is "sign in as admin → create a listing → upload/attach
  media → publish → verify it appears in public search → assign a lead → add a private note → change a
  lead status and confirm the customer-visible timeline matches `isCustomerVisible`." The only
  `admin mutations` tests in the suite are "suspending your own account is refused" and "signing out
  ends the session". There is no listing creation, no media upload, no publish, no public-search
  verification, no assignment, no note and no status change anywhere in the file.
- Evidence:
  ```
  $ npx playwright test --list | grep -c "create a listing\|administrator journey"
  0
  $ grep -c "createListing\|upload\|publish\|assign\|note\|status" tests/e2e/admin-journey.spec.ts
  (no such test titles; file body contains none of these actions)
  ```
- Impact: the highest-value workflow in the product (a lead moving through publish → assign → note →
  status) has zero browser coverage while the document presents it as the reason the E2E suite exists.
  It is the single largest overstatement in the docs.
- Fix: either implement the journey as a spec, or rewrite §10 item 4 to list what the admin specs
  actually assert (render + authorization).

### R5 — Six Playwright tests cannot fail for the behaviour they name

- Severity: **high**
- Location: `tests/e2e/listing-profile.spec.ts:91-100`, `tests/e2e/enquiry-flow.spec.ts:87-94`, `tests/e2e/admin-journey.spec.ts:72-81`, `tests/e2e/responsive-and-theme.spec.ts:183-198`, `tests/e2e/admin-journey.spec.ts:57-70`, `tests/e2e/admin-journey.spec.ts:123-137`
- Status: VERIFIED
- What:
  1. `listing-profile.spec.ts:91` "shows the contact details once the customer is signed in with a
     shared lead" signs in, opens `/vendors`, and asserts only a heading and no error boundary. Delete
     `deriveContactDisclosure`/`ListingContactCard` entirely and it still passes.
  2. `enquiry-flow.spec.ts:87` "multiple providers can be selected in one enquiry" never selects a
     second provider or submits; it asserts one "send an enquiry" link is visible.
  3. `admin-journey.spec.ts:72` "renders category-specific attribute controls" asserts only an `<h1>`
     and no error boundary — no attribute control is queried although the helper
     `expectNoErrorBoundary` always passes on a healthy page.
  4. `responsive-and-theme.spec.ts:183` "applying a filter from the drawer updates the URL" wraps the
     entire body in `if ((await applyButton.count()) > 0)`. If the apply button is removed, the test
     passes without asserting anything.
  5. `admin-journey.spec.ts:57-70` "filters them" computes `drafts` with a ternary that turns a zero
     count into `0`, then `expect(drafts).toBeLessThanOrEqual(unfiltered)` — passes if the filter is
     a no-op.
  6. `admin-journey.spec.ts:123-137` guards both the row lookup and the button lookup in `if`
     statements, so it passes when the self-suspend control is absent.
- Evidence: source excerpts above; each test's only failure path is an absent heading or a thrown
  locator.
- Impact: a false sense of safety concentrated in exactly the areas the docs claim are proven — contact
  disclosure, multi-provider enquiry, the listing editor, mobile filters and admin moderation.
- Fix: assert the observable outcome (`expect(contactBlock).toContainText(phone)`, select two cards,
  query an attribute control by role, fail when the apply button is missing, assert strict inequality
  and a known row count).

### R6 — 41 of 50 route modules have no Vitest coverage, and several business rules have no test at all

- Severity: **high**
- Location: `tests/api/*` (9 route modules imported) vs `src/app/api/**/route.ts` (50 files)
- Status: VERIFIED
- What: the only route modules imported by any Vitest suite are:
  `admin/catalog/event-types`, `admin/customers/[id]`, `admin/enquiries/[id]/status`,
  `admin/overview`, `enquiries`, `enquiries/[referenceCode]`, `enquiries/track`, `listings`,
  `listings/[slug]`. Everything else — all 15 catalogue CRUD routes, all listing write routes, all
  media routes, the account/profile route, the cancel route, audit-logs, facets, categories, locations,
  amenities, event-types — is exercised only (if at all) through Playwright, or not at all.
  `docs/testing-strategy.md` §5's summary claims "the main public/admin API surfaces are now
  genuinely covered"; 9/50 is not that.
- Evidence:
  ```
  $ grep -rhoE "@/app/api/[^'\"]+" tests --include=*.ts | sort -u | wc -l
  9
  $ find src/app/api -name route.ts | wc -l
  50
  $ while read fn; do c=$(grep -rl "\b$fn\b" tests --include=*.ts --include=*.tsx | wc -l); echo "$c $fn"; done < <(grep -rhoE "export (async )?function [a-zA-Z]+" src/server | awk '{print $NF}' | sort -u) | awk '$1==0'
  0 adminAssignLead
  0 adminFlagDuplicate
  0 adminListCustomers
  0 adminListEnquiries
  0 cancelCustomerEnquiry
  0 completeMediaUpload
  0 getAccountOverview
  0 listAuditLogs
  0 reapStalePendingMedia
  0 requestMediaUpload
  0 updateCustomerProfile
  …
  ```
- Impact: the rules most likely to silently corrupt or leak data — assignment-target validation
  (`role=ADMIN,status=ACTIVE`), duplicate-flag windows, media completion re-verification, profile
  update, cancellation, the audit filter, and the structured 500 envelope — have no automated
  assertion. The `R13` risk item in `docs/implementation-plan.md` still lists several of these as
  uncovered while `§6` marks R13 "Fixed", so the doc does not even agree with itself.
- Fix: add API tests for the write routes (media presign/complete/delete, listing publication and
  verification, assignment, notes, duplicate-flag, profile update, cancel) and service tests for the
  duplicate windows; those are the rules the product's integrity depends on.

### R7 — `docs/testing-strategy.md` is stale in ways that invert what is and is not covered

- Severity: **high**
- Location: `docs/testing-strategy.md:11-15`, `:70-74`, `:217-223`, `:239-243`, `:325-326`, `:338-354`
- Status: VERIFIED
- What: this document is the project's honesty ledger and several entries are now the opposite of the
  code:
  - `:239` "`pnpm test` … **Currently fails** on the missing `tests/setup/component.ts`" — the file
    exists and there are 5 component spec files.
  - `:70-74` the "**Resolved:**" block says "there are still no files under `tests/component/`" — false.
  - `:223` component layer "Not covered — no files or `tests/setup/component.ts`" — false.
  - `:217,219,220` "Not covered" for attribute write-validation, publication requirements and
    "listing create/update replaces relations atomically and refreshes `searchText`" — all three are
    covered by `tests/integration/listing-lifecycle.test.ts` (attribute validation `:310-425`,
    publication guards `:103-153`, relation replacement + `searchText` `:205-258`). Only `:218`
    (media completion through the local driver) is still genuinely uncovered.
  - `:325-326` "`pnpm test:coverage` uses `@vitest/coverage-v8`, which is configured, so it will fail
    until `@vitest/coverage-v8` (or similar) is added" — self-contradictory and false:
    `@vitest/coverage-v8` is in `package.json:64`.
  - `:11-13` file counts: Component **4** (actual 5), Integration + API **12** (actual 11).
  - `:338-354` the §10 journey list claims an attribute filter is applied, the mobile drawer "traps
    focus", and light/dark render "with no flash of incorrect theme". `browse-and-filter.spec.ts`
    never applies an attribute filter (only category/location/verified); the drawer test only covers
    open + Escape; no test measures first paint.
- Evidence:
  ```
  $ ls tests/component/*.test.tsx | wc -l            → 5
  $ ls tests/integration/*.test.ts | wc -l           → 8   (11 with tests/api)
  $ grep -n "coverage-v8" package.json               → 64:    "@vitest/coverage-v8": "5.0.4",
  $ ls tests/setup/component.ts                      → exists
  ```
- Impact: the document that is supposed to stop a reader over-trusting the suite instead tells them
  the suite is broken when it is not, and under-states real coverage in some places while
  over-stating it in others. The "honest summary" at `:226` cannot be trusted.
- Fix: regenerate §2, §5, §6 and §10 from the current tree; keep the "not covered" column tied to a
  named file so it cannot drift silently.

### R8 — `docs/security.md` contains six false statements, including one that under-states the app and one that over-states the risk

- Severity: **medium**
- Location: `docs/security.md:8`, `:26`, `:166-168`, `:291-297`, `:338`, `:394`, `:449-450`
- Status: VERIFIED
- What:
  - `:8` "~42 `apiHandler`-wrapped route handlers" — actual **48** of 50 (`apiHandler` absent only
    from `auth/[...all]` and `dev-media-upload`, both intentionally).
  - `:26` and `:338` "`RATE_LIMIT_AUTH_PER_IP` exists in the env schema but is not yet wired to
    anything" / "currently unused" — it **is** wired: `src/lib/auth/server.ts:84,86,87`.
  - `:291-297` "`createEnquirySchema.companyWebsite` is `z.string().max(0).optional()`, so a non-empty
    value is a validation error … the SPAM path is unreachable" — actual schema is
    `z.string().max(200).optional()` (`src/lib/validation/enquiry.ts:65`); the SPAM path is reachable.
  - `:394` "the seed writes `'2026-01-15'`" — `prisma/seed.ts:53` writes `'2026-02-01'`, matching
    `PRIVACY_POLICY_VERSION`.
  - `:449-450` "the seed's `'listing.featured'` / `'media.uploaded'` audit actions … are not in the
    application enum" — all five seed actions (`listing.published`, `listing.verified`,
    `listing.featured`, `enquiry.status_changed`, `listing.media_uploaded`, `prisma/seed.ts:58-64`) are
    in `AUDIT_ACTIONS` (`src/lib/validation/audit.ts`).
  - `:166-168` "no page renders the listing contact block yet" — `src/app/vendors/[slug]/page.tsx:273`
    renders `<ListingContactCard />`.
- Evidence: excerpts above plus
  `grep -c "apiHandler" $(grep -rl apiHandler src/app/api --include=route.ts) | wc -l` → 48.
- Impact: the security document is otherwise unusually honest, which makes these stale lines more
  dangerous: a reader will add `RATE_LIMIT_AUTH_PER_IP` (already there), "fix" a honeypot that is
  already fixed, or remove audit actions that are valid.
- Fix: amend `:8`, `:26`, `:166-168`, `:291-297`, `:338`, `:394`, `:449-450`; the `§13 item 10` list
  should drop the now-fixed honeypot/enum items and keep only the real gaps.

### R9 — `docs/database-design.md` §6 reports a data-integrity inconsistency that does not exist

- Severity: **medium**
- Location: `docs/database-design.md:352-356`
- Status: VERIFIED
- What: the blockquote says the seed writes `listing.featured` and `media.uploaded`, "neither of which
  exists in the application enum", so "the database now contains actions the audit-log filter schema
  cannot accept." `listing.featured` is present in `AUDIT_ACTIONS` (`src/lib/validation/audit.ts:17`),
  the seed writes `listing.media_uploaded` (not `media.uploaded`) at `prisma/seed.ts:63`, and that
  value is present too. No row exists that the query schema rejects.
- Evidence:
  ```
  prisma/seed.ts:58-64   'listing.published','listing.verified','listing.featured','enquiry.status_changed','listing.media_uploaded'
  src/lib/validation/audit.ts:17,20   'listing.featured', 'listing.media_uploaded'
  ```
- Impact: a false integrity warning sends the reader looking for a bug that is not there and can
  trigger a needless migration; it also masks the one real remaining caveat (both docs' provenance
  claims) behind a wrong one.
- Fix: delete the blockquote, or replace it with the verified fact that all seed actions are in the
  enum.

### R10 — `docs/system-design.md` §14, the README and testing-strategy disagree on the test totals and route count

- Severity: **medium**
- Location: `docs/system-design.md:619` (gate item 10), `:613` (item 4), `:221`; `README.md:102-106`; `docs/testing-strategy.md:14-15`
- Status: VERIFIED
- What:
  - `system-design.md` gate item 10: "**381 unit + 112 integration/API tests pass (2 documented
    skips)**" = 493 tests. `README.md:102` and `testing-strategy.md:14` claim **527 passing, 0
    skipped**. Both cannot be true; at minimum one set is stale.
  - Gate item 4: "**44 route handlers** under `src/app/api/**`, all wrapped in `apiHandler()`" — there
    are 50 route files and 48 are wrapped (the auth catch-all cannot be, and `dev-media-upload` is a
    deliberate exception). "all" is false.
  - `:221` lists the binding fields as `…, isSearchable, isVisible, isComparable, …`; the schema field
    is `isVisibleOnProfile` (`prisma/schema.prisma:373`). `implementation-plan.md` R13 claims
    system-design was "amended" for exactly this kind of drift.
- Evidence:
  ```
  $ grep -c 381 docs/system-design.md   # 1  ("381 unit + 112 integration/API")
  $ grep -rn "527" README.md docs/testing-strategy.md
  $ find src/app/api -name route.ts | wc -l   → 50
  $ grep -rl apiHandler src/app/api --include=route.ts | wc -l   → 48
  grep -n "isVisible" prisma/schema.prisma   → 373: isVisibleOnProfile
  ```
- Impact: the "Verified state" tables are the artifact a reviewer is meant to trust; two documents
  give different totals for the same run, so neither is trustworthy as a record.
- Fix: regenerate the readiness-gate table from one run and make README link to it rather than
  restating numbers; correct `isVisible` → `isVisibleOnProfile`.

### R11 — README's "Required" environment list is wrong

- Severity: **medium**
- Location: `README.md:155` vs `src/lib/env.ts:19,25`
- Status: VERIFIED
- What: README lists `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` as
  required. `DIRECT_URL` is `z.string().min(1).optional()` and `NEXT_PUBLIC_APP_URL` has
  `.default('http://localhost:3000')`. Only `DATABASE_URL` and `BETTER_AUTH_SECRET` are actually
  required. This matters operationally because a Neon deploy without `DIRECT_URL` does not fail at the
  boundary — it silently falls back to the pooled URL for migrations (`prisma.config.ts:17`), which is
  the failure mode the same README warns about.
- Evidence:
  ```
  src/lib/env.ts:19   DIRECT_URL: z.string().min(1).optional(),
  src/lib/env.ts:25   NEXT_PUBLIC_APP_URL: z.string().min(1).default('http://localhost:3000'),
  prisma.config.ts:17 const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  ```
- Impact: an operator who follows the README believes the app will refuse to start without
  `DIRECT_URL`; it will not, and `prisma migrate deploy` will then run over the pooled endpoint.
- Fix: either make `DIRECT_URL` required (and `NEXT_PUBLIC_APP_URL` required in production), or split
  the README table into "required" and "recommended in production".

### R12 — Tautological and weak assertions inside the passing Vitest suite

- Severity: **medium**
- Location: `tests/component/enquiry-form.test.tsx:87-117`, `tests/integration/search.test.ts:335-345`, `tests/component/admin-enquiry-inbox.test.tsx:112-120`, `tests/api/listings.test.ts:67-79`, `tests/integration/catalog.test.ts:211`, `tests/integration/database-constraints.test.ts:252`, `tests/integration/search.test.ts:107,228`
- Status: VERIFIED
- What:
  1. `enquiry-form.test.tsx:87` is named "posts the enquiry with a **stable** Idempotency-Key header"
     but asserts only `expect(headers['Idempotency-Key']).toBeTruthy()`. Generating a new random key
     per attempt — defeating the entire idempotency contract — still passes. The test to write is
     "submit twice and assert the same header value".
  2. `search.test.ts:335` "orders `name_asc` **exactly as the whitelisted clause does**" builds the
     expected list with the production `buildListingOrderBy('name_asc')`. Both sides share the
     production ordering function, so a wrong `name_asc` order is invisible; the test can only fail if
     `searchPublicListings` stops calling `buildListingOrderBy`.
  3. `admin-enquiry-inbox.test.tsx:118-119` asserts the unmasked email and phone are absent from a row
     whose input (`row()` at `:42-94`) contains only `contactEmailMasked`/`contactPhoneMasked` and a
     phone that is not the unmasked value. The assertion cannot fail; the file's header claims the
     "privacy boundary is the point".
  4. `tests/api/listings.test.ts:67-79` (combined-filter narrowing) uses `toBeLessThanOrEqual`, so it
     passes when every filter is a no-op; only the `isVerified` loop carries signal, and it is
     conditional on the seeded rows.
  5. Non-assertions: `catalog.test.ts:211 expect(venues).toBeDefined()`,
     `database-constraints.test.ts:252 resolves.toBeDefined()`, and
     `search.test.ts:107,228 rejects.toBeDefined()` (should be `toBeInstanceOf(ValidationError)` with
     the details asserted).
- Evidence: source excerpts above.
- Impact: these are exactly the assertions a mutation test or a deliberate break would not catch. They
  inflate the pass count without buying rule coverage.
- Fix: replace each with an outcome assertion as named above.

### R13 — There is no CI, no hook, and no version control in the working tree

- Severity: **medium**
- Location: repository root; `docs/implementation-plan.md:305` (R10)
- Status: VERIFIED
- What: there is no `.github/` directory, no `.husky/`, no other CI YAML, and no `.git` — `git log`
  returns `fatal: not a git repository`. The Playwright config branches on `process.env.CI` and the
  README describes a `pnpm check` gate, but nothing runs or enforces either.
- Evidence:
  ```
  $ ls -la .github                      → No such file or directory
  $ find . -maxdepth 2 -name '*.yml' -o -maxdepth 2 -name '*.yaml' | grep -v node_modules
  ./pnpm-lock.yaml
  $ git log --oneline -5                → fatal: not a git repository
  ```
- Impact: the "Verified state" table is a one-off manual snapshot. The project's own risk R10 ("No
  CI. None of the verification commands run automatically, which is how R1 stayed unnoticed") is
  still open. Any regression after this snapshot is undetected.
- Fix: add a workflow running `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit`,
  plus a PostgreSQL-backed job for `pnpm test:integration` and `pnpm e2e`; commit the working tree.

### R14 — Maintainability: three services are doing far too much, with duplicated helpers

- Severity: **medium**
- Location: `src/server/services/listing.service.ts` (889 lines), `admin-enquiry.service.ts` (791),
  `enquiry.service.ts` (744); `src/app/api/admin/catalog/**` (15 files, 988 lines)
- Status: VERIFIED
- What:
  - `listing.service.ts` mixes public reads (`getPublicListingBySlug:39`), slug generation, listing
    create (`:378`), update (`:510`), publication (`:682`), verification (`:766`), admin listing
    (`:805`) and admin detail (`:859`) — at least four responsibilities (read projection, write
    orchestration, lifecycle state machine, admin listing query).
  - `admin-enquiry.service.ts` mixes the inbox query, detail projection, lead status machine,
    assignment, notes, duplicate flagging, metrics and customer moderation. That is an admin
    "god service".
  - `enquiry.service.ts` mixes public submission (including duplicate detection, rate limiting,
    honeypot, reference-code generation) with customer reads, cancellation and tracking.
  - Duplication: `actorContext()` is defined twice (`listing.service.ts:311`,
    `admin-enquiry.service.ts:26`); `maskPhone` lives in `admin-enquiry.service.ts:35` while its
    sibling `maskEmail` lives in `src/lib/format.ts:134`; the 15 catalogue routes each re-implement the
    same parse→authorise→validate→audit→Prisma skeleton.
  - Change-amplification: adding a `PublicationStatus` value requires touching nine files
    (`ListingRowActions.tsx`, `ListingsFilters.tsx`, `src/lib/validation/listing.ts`,
    `search-filters.ts`, `catalog.service.ts`, `enquiry.service.ts`, `listing.service.ts`,
    `search.service.ts`, plus a migration); adding a sort requires
    `src/lib/validation/search.ts` + `search-filters.ts`.
- Evidence: `grep -nE "^export (async )?function|^function"` output for the three services;
  `wc -l` for the catalogue routes; the `isVisible`/field greps above.
- Impact: the two most likely future changes (a new status, a new sort/filter) require edits in
  unrelated files with no compiler help, and the services are already too large to review safely.
- Fix: split `admin-enquiry.service.ts` into inbox / lead-lifecycle / moderation / metrics;
  split `listing.service.ts` into read-projection and admin-write modules; move `maskPhone` beside
  `maskEmail`; extract the shared `actorContext`; parameterise the catalogue route skeleton or accept
  a small generic CRUD helper.

### R15 — Stale "DEFECT" comment asserts a bug that has been fixed

- Severity: **low**
- Location: `tests/integration/listing-lifecycle.test.ts:377-382` vs `src/server/services/attribute.service.ts:173-221`
- Status: VERIFIED
- What: the test is preceded by a comment claiming "`validateAttributeValues` only range-checks the
  numeric value; it never checks that the typed column matches the definition's dataType … Supplying
  `valueNumber` for a BOOLEAN attribute is silently accepted". The service now builds `suppliedColumns`
  and throws when a supplied column does not match the data type (`attribute.service.ts:177-221`), so
  the test passes and the comment describes the opposite of the code. A reader auditing the suite will
  believe a defect exists that does not.
- Evidence:
  ```
  attribute.service.ts:214   const mismatched = suppliedColumns.filter((column) => column.present && !column.matches);
  attribute.service.ts:215-221  if (mismatched.length > 0) { issues.push(…); }
  ```
- Impact: misleading review artefact; if someone later removes the check, the comment will make it
  look intentional.
- Fix: delete the DEFECT comment and rename the test to state the invariant it actually guards.

### R16 — E2E depends on a hard-coded seed reference code

- Severity: **low**
- Location: `tests/e2e/enquiry-flow.spec.ts:109-118` (`LE-ZM4H6CYV`)
- Status: VERIFIED
- What: the test fills a literal reference code that only exists if `prisma/seed-data/enquiries.ts`
  still produces exactly that value. `generateReferenceCode()` is random in production but the seed
  data is literal, so any seed edit silently breaks this test for a reason unrelated to the feature.
- Impact: brittle; a red test that says nothing about the tracking contract.
- Fix: read the seeded reference from the seed data module or from the account page.

### R17 — Portability nits: no `engines` field, hard-coded database user in the Playwright config

- Severity: **nit**
- Location: `package.json` (no `engines`), `playwright.config.ts:50,53`
- Status: VERIFIED
- What: README requires Node 24+/pnpm 9+ but `package.json` declares no `engines`. `playwright.config.ts`
  hard-codes `postgresql://shantanugote@localhost:5432/liveenvt_test` as the fallback DATABASE_URL for
  the E2E web server — a machine-specific username in a committed config (harmless only because
  `tests/e2e/global-setup.ts` throws first when `TEST_DATABASE_URL` is unset).
- Fix: add `engines`; drop the hard-coded fallback in favour of failing when `TEST_DATABASE_URL` is
  unset.

---

## Documented claims I could not verify

Under the resource protocol I could not run Vitest or a build, so these remain unverified. Where a
claim is contradicted elsewhere it is flagged in the findings above.

| Claim                                                                                             | Location                                                                             | Why unverifiable / note                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test` → 527 passing, 0 failed, 0 skipped (26 files)                                         | `README.md:102`, `docs/testing-strategy.md:14`, `docs/implementation-plan.md:80,322` | Requires `vitest run`. Contradicted by `system-design.md` §14 ("381 + 112, 2 skips").                                                                                                                                      |
| `pnpm build` → 58/58 pages generated                                                              | `README.md:103`                                                                      | Requires `next build`.                                                                                                                                                                                                     |
| `pnpm test:unit` → 10 files, 381 passing                                                          | `docs/testing-strategy.md:240`                                                       | Requires Vitest; the runtime count is loop-expanded and not statically derivable with confidence.                                                                                                                          |
| `pnpm format:check` / `pnpm lint` / `pnpm typecheck` clean                                        | `README.md:99-101`                                                                   | Requires those runners (typecheck/build are explicitly out of scope).                                                                                                                                                      |
| Per-file test counts in §5 (`enquiry-status` 110, `errors` 37, `storage` 33, `search-filters` 78) | `docs/testing-strategy.md:197-203`                                                   | Two were checked and match (`errors` = 37, `enquiry-status` = 110, `contact-disclosure` = 19, all confirmed by loop expansion); `search-filters` declares 79 `it()` against a claimed 78, so the row is at best imprecise. |
| WCAG contrast ratios (6.43:1 / 5.72:1 etc.)                                                       | `docs/design-system.md:145,235-252`                                                  | Requires computing relative luminance from the token table; not attempted.                                                                                                                                                 |
| "light and dark schemes render with no flash of incorrect theme"                                  | `docs/testing-strategy.md:353`                                                       | No test measures first paint; the theme specs assert the resolved attribute and background luminance after load.                                                                                                           |
| Mobile filter drawer "traps focus"                                                                | `docs/testing-strategy.md:354`                                                       | `responsive-and-theme.spec.ts:168-181` only opens and Escape-closes; no focus-trap assertion.                                                                                                                              |

Verified-true counts (for balance): 207 Playwright tests in 7 files (`npx playwright test --list`),
33 `page.tsx`, 50 `route.ts`, 5 migration directories, 12 `docs/*.md`, 29 models and 14 enums
(`grep -c '^model '` / `^enum `), 8 B-tree indexes + 1 GIN on `business_listings`.

## Business rules with no test

| Rule                                                                         | Where it lives                                     | Evidence of absence                                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Lead assignment target must be `role=ADMIN, status=ACTIVE`                   | `admin-enquiry.service.ts:438` (`adminAssignLead`) | `grep -rl adminAssignLead tests` → 0 files                                                                   |
| 15-minute duplicate window returns the existing enquiry; 24-hour flag window | `enquiry.service.ts:351,391`                       | No test references `findRecentDuplicate`/`hasRecentContactEnquiry`; `testing-strategy.md:216` admits partial |
| Honeypot → `SPAM` triage                                                     | `enquiry.service.ts:105`                           | Only the field's CSS/tabindex is tested (`enquiry-flow.spec.ts:46`); no test submits a filled honeypot       |
| Media completion re-verification (HEAD + content-type + length)              | `media.service.ts` `completeMediaUpload`           | 0 test files reference the function                                                                          |
| Customer profile update (permitted fields only, email read-only)             | `account.service.ts:73`                            | `grep -rl updateCustomerProfile tests` → 0                                                                   |
| Cancellation of an own enquiry                                               | `enquiry.service.ts:637`                           | 0 test files reference `cancelCustomerEnquiry`                                                               |
| Audit-log listing/filtering by action/actor/entity                           | `audit.service.ts` `listAuditLogs`                 | 0 test files reference `listAuditLogs`                                                                       |
| Catalogue CRUD slug/path maintenance (15 routes)                             | `src/app/api/admin/catalog/**`                     | Only `event-types` is imported by a test                                                                     |
| Structured 500 envelope (no stack trace, constant message)                   | `src/lib/api/response.ts`                          | `testing-strategy.md:222` admits "Not covered"                                                               |
| DTO privacy boundary at the route (customer projection)                      | `src/server/dto/**`                                | Asserted only for the inbox component; no API-level leakage test                                             |

## Top 5 by risk

1. **R1 — production storage falls back to the local driver.** A Vercel deploy that follows the README
   boots and silently cannot upload media; nothing fails closed.
2. **R3 — the seed can be pointed at production.** `pnpm setup`/`pnpm db:seed` have no environment
   guard; the documented safety net exists only inside the test harness.
3. **R2 — placeholder secrets pass validation in production.** A `.env.example` copy yields a known
   `BETTER_AUTH_SECRET` and a default IP salt.
4. **R4 + R5 — E2E coverage is overstated and six specs cannot fail for their stated purpose.** The
   documented admin create→publish→assign→note journey does not exist, and the contact-disclosure,
   multi-provider and mobile-filter specs are effectively smoke tests.
5. **R6 + R7 — 41/50 routes and the highest-integrity business rules are untested, while the honesty
   ledger claims the opposite.** Fix the tests first, then regenerate `testing-strategy.md` from the
   tree so the two cannot drift apart again.
