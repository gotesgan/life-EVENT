# Backend review — `live-envt`

Independent adversarial review of the backend (task-1). Reviewer: `reviewer-backend`.
Scope reviewed: `prisma/**`, `src/server/**`, `src/lib/{env,auth,api,storage,validation,pagination,errors}.ts`,
`src/app/api/**`. Read-only; nothing was fixed.

Method: read the paths end to end, ran the full test suite, then wrote throwaway `npx tsx` probes
against the isolated test database (`TEST_DATABASE_URL`) to try to falsify each claim. Tests at review
time: `npx vitest run --project unit` → 384 passed / 10 files; `npx vitest run --project integration`
→ 114 passed / 11 files. **Every defect below survives a green suite.**

Findings are ordered by severity. `VERIFIED` = reproduced with a command or traced end to end;
`SUSPECTED` = reasoned from the code but not reproduced.

---

### B1 — Multi-select attribute values render as raw database IDs on cards and profiles

- Severity: blocker
- Location: `src/server/domain/attribute-display.ts:35`, `src/server/domain/attribute-display.ts:60`
- Status: VERIFIED
- What: For `MULTI_SELECT`, the label map is keyed by option **value**
  (`optionsByValue = new Map(attribute.options.map(o => [o.value, o.label]))`) but it is looked up with
  `value.optionIds`, which contains option **ids**. Every lookup misses and the code falls back to the
  raw id (`optionsByValue.get(id) ?? id`). Both projections that feed this function select only
  `{ value, label }` for `attribute.options` (`src/server/repositories/listing-search.repository.ts:61`,
  `src/server/services/listing.service.ts:103`), so the id can never be resolved. The correct labels
  already exist in `valueText` and are ignored.
- Evidence:
  - Pure function probe:
    ```
    formatAttributeValue({dataType:'MULTI_SELECT',unit:null,options:[{value:'candid',label:'Candid'}]},
      {valueText:'Candid, Traditional',...,optionIds:['opt_id_1','opt_id_2']})
    => "opt_id_1, opt_id_2"
    ```
  - End-to-end against the seeded test DB (`getPublicListingBySlug('the-sandalwood-grand')`):
    ```
    indoor_outdoor => "cmv8g7wjv001vu91rwup0ikx4, cmv8g7wjw001wu91rrilnp6n6, cmv8g7wjx001xu91r6y2gj8co"
    venue_type     => "cmv8g7wjo001nu91r1wjpr28w, cmv8g7wjl001mu91rfskjwdb4, cmv8g7wjs001ru91rdwpdc0nx"
    ```
  - End-to-end through `searchPublicListings({category:'venues'})` (card highlights):
    ```
    the-sandalwood-grand -> [{"code":"venue_type","value":"cmv8g7wjo001nu91r1wjpr28w, cmv8g7wjl001mu91rfskjwdb4 +1"}, ...]
    ```
- Impact: The primary browse surface is broken for every category whose card attribute is a
  multi-select. The seed binds `venue_type`, `photography_style`, `decor_style`, `makeup_service_type`
  and `performance_type` to cards (`showOnCard: true`), so venue, photographer, decorator, beauty and
  entertainment result cards and profile pages show `cmv8g7wjo001nu91r1wjpr28w` instead of
  "Hotel, Banquet Hall". Raw internal identifiers are also leaked to anonymous visitors.
- Fix: In both call sites add `id: true` to the `attribute.options` select and key the map by
  `option.id`; or, smallest change, return `value.optionIds.length === 0 ? value.valueText :
value.valueText ?? null` — since both the seed (`prisma/seed.ts:547-548`) and the service
  (`src/server/services/attribute.service.ts:352`) already write the joined labels into `valueText`.

---

### B2 — An idempotency key is claimed before validation, so one failed attempt blocks all retries

- Severity: high
- Location: `src/server/services/enquiry.service.ts:124` (claim), `:148-156` (replay path),
  `src/server/services/idempotency.service.ts:19` (`DEFAULT_TTL_SECONDS = 7 days`),
  `src/components/enquiry/EnquiryForm.tsx:269-270` (client keeps one key per mount)
- Status: VERIFIED
- What: `claimIdempotencyKey()` runs at line 124, _before_ `resolveEnquiryListings()` (line 159),
  duplicate detection and the write transaction; `attachIdempotencyResult()` only runs after commit
  (line 282). Any failure between those points leaves a permanent row with `enquiryId = NULL`. A retry
  with the same key and the same payload then takes the `replay` branch, `claim.enquiryId` is null so
  `existing` is null, and the service throws `409 "That enquiry was already submitted"`. A retry with a
  corrected payload (any hashed field — `listings`, `email`, `phoneNormalised`, `eventDate`,
  `requirements`) instead returns `409 mismatch`. The client never regenerates the key after a
  failure, so the user is wedged until a full page remount.
- Evidence:
  ```
  call1: ValidationError 400 - Some businesses could not be found
  call2: ConflictError 409 - That enquiry was already submitted
  idempotency row: { key: 'poc-key-...', enquiryId: null, expiresAt: '2026-10-21T18:35:20.961Z' }
  ```
  (probe called `createEnquiry` twice with `listings: ['this-listing-does-not-exist-xyz']` and the same
  `idempotencyKey`). The same window covers a process death or client abort after the claim but before
  `attachIdempotencyResult`.
- Impact: A customer who hits any server-side 400 (e.g. "Some businesses are no longer accepting
  enquiries" because a provider unpublished between page load and submit) is told on the next attempt
  that their enquiry "has already been submitted". They leave believing a lead was created when none
  exists — a silently lost lead on the platform's only conversion path. It also contradicts
  `docs/api-design.md §8` ("Replay returns the original result") and `docs/security.md:28`. The
  supplied test suite has no failure-then-retry case (`tests/integration/idempotency.test.ts:155-216`
  only covers a successful first call).
- Fix: claim after the payload has been validated and the listing set resolved, or make the replay
  branch treat `enquiryId === null` as "not yet completed" and re-execute (delete/expire the claim)
  rather than returning 409. A short `expiresAt` (e.g. 60 s) for unfinished claims is sufficient.

---

### B3 — Per-IP rate limiting trusts the first, client-controlled `X-Forwarded-For` entry

- Severity: high (SUSPECTED for exploitability; the mechanism is verified)
- Location: `src/app/api/enquiries/route.ts:14-21`, `src/app/api/admin/_lib/context.ts:19-26`,
  consumed at `src/server/services/enquiry.service.ts:85-92`
- Status: SUSPECTED
- What: `getClientIp()` takes `x-forwarded-for.split(',')[0]`. The rate-limit bucket key is
  `enquiry:ip:${hashIp(thatValue)}`. A caller that controls the leftmost hop gets a fresh bucket per
  request, so `RATE_LIMIT_ENQUIRY_PER_IP` (default 5 / 900 s) is bypassable; rotating the contact email
  as well also defeats `RATE_LIMIT_ENQUIRY_PER_EMAIL` (default 3 / 900 s), leaving no effective limit on
  lead spam. The same helper feeds the audited admin IP hash.
- Evidence: code path is unambiguous — two different first-hop values produce two different
  `enquiry:ip:*` keys, demonstrated by `consumeRateLimit` keying on `rule.key`
  (`src/server/services/rate-limit.service.ts:38-48`). What I could **not** verify without running a
  server (forbidden by the resource protocol) is whether the deployed proxy strips a client-supplied
  `x-forwarded-for`; on the common Vercel/Cloudflare-fronted Next.js setups it appends rather than
  replaces, which is what makes this exploitable.
- Impact: Defeats threat control T1 in `docs/security.md:20` ("bots submit thousands of fake leads")
  and pollutes `submittedIpHash`/`AuditLog.ipHash` with attacker-chosen values.
- Fix: derive the client IP from a header the edge guarantees (`cf-connecting-ip`, Vercel's
  `x-real-ip`) or from the rightmost hop after a configured trusted-proxy count, and ignore
  `x-forwarded-for` when no trusted proxy is configured.

---

### B4 — `IP_HASH_SALT` silently defaults to a public constant in production

- Severity: medium
- Location: `src/lib/env.ts:41`
- Status: VERIFIED
- What: `IP_HASH_SALT: z.string().default('dev-only-ip-salt')` has no `NODE_ENV` guard, so a production
  deploy that forgets the variable keeps a well-known salt. `BETTER_AUTH_SECRET` _is_ fail-closed, so
  the module's stated behaviour ("a missing or malformed variable fails loudly", `src/lib/env.ts:8-10`)
  holds for one secret and not the other.
- Evidence:
  ```
  NODE_ENV=production with IP_HASH_SALT unset
  => IP_HASH_SALT resolved to: "dev-only-ip-salt"   (no error)
  BETTER_AUTH_SECRET unset
  => throws: Invalid server environment configuration: - BETTER_AUTH_SECRET: expected string, received undefined
  ```
- Impact: `Enquiry.submittedIpHash` and `AuditLog.ipHash` are SHA-256 of `${knownSalt}:${ip}`. A leaked
  hash can be brute-forced over IPv4 (or trivially reversed for a candidate ISP block), so the
  "IP addresses are never stored" guarantee (`src/server/domain/contact.ts:37-40`,
  `docs/security.md:337`) does not hold. `docs/implementation-plan.md:304` (R9) already flags this;
  it is still unresolved in code.
- Fix: add a `superRefine` that rejects the literal default when `NODE_ENV === 'production'` (or drop
  the default entirely and require the variable).

---

### B5 — A tripped honeypot is stored as `Enquiry.status = DUPLICATE`, not `SPAM`

- Severity: medium
- Location: `src/server/domain/enquiry-status.ts:111-113` (`every(DUPLICATE|SPAM) => DUPLICATE`),
  used at `src/server/services/enquiry.service.ts:205` and `:228`
- Status: VERIFIED
- What: `createEnquiry` sets every `EnquiryListing.status = 'SPAM'` and then stores
  `status: deriveEnquiryStatus(listings.map(() => 'SPAM'))`. Because all children are SPAM, the
  duplicate branch wins and the overall status becomes `DUPLICATE` — the `SPAM` value is never written
  to `Enquiry.status`. `isPotentialDuplicate` is also left `false`.
- Evidence:
  ```
  response: { referenceCode: 'LE-U8RFPGWG', status: 'DUPLICATE', duplicate: false, ... }
  enquiry.findFirst(contactEmail).select(status, listings.status)
  => {"status":"DUPLICATE","isPotentialDuplicate":false,"listings":[{"status":"SPAM"}]}
  ```
  (probe called `createEnquiry` with `companyWebsite: 'http://spam.example'`.)
- Impact: Admin triage filtering `status=SPAM` will never find a honeypot submission — it appears in the
  `DUPLICATE` bucket and inflates the duplicate metric in `adminGetEnquiryMetrics` (`byStatus`).
  It contradicts three documents: `docs/system-design.md:387-388` ("stores the enquiry with status
  `SPAM`"), `docs/security.md:268` ("honeypot → `status = SPAM` on the enquiry and every lead") and the
  service comment at `src/server/services/enquiry.service.ts:103-104`. The unit test at
  `tests/unit/enquiry-status.test.ts:175` asserts the `DUPLICATE` result, so the divergence is
  "tested" but the documentation and the spam workflow are wrong.
- Fix: in `createEnquiry`, `status: isHoneypotTripped ? 'SPAM' : deriveEnquiryStatus(...)`; or make the
  all-SPAM case in `deriveEnquiryStatus` return `SPAM`.

---

### B6 — Customer cancellation is a TOCTOU: the status check is outside the guarded write

- Severity: medium
- Location: `src/server/services/enquiry.service.ts:642-660` (read at 642, `updateMany` at 657 with no
  status predicate); same pattern in `src/server/services/admin-enquiry.service.ts:313-362`
  (`assertTransition` at 340-342 reads, `update` at 352 writes by id)
- Status: SUSPECTED (not reproduced — needs a deterministic interleave)
- What: `cancelCustomerEnquiry` fetches `listings[].status`, computes `cancellable` and only then opens
  a transaction that does `enquiryListing.updateMany({ where: { id: { in: cancellableIds } }, data: {
status: 'CANCELLED' } })`. Nothing in the `where` clause constrains the current status and the
  transaction runs at the default isolation level. If an administrator moves the lead to
  `SHARED_WITH_PROVIDER` between the read and the write, the customer's cancellation still lands,
  leaving a provider holding a lead the platform now marks cancelled — exactly the outcome
  `canCustomerCancel` and the service comment (`:631-636`) say must not happen. `adminChangeLeadStatus`
  has the same shape: two concurrent transitions both validate against a stale status and both write.
- Evidence: code path above; the write predicate is `{ id: { in: [...] } }` only. A targeted race could
  not be produced without hooks into the service's private transaction.
- Impact: Withdrawn-lead/provider mismatch, and an escape from the "CANCELLED is final" invariant
  (`ALLOWED_TRANSITIONS.CANCELLED = []`). Low frequency, but it silently corrupts lead history.
- Fix: put the guard in the write — `updateMany({ where: { id: { in: ids }, status: { in:
CUSTOMER_CANCELLABLE_STATUSES } } })` and abort with `ConflictError` when `count === 0`; for the admin
  path use a conditional `updateMany` per current status or `SELECT ... FOR UPDATE`.

---

### B7 — `isFeatured` can only ever be set by the seed script

- Severity: medium
- Location: `prisma/seed.ts:603` (the only writer); `src/lib/validation/listing.ts:91-163` has no
  `isFeatured`; `src/server/services/listing.service.ts:510-671` never writes it
- Status: VERIFIED
- What: `isFeatured` drives the "Featured" ribbon (`src/components/listing/ListingCard.tsx:42`), the
  `featured=true` search filter (`src/server/domain/search-filters.ts:369-371`) and the first sort key
  of the default `recommended` ordering (`:528-532`). There is no API route, no schema field and no
  admin control that can change it. The admin listing filter even exposes an `isFeatured` control
  (`src/components/admin/ListingsFilters.tsx:67`) that can only ever filter seed data.
- Evidence: `grep -rn "isFeatured" src/ prisma/seed.ts` → writes only at `prisma/seed.ts:603`
  (`isFeatured: listing.isFeatured` from `LISTING_SEEDS`); `listingCreateSchema`/`listingUpdateSchema`
  (`src/lib/validation/listing.ts:91-163`) contain no `isFeatured`.
- Impact: Paired with the pricing/placement semantics implied by `recommended`, commercial placement is
  a seed-only invariant: an operator cannot feature a paying vendor or unfeature a stale one. This is
  the "invariant maintained only by a seed script" case.
- Fix: surface `isFeatured` through `listingUpdateSchema` + `adminUpdateListing` with an audit action
  (e.g. `listing.featured`), or drop the field and its UI.

---

### B8 — `searchText` is not refreshed when a referenced catalogue entity is renamed

- Severity: medium
- Location: `src/server/services/listing-search-text.ts:56-59`; callers are only
  `src/server/services/listing.service.ts:443,652` and `src/server/services/attribute.service.ts:373`
- Status: VERIFIED
- What: The haystack is a denormalised snapshot of `Category.name/path`, `Location.name/path`,
  `EventType.name`, service names and amenity labels. Renaming a category, location, event type or
  amenity through the admin catalogue routes does not touch any listing's `searchText`, and no listing
  write is triggered. The comment claims refreshing "on every write that changes anything searchable"
  (`listing-search-text.ts:15-17`), but catalogue renames are writes that change something searchable.
- Evidence: the three call sites above are the only `refreshListingSearchText` invocations in `src/`;
  the catalogue write routes (`src/app/api/admin/catalog/**`) call neither it nor any listing update.
- Impact: After a catalogue rename, text search (`q=`) keeps matching the old name and stops matching
  the new one until every affected listing is individually edited. Silent, hard-to-diagnose search
  wrongness for admins and customers.
- Fix: on a category/location/event-type/amenity rename (and on option-label change), enqueue a
  `refreshListingSearchText` for listings referencing it, or compute the haystack from joins in the
  query instead of persisting it.

---

### B9 — List pagination sorts on a non-unique key with no tie-break

- Severity: low
- Location: `src/server/services/enquiry.service.ts:560`, `src/server/services/admin-enquiry.service.ts:194`,
  `src/server/services/admin-enquiry.service.ts:710`, `src/server/services/audit.service.ts:74`
- Status: SUSPECTED (attempted reproduction failed)
- What: The search engine deliberately ends every `orderBy` with `{ id: 'asc' }` "so that pagination
  cannot repeat or skip rows between pages" (`src/server/domain/search-filters.ts:510-513`), but the
  enquiry/customer/audit lists sort only by `createdAt` (`TIMESTAMP(3)`, not unique). With offset
  pagination, equal timestamps have no defined order across separate `skip` queries.
- Evidence: the four call sites use `orderBy: { createdAt: 'desc' }` with no secondary key. I seeded 40
  enquiries sharing one `createdAt` and paged through them via `listCustomerEnquiries` (pageSize 8,
  pages 1-5): 40 collected, 40 unique, 0 duplicates; two identical page-2 reads matched. So the defect
  did not reproduce on this PostgreSQL plan, but the ordering guarantee is not present for a different
  plan or under concurrent writes.
- Impact: A user or admin paging a busy inbox can see a row twice or miss one. Cosmetic-to-annoying;
  not a data-loss risk.
- Fix: append `{ id: 'asc' }` to those four `orderBy` clauses.

---

### B10 — `verifyUploadedObject`'s content-type check is tautological on R2

- Severity: low
- Location: `src/lib/storage/validation.ts:168-196`, `src/lib/storage/r2-driver.ts:49,75`,
  `src/server/services/media.service.ts:121-151`
- Status: SUSPECTED (R2 path could not be exercised — no credentials)
- What: The completion step is documented as reading the object back and comparing "its _actual_
  content type and byte length ... with what was declared". On the R2 driver, `head()` returns
  `HeadObject.ContentType`/`ContentLength`, which are the metadata set by the presigned `PutObject`
  whose `ContentType` and `ContentLength` are both part of the signature
  (`r2-driver.ts:46-53`). A client cannot make them differ, so the comparison always passes; the only
  genuine check is that the object exists. There is no magic-byte sniffing anywhere.
- Evidence: code reading only; the R2 driver requires credentials this environment does not have. The
  local-driver path (`local-driver.ts:47-67`, metadata written from the request `Content-Type` at
  `dev-media-upload/route.ts:34-45`) is the only path where the comparison can actually fail.
- Impact: An administrator (the only role that can upload) can store arbitrary bytes under an
  `image/*` content type. Bounded because uploads are admin-only, but the documented control is
  stronger than the implemented one.
- Fix: sniff the leading bytes (`file-type`/`sharp`) before marking `READY`, or reword the comment and
  docs to state that only object presence and signed metadata are verified.

---

### B11 — `PublicListingOptions.allowUnpublished` and `leadStatus` are dead options

- Severity: low
- Location: `src/server/services/listing.service.ts:28-31`, used at `:116` and `:133`
- Status: VERIFIED
- What: Both options are documented as real capabilities ("Administrators may preview an unpublished
  listing", "Controls whether private contact channels are disclosed") but no caller anywhere passes
  either `grep -rn "allowUnpublished|leadStatus" src/` → only the declarations and the two reads).
  Consequently the public vendor profile always withholds private contact channels, even for a customer
  whose `EnquiryListing` is `SHARED_WITH_PROVIDER` or `CONVERTED` — the post-share disclosure documented
  in `src/server/domain/contact.ts:98-104` is implemented only in the account enquiry projection.
- Evidence: grep output above; `src/app/api/listings/[slug]/route.ts:14` and the vendor page call
  `getPublicListingBySlug(slug)` with no options.
- Impact: No security hole (the failure mode is "withhold more"), but two documented behaviours do not
  exist, and the service API implies an admin-preview path that is not wired.
- Fix: either pass the session's admin flag / the viewer's lead status from the callers, or delete the
  options and the claims.

---

### B12 — Inactive categories are publicly enumerable

- Severity: low
- Location: `src/app/api/categories/route.ts:35-37`, `src/lib/validation/catalog.ts:135-140`
- Status: VERIFIED
- What: `GET /api/categories?includeInactive=true` returns disabled categories (names, slugs, paths
  and the tree payload) to an anonymous caller. The code comment explicitly accepts this.
  `GET /api/locations?activeOnly=false` does the same for inactive locations, so the exposure is
  consistent across both public catalogue routes rather than a one-off.
- Evidence: `listCategories({ includeInactive: true })` → `where: {}` (`catalog.service.ts:171`), and
  the route returns both the flattened list and the full tree.
- Impact: Minor information disclosure: unreleased or retired taxonomy is visible before launch. Search
  itself still 404s on an inactive category slug (`catalog.service.ts:243`), so nothing unpublished
  leaks through listings.
- Fix: ignore `includeInactive` for anonymous callers, or drop the parameter from the public route.

---

### B13 — Dashboard "Unassigned new leads" and the inbox "Unassigned" filter count different things

- Severity: nit
- Location: `src/server/services/admin-enquiry.service.ts:647` (tile: `enquiryListing` with
  `assignedAdminId: null`) vs `:158-162` (filter: `Enquiry.assignedAdminId`)
- Status: VERIFIED
- What: The tile counts per-lead assignment, the inbox filter counts the enquiry-level owner. Assigning
  a whole enquiry with `scope: 'enquiry'` (`:462-466`) never sets `EnquiryListing.assignedAdminId`, so
  the tile stays at its old value while the filter matches nothing. The UI labels the tile
  "Unassigned new leads / Per-provider leads awaiting triage" (`src/app/admin/page.tsx:98-103`).
- Evidence: the two `where` clauses above, and `adminAssignLead`'s enquiry-scope branch which updates
  only `tx.enquiry.update`.
- Impact: Operators see a permanently "warning"-tone tile that assignment cannot clear, and two UIs
  share the word "Unassigned" with different meanings.
- Fix: align the tile with the filter (count `Enquiry` with `assignedAdminId: null AND status: 'NEW'`)
  or relabel it "Unassigned provider leads" and make the filter lead-scoped.

---

## Coverage gaps (business rules with no test that would catch these)

- **Multi-select display**: no test imports `formatAttributeValue`/`formatAttributeValueCompact`
  (`tests/unit/` has no `attribute-display` suite). B1 passes all 384 unit and 114 integration tests.
- **Failed submission then retry**: `tests/integration/idempotency.test.ts:155-216` covers only
  success→replay and success→different-payload; nothing claims a key and then fails.
- **Honeypot final state**: `tests/unit/enquiry-status.test.ts:175` asserts `SPAM → DUPLICATE`, so the
  documented `Enquiry.status = SPAM` behaviour is not just untested, it is contradicted by a test.
- **`IP_HASH_SALT` production policy**: no test asserts the env module rejects the default.
- **Client-IP derivation**: no test for `getClientIp`/`X-Forwarded-For` handling on either route.
- **`isFeatured` mutation**: no test (there is no code path to test).
- **Cancellation / status-transition races**: no concurrency test for `cancelCustomerEnquiry` or
  `adminChangeLeadStatus`.
- **Pagination stability under equal timestamps**: no test; `tests/unit/pagination.test.ts` only tests
  the pure helpers.
- **`searchText` freshness after catalogue renames**: no test.
- **Semantic duplicate/flag windows**: `docs/testing-strategy.md:216` admits the 15-minute and 24-hour
  windows have no direct suite; I confirmed `findRecentDuplicate`/`hasRecentContactEnquiry`
  (`enquiry.service.ts:351-405`) are only exercised indirectly via one API happy path.
- **Media content verification**: `tests/unit/storage.test.ts` exercises `verifyUploadedObject` with
  synthetic metadata, so it never observes that R2 supplies the same value it compares against.

## What I could not verify

- Whether the deployment proxy preserves a client-supplied `x-forwarded-for` (B3) — I may not run
  `next dev`/`next build`, so the proxy behaviour is inferred, not observed.
- The R2 upload path (B10): no R2 credentials in this environment, and `getStorageDriver()` selects the
  local driver.
- The B6 and B9 races: I could not inject a deterministic interleave, and the 40-row equal-timestamp
  pagination probe did not reproduce a repeat.
- Whether `DERIVE`-based duplicate detection loses a genuine second event within the 15-minute window
  (`findRecentDuplicate` ignores `eventDate`/`guestCount`/`budget`): the code is clear, but I did not
  decide whether that is a defect or intended product behaviour, so it is not listed as a finding.
- Better Auth's in-process rate-limit storage under multi-instance scale-out (auth limits are the only
  limiter not in PostgreSQL); I could not run multiple instances.

## Top 5 by risk

1. **B1** — multi-select values render as CUIDs on the main browse and profile surfaces (blocker).
2. **B2** — a failed enquiry submission permanently blocks retry with the same idempotency key and
   reports a false success ("already submitted"), losing leads.
3. **B3** — the per-IP enquiry rate limit is keyed on a client-controllable header, so the platform's
   primary anti-spam control can be bypassed.
4. **B4** — `IP_HASH_SALT` silently defaults in production, making stored IP hashes reversible.
5. **B5** — honeypot spam lands in the `DUPLICATE` bucket, so spam triage never sees it and the metrics
   lie.
