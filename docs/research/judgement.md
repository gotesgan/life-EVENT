# Code review — adjudication and consolidated gap analysis

Lead engineer's judgement on three independent adversarial reviews, plus the gaps those reviews did
not cover. Written after re-verifying every claim I rely on, rather than accepting the reviews at face
value.

| Review       | File                                               | Findings | Lens                                              |
| ------------ | -------------------------------------------------- | -------- | ------------------------------------------------- |
| A — backend  | [backend-review.md](./backend-review.md)           | 13       | data model, authorization, search, lead lifecycle |
| B — frontend | [frontend-review.md](./frontend-review.md)         | 19       | URL state, forms, admin UI, design system, a11y   |
| C — rigour   | [architecture-review.md](./architecture-review.md) | 17       | test quality, docs drift, ops, maintainability    |

**49 raw findings → 35 unique after de-duplication**, plus 2 that I found myself and 2 corrections.

---

## 1. Verdict on each review

### Review A (backend) — **trust, with two caveats**

The strongest of the three. It did not argue from reading alone: it wrote throwaway `tsx` probes
against the test database and reproduced each claim. I re-ran its blocker myself and got the identical
result (see §3, B1). I also independently confirmed B5 and the claim that admin routes are uniformly
gated (`for f in $(find src/app/api/admin -name route.ts); do grep -q "getAdminActorContext\|requireAdmin" || echo MISSING; done` → no output).

Caveats: two findings are marked `SUSPECTED` and I agree they cannot be settled without a running
proxy (B3) — they should be treated as design risks, not defects. And it left scratch rows in the test
database, which every integration file truncates, so there is no contamination.

Its most valuable negative result: **it looked for an IDOR and could not find one**, and separately
confirmed that public search cannot be made to return a draft. Those are the two claims most worth
having attacked, and they held.

### Review B (frontend) — **trust, with one correction and one overstatement**

It was honest about its central limitation (no browser) and marked the two findings that depend on
runtime timing as `SUSPECTED`. I independently confirmed four of its findings by inspection (F2, F5,
F8, F13) — all four are real. Its blocker F1 is the same defect as backend B2, found independently
from a different direction (client key lifecycle vs server claim ordering), which is a strong signal.

Two things to correct:

- **F3 is latent, not live.** It flagged that reachability depends on a category declaring a `TEXT`
  filter and that it had not checked the seed. I checked: **there are zero filterable `TEXT` bindings**
  and no `TEXT` attribute exists at all (`NUMBER=8, MULTI_SELECT=12, SINGLE_SELECT=1, BOOLEAN=3`).
  So F3 cannot happen with today's data. It becomes live the moment an administrator defines a `TEXT`
  attribute — which the product explicitly invites. Downgrade to medium, keep the fix.
- **F6's impact statement is imprecise.** It says an inverted budget "returns non-overlapping
  listings". With `priceMin=5000, priceMax=1000`, `buildRangeOverlapClause` admits listings with
  `priceMin ≤ 1000 AND priceMax ≥ 5000` — i.e. ranges spanning the interval, which is the _normalised_
  reading of the input. The result is not nonsense; it silently picks an interpretation. The real
  defect is that the universal ranges accept `min > max` while attribute ranges return 400 — one
  contract, two behaviours. Still worth fixing; the stated harm was overstated.

### Review C (rigour) — **trust, highest value per finding**

The only review that attacked the _evidence_ rather than the product, which is where this project was
weakest. It verified what is true (207 Playwright tests in 7 files via `--list`, 33 page routes, 50 API
route files, 5 migrations, 29 models) and then disproved **15 documentation claims**. I confirmed three
of its operational findings directly: the storage fallback is not fail-closed (R1), the seed has no
production guard (R3), and there is no `.git` and no CI (R13).

Its single most useful contribution is the list of **tests that cannot fail**. That is the finding that
most affects how much the "527 passing / 207 passing" numbers are worth.

---

## 2. Where the reviews agree — treat as high confidence

| Defect                                                                                                                                                        | Reported by                          | My verification                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotency key claimed before validation → a corrected resubmit is permanently blocked, and can falsely report "already submitted"                           | **A (B2) + B (F1)**, independently   | Reproduced by reading `enquiry.service.ts:124` vs `:159`; the form mints one key per mount and never re-mints                           |
| `IP_HASH_SALT` silently defaults to `dev-only-ip-salt` in production; `.env.example` placeholders pass validation                                             | **A (B4) + C (R2)**                  | `env.ts:41` has `.default('dev-only-ip-salt')`, no production guard. `BETTER_AUTH_SECRET` _does_ fail closed — the asymmetry is the bug |
| Documentation overstates what is true (font family, icon stroke, admin masking, one query-string implementation, legible filter state, dead "live" contracts) | **B + C**                            | Confirmed the counts and function names myself                                                                                          |
| E2E coverage is thinner than the headline number suggests; several specs cannot fail for the behaviour they name                                              | **C (R5) + B ("claims overstated")** | Confirmed by reading the named specs                                                                                                    |

## 3. Conflicts and adjudications

| Topic                  | Conflict                                                                                                | Ruling                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test totals            | README says 527 / 0 skipped; `system-design.md §14` says 381 + 112 / 2 skips; C could not run the suite | **C is right that the docs contradict each other.** I ran it: **527 tests across 26 files, 0 failed, 0 skipped** = unit 384 (10 files) + component 29 (5 files) + integration/API 114 (11 files). Both documents are wrong in different ways and must be corrected |
| `TEXT` filter severity | B rates F3 high                                                                                         | **Downgraded to medium — latent, not live.** Zero `TEXT` attributes exist in the schema/seed                                                                                                                                                                       |
| Inverted budget range  | B says results do not overlap the stated range                                                          | **Corrected:** results are the normalised-interval intersection. The defect is missing validation, not wrong output                                                                                                                                                |
| Storage fallback       | C rates R1 blocker                                                                                      | **Agreed, blocker.** `getStorageDriver()` chooses the filesystem driver with no `NODE_ENV` check while both dev routes 404 in production — so on Vercel, uploads "succeed" and the images never render                                                             |

## 4. Gaps the three reviews did not cover

These are mine, found while adjudicating.

### G1 — `/enquire` resolves providers with up to 10 full profile loads (N+1) — **medium**

`src/app/enquire/page.tsx:51-62` calls `getPublicListingBySlug(slug)` once per slug inside
`Promise.all`, and each call loads ~10 relations (media, services, packages, spaces, attributes,
amenities, categories, event types, service areas) to produce `{ slug, name }`. With the form's cap of
`MAX_PROVIDERS = 10` that is up to 10 concurrent heavy profile queries per page render. No batch
resolver exists (`grep` for a slug-batch query across `src/server/services/*.ts` returns nothing).
The backend review flagged dead options but not this. Fix: a `getPublicListingSummariesBySlugs()` that
selects `{ slug, name, publicationStatus, archivedAt }` in one query.

### G2 — `_ValueOptions` is migrated and declared but never written — **low (maintainability)**

`prisma/schema.prisma:404,672` declare an implicit many-to-many between `ListingAttributeValue` and
`AttributeOption`, and `20261014122625_init/migration.sql:547` creates the `_ValueOptions` table. Every
write path uses the `optionIds String[]` column instead. The relation is dead and actively misleading:
it suggests multi-select values are stored relationally when they are stored as an array. Neither the
schema review nor the maintainability review caught it. Fix: drop the relation pair in a migration.

### G3 — Two documented "live" contracts are dead code, and one is a trap

`FILTER_KEYS`, `countActiveFilters`, `hasActiveFilters` and `setSelectedListings`/`readSelectedListings`
in `src/lib/filter-state.ts:181-251` have zero callers (frontend F12, F13). Worth adding: the client
`countActiveFilters` **already disagrees** with the server's about `featured`, so wiring it up later
would silently change the badge. Delete, or unify.

## 5. Consolidated defect list — deduplicated, ranked

### Blockers (4)

| #   | Defect                                                                                                                                                                                              | Source          | Evidence                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Multi-select attribute values render as raw CUIDs** on search cards and profiles, leaking internal identifiers to anonymous visitors. `valueText` already holds the correct labels and is ignored | A (B1)          | My probe: `venue_type` → `cmv83hb4c001mw31rmewaolqu, cmv83hb4l001sw31r469otv2x` while `valueText` = "Banquet Hall, Convention Centre" |
| 2   | **Corrected enquiry resubmit is permanently blocked** (or falsely reports "already submitted") because the idempotency key is claimed before validation and never re-minted                         | A (B2) + B (F1) | `enquiry.service.ts:124` claims; `:159` validates; `EnquiryForm.tsx:269` reuses one key                                               |
| 3   | **Production storage is not fail-closed**: the filesystem driver is chosen whenever `R2_*` is absent, while the routes that serve those objects 404 in production                                   | C (R1)          | `storage/index.ts:20`; `dev-media-upload/route.ts:15`; `local-media/[...key]/route.ts:13`                                             |
| 4   | **Two E2E specs and the documented admin journey** — the create→upload→publish→assign→note→status journey does not exist, and 6 specs cannot fail for their stated purpose                          | C (R4, R5)      | Named in `architecture-review.md` §R4/R5                                                                                              |

### High (8)

| #   | Defect                                                                                                                                                                  | Source                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 5   | Honeypot spam is stored as `DUPLICATE`, not `SPAM`, so admin spam triage never sees it — and a unit test asserts the wrong behaviour                                    | A (B5) — **I reproduced: `deriveEnquiryStatus(['SPAM']) === 'DUPLICATE'`** |
| 6   | `IP_HASH_SALT` defaults in production; `.env.example` placeholders pass validation                                                                                      | A (B4) + C (R2)                                                            |
| 7   | The seed can run against production; the only guards live in `tests/setup/**`                                                                                           | C (R3)                                                                     |
| 8   | Admin "View on site" links to `/listings/<slug>` — a route that does not exist → 404 on both admin surfaces                                                             | B (F2) — **verified: no `src/app/listings`**                               |
| 9   | `featured` filters results with no chip and no count; the two `countActiveFilters` already disagree about it                                                            | B (F5) — **verified**                                                      |
| 10  | Long or fractional filter values the UI permits produce an unactionable error page that blames "the address"                                                            | B (F4)                                                                     |
| 11  | 41 of 50 route modules have no Vitest coverage; assignment validation, duplicate windows, media completion, profile update, cancellation and audit listing are untested | C (R6)                                                                     |
| 12  | `x-forwarded-for`'s first entry is trusted for per-IP rate limiting — client-controlled on append-style proxies (SUSPECTED)                                             | A (B3)                                                                     |

### Medium (9)

Per-lead `isCustomerVisible` defaults to **false** in bulk status while the single control defaults to
true, and terminal bulk moves are unconfirmed (B F7) · the category landing page has **no filter
surface below `md`** (B F8, verified) · one bad admin filter value silently discards every other filter
(B F9) · customer cancellation and admin status changes are TOCTOU — the check is outside the guarded
write (A B6) · `isFeatured` is writable only by the seed, so the Featured ribbon and `featured=true`
filter can never be operated (A B7) · `searchText` is not refreshed when a referenced catalogue entity
is renamed, so search goes stale (A B8) · list pagination sorts on a non-unique key without a
tie-break (A B9) · the R2 content-type re-check is **tautological** — `head()` returns the metadata the
presign set, so the real control is the allow-list alone (A B10) · three services of 740–889 lines with
duplicated helpers (C R14) · **`/enquire` N+1** (my G1).

### Low / nit (12)

Rapid successive filter clicks can drop one (B F10, suspected) · chip remove target is 20×20 px, under
WCAG 2.5.8's 24 px (B F11) · dead `FILTER_KEYS`/`countActiveFilters`/`setSelectedListings` (B F12, F13)
· debounce can re-apply a filter after Reset (B F14, suspected) · hard-coded `themeColor` that cannot
follow the in-app toggle (B F15) · customers list renders the raw email despite a "mask by default"
claim (B F16) · 4 icons missing `stroke={1.5}` (B F17) · admin search inputs lack `aria-hidden`
(B F18) · a 1-character `q` is ignored but chipped (B F19) · inactive categories are publicly
enumerable (A B12) · dashboard and inbox disagree on "unassigned" (A B13) · no `engines` field and a
hard-coded DB user in `playwright.config.ts` (C R17) · `_ValueOptions` dead schema (my G2).

### Documentation (must be corrected, not argued with)

`testing-strategy.md` is **inverted** — it claims component tests do not exist and that `pnpm test`
fails, both false · `security.md` contains six statements that are now false (route count, unused rate
limit, honeypot `max(0)`, seed consent version, seed audit actions, contact block) · `system-design.md`
§14 test totals and `isVisible` field name are wrong · README's "Required" env list is wrong ·
`design-system.md` overstates the font and icon-stroke rules · **no CI exists**, which is how several of
these stayed unnoticed.

## 6. What the reviews established is genuinely sound

Worth stating, because it constrains where to spend effort:

- **No IDOR or privilege escalation found.** Every admin route resolves the actor server-side, ownership
  is enforced in the `where` clause, Better Auth's `role`/`status` are `input: false`, and there is a
  test proving a sign-up cannot self-promote.
- **Draft and unpublished listings cannot leak** through search or the slug endpoint.
- **`PriceTag` never renders `₹0`**, withheld phone numbers are never rendered as page text, and the
  enquiry CTA is primary with no `tel:` link.
- **The status control genuinely offers only `ALLOWED_TRANSITIONS`**, and self/other-admin moderation
  is refused by the server _and_ disabled in the UI.
- **Both themes define the full token set** with no missing `--app-*` variables.
- **The schema, migrations and index list in `database-design.md` §3 are accurate.**

## 7. Recommended fix order

1. **B1 (raw CUIDs on cards)** — one-line fix, highest visible impact, currently leaking identifiers.
2. **B2/F1 (idempotency lock)** — re-mint the key when the payload changes, or treat a replay with
   `enquiryId === null` as a fresh claim. This is losing real leads today.
3. **R1 + R3 + R2 (ops fail-closed)** — refuse to start in production without R2, without
   `IP_HASH_SALT`, and without a non-placeholder secret; guard the seed.
4. **B5 (honeypot → SPAM)** — and fix the unit test that encodes the wrong behaviour.
5. **F2 (admin links) + F5 (featured chip) + F8 (mobile category filters)** — small, user-visible.
6. **F4/F6/F9/F3 (input validation)** — one validation contract for ranges and text, errors rendered
   in the filter rail rather than replacing the page.
7. **Docs + CI** — correct the false claims, then add a workflow so the next drift is caught by a
   machine rather than a review.

---

## 8. Remediation — what was fixed

Every finding in §5 was addressed. This section records what changed, so the reviews can be read as
history rather than as an open list.

### Blockers — all closed, and each now has a regression test

| #   | Defect                                             | Fix                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Multi-select values rendered as raw CUIDs          | `formatAttributeValue` now keys the label map by option **id** and falls back to `valueText`; both projections select `option.id`. Verified: `venue_type` renders "Banquet Hall, Convention Centre". An E2E assertion rejects `/c[a-z0-9]{20,}/` in a card highlight                                                             |
| 2   | Idempotency key claimed before validation          | Validation now runs **before** the claim; an existing claim is _inspected_ first so a genuine key mismatch is still reported as 409 rather than masked by a field error; a claim with no enquiry behind it is released and retaken. The browser derives the key from the payload, so a retry replays and an edit is a new intent |
| 3   | Production storage not fail-closed                 | `getServerEnv()` refuses to start in production without R2 or an explicit `ALLOW_LOCAL_MEDIA_STORAGE=true`; `getStorageDriver()` throws rather than falling back. The build phase is exempt (`NEXT_PHASE`), because a build is not a deployment                                                                                  |
| 4   | Admin E2E journey absent; six specs could not fail | The journey now runs the real shipped path (create → presign → browser PUT → complete → publish → assign → transition → private note). All six weak specs were strengthened, none deleted. E2E went 207 → **222**                                                                                                                |

### Highs — all closed

Honeypot spam now stores `SPAM` (it collapsed to `DUPLICATE`, so triage never saw it) and the unit test
that asserted the wrong behaviour was corrected. Secrets fail closed in production. The seed refuses to
run against production. Admin "View on site" links point at `/vendors/<slug>`, are gated on
publication status, and the listing's `publicationStatus` was projected onto the admin enquiry DTO so
that gate is possible. `featured` gained a chip and a count. Filter inputs clamp and constrain instead
of producing an error page. Per-IP rate limiting reads the forwarded chain **from the trusted end**,
so rotating the header no longer yields a fresh bucket. The untested routes and rules are covered —
9 new files, 72 tests.

### Mediums and below

Bulk status default and confirmation; category filters reachable on mobile; admin filter parsing keeps
the valid subset; cancellation and admin transitions are conditional writes that throw `ConflictError`
when the row moved; `isFeatured` is operable by an administrator and audited; `searchText` is refreshed
when a catalogue entity is renamed; every offset-paginated list has an `{ id: 'asc' }` tie-break; the
upload verification re-checks the storage-reported type against the allow-list and the size against the
cap, so it is no longer tautological on R2; the chip remove target is 24×24; `themeColor` derives from
the theme tokens; the multi-provider shortlist exists (it previously had zero callers) and the profile
CTA respects it; `/enquire` resolves providers in one query instead of up to ten full profile loads;
the dead `_ValueOptions` join table is dropped in a migration.

### Test-suite integrity

The most valuable output of the rigour review was the list of tests that could not fail. All were
strengthened. Two harness defects were also found and fixed: the Vitest global setup seeded without
clearing first, so a previous Playwright run's deliberate cover-less draft aborted the seed before a
single test ran (the truncate list is now shared and applied by both harnesses), and the four stale
`DEFECT:` comments that described already-fixed bugs were reframed as regression rationale.

### Verification

| Check                               | Result                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| `npx vitest run`                    | **36 files, 612 tests, 0 failed, 0 skipped** (was 527)          |
| `npx playwright test`               | **222 passed** across three projects (was 207)                  |
| `npx next build`                    | 58/58 pages, no errors or warnings, needs only the local `.env` |
| `npx eslint .` / `npx tsc --noEmit` | 0 problems / 0 errors                                           |
| Repository                          | 33 page routes, 50 API route files, 6 migrations, 12 documents  |

### Deferred, and why

**R14's full service split.** The duplicated helpers were removed (`actorContext` existed twice and now
lives in `src/server/domain/audit-actor.ts`; `maskPhone` moved beside `maskEmail` in `src/lib/format.ts`),
but the three 700–900-line services were not decomposed. Splitting a live service layer at the end of a
large correction carries a real risk of behavioural drift for a finding that is about readability rather
than correctness, and the suite that would have to catch that drift was itself being rewritten in the
same session. The honest position is that the duplication is fixed, the size is not.
