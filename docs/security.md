# Security — Live Envt

Status: **Accepted** · Last updated: 2026-10-14 · Owner: Backend lead
Scope: the controls that exist in code today, plus the gaps a production launch would still have to close.
Companion documents: [system-design](./system-design.md), [database-design](./database-design.md).

> Snapshot note (2026-10-14): the domain, service, validation, auth, storage **and HTTP route**
> layers are now implemented — 48 of the 50 `route.ts` files under `src/app/api` are wrapped in
> `apiHandler()`, including public search/listing/enquiry routes and the admin surface. The two
> exceptions are the Better Auth catch-all (`src/app/api/auth/[...all]/route.ts`, owned by Better
> Auth) and `src/app/api/dev-media-upload/route.ts` (development-only). Admin handlers resolve
> identity through `getAdminActorContext()` in `src/app/api/admin/_lib/context.ts`, which calls
> `requireAdmin(request.headers)` itself, so routing is never the only check. Controls that live inside
> services are therefore reachable; anything still missing is called out below rather than implied.

## 1. Threat model

Realistic threats for a wedding-vendor lead-generation platform, and the concrete control for each.

| #   | Threat                                                                                                                                | Control that exists                                                                                                                                                                                                                                                                                                                                                                           | Implemented in                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **Enquiry spam / form flooding.** Bots submit thousands of fake leads, destroying the value of the admin inbox.                       | Database-backed fixed-window rate limiting per IP-hash **and** per contact email before any work is done; a honeypot field; a hard cap of 10 listings per enquiry; semantic duplicate detection (15-minute window) that returns the existing enquiry instead of creating another.                                                                                                             | `src/server/services/rate-limit.service.ts`, `src/server/services/enquiry.service.ts`, `src/lib/validation/enquiry.ts` (`MAX_LISTINGS_PER_ENQUIRY = 10`, duplicate window). |
| T2  | **Contact-detail harvesting.** A scraper collects provider phone numbers/emails without ever making a real enquiry.                   | Two-gate disclosure: a channel is public only if the admin set its `show*` flag **and** (for private channels) the viewer's lead has reached `SHARED_WITH_PROVIDER`/`CONVERTED`. The pure function is the only place this decision is made.                                                                                                                                                   | `deriveContactDisclosure()` in `src/server/domain/contact.ts`; consumed by `src/server/services/listing.service.ts` and `src/server/services/enquiry.service.ts`.           |
| T3  | **Enumeration of other customers' enquiries.** An attacker guesses a reference code or iterates ids to read someone else's brief.     | Customer reads apply ownership **in the `where` clause** (`customerUserId = actor.id`), so another customer's rows are never loaded; a miss returns 404. Guest tracking requires reference code **and** contact email and is rate limited. Reference codes are 8 random characters from a 32-symbol alphabet via `crypto.randomBytes`.                                                        | `src/server/services/enquiry.service.ts` (`listCustomerEnquiries`, `getCustomerEnquiry`, `trackEnquiry`), `generateReferenceCode()` in `src/server/domain/contact.ts`.      |
| T4  | **Privilege escalation to admin.** A customer tries to set `role: "ADMIN"`, passes an `assignedAdminId`, or self-promotes at sign-up. | `role` and `status` are declared with `input: false` on the Better Auth user config, so the HTTP API never accepts them; identity is resolved only in `getActorFromHeaders()`; admin checks run inside the service (`requireAdmin()`), not only in routing; assignments are validated to be an `ADMIN` with `ACTIVE` status.                                                                  | `src/lib/auth/server.ts` (`input: false`), `src/lib/auth/actor.ts`, `src/server/services/admin-enquiry.service.ts` (`adminAssignLead`).                                     |
| T5  | **IDOR on listings / media / enquiries.** Direct-object access by guessing an id or slug.                                             | Public listing reads refuse anything not `PUBLISHED` and non-archived even when the slug is guessed; admin media mutations scope every lookup by `{ id, listingId }`; enquiry reads scope by owner; `mediaReorderSchema` items are verified to belong to the listing before any update.                                                                                                       | `src/server/services/listing.service.ts` (`getPublicListingBySlug`), `src/server/services/media.service.ts`, `src/server/services/enquiry.service.ts`.                      |
| T6  | **Upload abuse.** A client declares `image/png` and uploads an executable, an oversized file, or a path-traversal key.                | Allow-list of four image MIME types; size cap enforced at presign **and** re-verified after upload; extension is derived from the validated content type, never from the filename; the completion step `HEAD`s the object and compares real content type and byte length; the local driver rejects absolute/`..`/backslash keys and re-checks the resolved path stays under the storage root. | `src/lib/storage/validation.ts`, `src/server/services/media.service.ts`, `src/lib/storage/local-driver.ts` (`assertSafeKey`).                                               |
| T7  | **Credential stuffing / brute force on auth.**                                                                                        | Better Auth's built-in rate limiter is enabled (60-second window, max 30); password length 8–128; hashes are produced and compared by Better Auth (scrypt), never hand-rolled. `RATE_LIMIT_AUTH_PER_IP` (default 20) is wired into that limiter for the global rule and the `/sign-in/email` and `/sign-up/email` paths.                                                                      | `src/lib/auth/server.ts` (`rateLimit`, `emailAndPassword`), `src/lib/env.ts`.                                                                                               |
| T8  | **Scraping the listing catalogue.** Bulk download of every listing and its contact details.                                           | The public search contract caps `pageSize` at 48 and requires a category for category-specific filters; private contact channels are withheld by T2; there is no bulk export endpoint. Rate limiting on catalogue reads is **not** implemented (accepted risk, §13).                                                                                                                          | `src/lib/pagination.ts` (`maxPageSize: 48`), `src/server/domain/search-filters.ts`.                                                                                         |
| T9  | **Duplicate/replayed submission.** A client retry or an at-least-once queue creates two leads.                                        | `Idempotency-Key` (derived by the browser from the payload) is inspected before validation and claimed by a single `INSERT` against the `(scope, key)` unique constraint only after the intent is valid; same key + same body replays the original; same key + different body returns 409; a claim with no enquiry behind it is released and retaken.                                         | `src/server/services/idempotency.service.ts`, `claimIdempotencyKey`, `src/server/services/enquiry.service.ts`.                                                              |

## 2. Authentication

**Better Auth 1.7 with the Prisma adapter and database-backed sessions.**

- **Session storage:** rows in `sessions`, not JWTs. Chosen (ADR-3) because moderation must take
  effect immediately: suspending a customer or changing a role applies on the next request. The cost
  is one indexed read per authenticated request.
- **Cookie flags:** `httpOnly: true` and `sameSite: 'lax'` are set explicitly;
  `useSecureCookies: process.env.NODE_ENV === 'production'` turns on `Secure` under HTTPS. Configured
  in `src/lib/auth/server.ts` `advanced.defaultCookieAttributes`.
- **Lifetime:** `expiresIn: 60 * 60 * 24 * 30` (30 days), `updateAge: 60 * 60 * 24` (rolling refresh
  once a day), `freshAge: 60 * 60` (one hour) — all in `src/lib/auth/server.ts`.
- **Password hashing:** delegated entirely to Better Auth's scrypt implementation; the seed writes
  credential rows with `hashPassword` from `better-auth/crypto` so seeded logins behave identically
  (`prisma/seed.ts`).
- **Rate limiting:** `enabled: true, window: 60, max: 30` on the Better Auth instance.
- **Trusted origins:** `trustedOrigins: [getAppUrl()]`, so the auth API only accepts the configured
  app origin.
- **Revocation:** because the session is a row, `getActorFromHeaders()` is the choke point — a
  non-`ACTIVE` account is treated as anonymous even though its session row still exists
  (`src/lib/auth/actor.ts`). The admin status service deliberately does **not** delete sessions; it
  relies on this check, which is simpler and cannot miss a row (`adminUpdateCustomerStatus`,
  `src/server/services/admin-enquiry.service.ts`).

**Email verification is not implemented.** `User.emailVerified` exists and defaults to `false`, and
the `Verification` table exists for the tokens Better Auth would use, but no verification email is
sent and `emailAndPassword.requireEmailVerification` is not enabled. Consequences, stated plainly:

- an attacker can register with an email address they do not control;
- therefore a later sign-up must **never** be able to claim an existing guest enquiry by email
  (§6), and email-based password reset is not safe to enable until verification exists;
- content that assumes a verified owner (for example, showing account contact details to other
  users) is not built.

## 3. Authorization

### 3.1 Actor matrix

| Actor                  | How identified                                                 | May do                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor      | no session                                                     | read published listings, categories, filters, locations, facets; submit an enquiry with contact details; track an enquiry with reference code **and** email                                                            |
| Authenticated customer | Better Auth session cookie + `sessions` row, `status = ACTIVE` | all of the above, plus read/update own profile (name, phone, city, contact method, marketing consent), list own enquiries, read own enquiry detail and customer-visible activity, cancel own enquiry while cancellable |
| Administrator          | session with `User.role = ADMIN` and `User.status = ACTIVE`    | every admin mutation: listing CRUD/publication/verification/attributes/media, catalogue administration, enquiry assignment/status/notes/moderation/metrics, audit log, customer suspension                             |

### 3.2 Every protected service operation and its guard

| Operation                                                                                                                                           | Guard                                                                                                                       | Where                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `getActorFromHeaders()`                                                                                                                             | the **only** identity entry point; reads the session header, coerces role/status, returns anonymous for non-active accounts | `src/lib/auth/actor.ts`                                                   |
| `requireActor()`                                                                                                                                    | throws `UnauthenticatedError` (401) for anonymous                                                                           | `src/lib/auth/actor.ts`                                                   |
| `requireAdmin()`                                                                                                                                    | throws `UnauthenticatedError` then `ForbiddenError` (403) when role ≠ `ADMIN`                                               | `src/lib/auth/actor.ts`                                                   |
| `listCustomerEnquiries`                                                                                                                             | ownership in `where: { customerUserId }`                                                                                    | `src/server/services/enquiry.service.ts`                                  |
| `getCustomerEnquiry`                                                                                                                                | `findFirst({ where: { referenceCode, customerUserId } })` → 404 on miss                                                     | `src/server/services/enquiry.service.ts`                                  |
| `cancelCustomerEnquiry`                                                                                                                             | ownership in `where`, plus `canCustomerCancel(status)`                                                                      | `src/server/services/enquiry.service.ts`                                  |
| `trackEnquiry`                                                                                                                                      | reference code **and** normalised email, plus 10-per-15-minute rate limit                                                   | `src/server/services/enquiry.service.ts`                                  |
| `updateCustomerProfile`                                                                                                                             | caller passes the session `userId`; schema excludes `email`, `role`, `status`                                               | `src/server/services/account.service.ts`, `src/lib/validation/account.ts` |
| `adminCreate/UpdateListing`, `adminSetPublicationStatus`, `adminSetVerificationStatus`, `adminListListings`, `adminGetListing`                      | `requireAdmin()` at the route boundary; services assume an authorised actor                                                 | `src/server/services/listing.service.ts`                                  |
| `adminSetListingAttributeValues`                                                                                                                    | `requireAdmin()`; values validated against the listing's own category bindings                                              | `src/server/services/attribute.service.ts`                                |
| `requestMediaUpload`, `completeMediaUpload`, `deleteListingMedia`, `reorderListingMedia`                                                            | `requireAdmin()`; every lookup scoped `{ id, listingId }`                                                                   | `src/server/services/media.service.ts`                                    |
| `adminListEnquiries`, `adminGetEnquiry`, `adminChangeLeadStatus`, `adminAssignLead`, `adminAddNote`, `adminFlagDuplicate`, `adminGetEnquiryMetrics` | `requireAdmin()`; assignment target validated `role=ADMIN,status=ACTIVE`                                                    | `src/server/services/admin-enquiry.service.ts`                            |
| `adminListCustomers`, `adminUpdateCustomerStatus`                                                                                                   | `requireAdmin()`; self-suspension rejected; admin accounts cannot be suspended here                                         | `src/server/services/admin-enquiry.service.ts`                            |
| `listAuditLogs`                                                                                                                                     | `requireAdmin()`                                                                                                            | `src/server/services/audit.service.ts`                                    |

**Identity is never read from the request.** `getActorFromHeaders(requestHeaders)` is the only place
a user id or role enters the system; nothing downstream accepts a client-supplied `role`, `userId`,
`assignedAdminId` or `customerUserId`. Assignment changes take the target id from the _body_ but
validate it against the database (`tx.user.findFirst({ where: { id, role: 'ADMIN', status: 'ACTIVE' } })`),
which is a reference, not an identity claim.

**How `input: false` stops self-promotion.** In `src/lib/auth/server.ts` the `role` and `status`
additional fields are declared with `input: false`. Better Auth then refuses to read those keys from
any client request body, so a sign-up payload containing `{"role":"ADMIN"}` is ignored and the
database default (`CUSTOMER` / `ACTIVE`) applies. This is the mechanism — not a UI convention, and not
a post-hoc check. The service layer further never writes those columns except through
`adminUpdateCustomerStatus`, which itself refuses to touch an `ADMIN` account's status.

### 3.3 Route-layer enforcement

The route surface now exists (`src/app/api/**`). The rule is uniform: every handler is wrapped in
`apiHandler()`, resolves the actor from the session headers, and then calls a service that performs
the ownership or role check itself. Admin routes go through `getAdminActorContext()`
(`src/app/api/admin/_lib/context.ts`); customer routes through `requireActor()` and the services in
§3.2. Authorisation is therefore enforced twice — at the route, and again inside the service — so
calling a service directly in a Server Component or a test cannot bypass it. `tests/api/admin.test.ts`
asserts the shape (401 anonymous, 403 customer, 200 admin) and `tests/api/enquiries.test.ts` asserts
the cross-customer 404.

## 4. Customer data isolation

- **Ownership is applied in the `where` clause, never post-filtered.**
  `listCustomerEnquiries` builds `where = { customerUserId }` and passes it to both the page query and
  the count; `getCustomerEnquiry` uses `findFirst({ where: { referenceCode, customerUserId } })`.
  Another customer's rows are never loaded into memory, so there is no path where a missing filter
  leaks them.
- **Cross-customer lookup returns 404, not 403.** A `ForbiddenError` would confirm that the reference
  code exists and belongs to someone else, which is an enumeration oracle. `getCustomerEnquiry`
  throws `NotFoundError('Enquiry')` for both "no such code" and "not yours"
  (`src/server/services/enquiry.service.ts`). `trackEnquiry` goes further and uses a bespoke
  not-found message so the endpoint cannot be used to confirm a code.
- **The DTO layer prevents private fields being serialised.** Route handlers and Server Components
  return DTOs from `src/server/dto/*.ts`, never raw Prisma rows. `toCustomerSummary` /
  `toCustomerListingView` in `src/server/services/enquiry.service.ts` select only customer-safe
  columns and map `EnquiryActivity` rows with `isCustomerVisible: true`. `EnquiryNote`,
  `assignedAdminId`, `isPotentialDuplicate`, `submittedIpHash` and internal status vocabulary are
  simply absent from the customer DTOs. The customer-facing status labels live in
  `CUSTOMER_STATUS_LABELS` (`src/server/domain/enquiry-status.ts`) because internal operational
  wording ("qualified", "shared with provider") must not reach a customer verbatim.
- **Admin enquiry projections mask by default.** `AdminEnquiryListRow` carries `contactEmailMasked`
  and `contactPhoneMasked`; the full contact values appear only on `AdminEnquiryDetail`, which is
  reachable only through `requireAdmin()`. `maskEmail` lives in `src/lib/format.ts` and is applied by
  `admin-enquiry.service.ts`. **This is not a blanket rule across the admin panel:** the customers
  list (`adminListCustomers` → `AdminCustomerRow` → `CustomerNameCell`) selects `User.email` and
  renders it unmasked as the row's secondary line, because it lists the customer base rather than an
  enquiry's contact channel. No masking is claimed for that projection.

## 5. Provider contact disclosure

Two independent gates, both required:

1. the per-channel publication flag the administrator set on the listing (`showPhone`, `showEmail`,
   `showWhatsapp`, `showWebsite`); and
2. the lead stage — a channel that is **not** published publicly is disclosed only once the customer's
   lead has reached `SHARED_WITH_PROVIDER` or `CONVERTED`.

The decision is a single pure function, `deriveContactDisclosure(listing, leadStatus)` in
`src/server/domain/contact.ts`. `isProviderShared()` in `src/server/domain/enquiry-status.ts` owns
the "shared" set (`SHARED_WITH_PROVIDER`, `CONVERTED`), so adding a status cannot quietly change
disclosure semantics in two places.

Why this matters beyond privacy:

- **Lead attribution.** A published price and a withheld phone number is the product's conversion
  mechanism. Rendering the number as page text — or as a `tel:` click-to-call — would let a visitor
  bypass the enquiry form entirely, so the phone number is deliberately _absent from the response_
  until the second gate opens, not merely hidden with CSS. The `hasWithheldChannels` flag and a
  `message` string are what the UI shows instead (`ListingContactView` in
  `src/server/dto/listing.dto.ts`).
- **Admin preview.** `adminSetPublicationStatus` and the admin listing read operate on the stored raw
  contact columns, which is correct: the administrator owns the data.

**Coverage:** the disclosure rule is covered by `tests/unit/contact-disclosure.test.ts`; the public
listing route exists (`GET /api/listings/[slug]`) and `src/app/vendors/[slug]/page.tsx` renders
`<ListingContactCard />` from the `ListingContactView` DTO. What is still unverified is the browser
guarantee: no automated test asserts that a withheld number never reaches the client as page text
(`tests/e2e/listing-profile.spec.ts` asserts only that a withheld phone is absent from one rendered
state). A UI that rendered `contact.phone` as a `tel:` link would be a regression; the DTO is designed
so there is nothing to render until disclosure opens.

## 6. Guest enquiries and why they are not auto-claimed

Guest submission is deliberate: forcing account creation before a first enquiry is the single biggest
lead leak in this product category (ADR-5). A guest supplies name, email, phone and explicit consent;
`Enquiry.customerUserId` is `NULL`.

**Guests are never auto-claimed by a later sign-up.** The account-takeover reasoning is concrete: if
registering with `victim@example.com` attached that email's previous guest enquiries to the new
account, anyone could read a stranger's event brief, budget and contact history simply by signing up
with their address. Email verification — the only thing that would make claiming safe — is not
implemented. `Enquiry.customerUserId` is therefore written only from the authenticated session at
submission time, and there is no code path that back-fills it.

Guest tracking is protected by requiring **both** factors:

- the reference code (`LE-` + 8 characters from a 32-symbol alphabet, `generateReferenceCode`), and
- the contact email, normalised with `normaliseEmail`.

`trackEnquiry` rate limits attempts (`limit: 10, windowSeconds: 900`, keyed on the salted hash of the
email), and returns the same 404 shape for a wrong code and a wrong email, so it cannot be used to
confirm that a reference code exists. The tracked view (`TrackedEnquiryView`) is intentionally
narrower than the account view: progress wording and listing names only — never internal notes,
assignees, budgets or provider contact details.

## 7. Upload security

Flow, and why each step exists:

1. **`requestMediaUpload`** — a signed-in administrator asks for upload permission for one listing.
   `validateUploadRequest` checks the declared content type against the allow-list and the byte count
   against `MEDIA_MAX_UPLOAD_BYTES`, then a `PENDING` `ListingMedia` row is created so the object key
   is deterministic before any bytes exist.
2. **The browser PUTs the file straight to storage.** The bytes never pass through the Next.js server
   — this avoids Vercel request-body limits and keeps large uploads out of the function's memory.
   The presigned URL is valid for **300 seconds** (`PRESIGN_TTL_SECONDS` in
   `src/server/services/media.service.ts`; the R2 driver clamps any requested TTL to 3 600 s).
3. **`completeMediaUpload` re-verifies.** The server `HEAD`s the object and calls
   `verifyUploadedObject`, comparing the **actual** content type and **actual** byte length with what
   was declared. Only then does the row become `READY`.

Specific controls:

- **MIME allow-list:** `image/jpeg`, `image/png`, `image/webp`, `image/avif`
  (`ALLOWED_IMAGE_MIME_TYPES`); anything else is a 415 with the allowed list in `details`. The same
  function runs at presign and completion, so the two cannot drift.
- **Size cap at presign and after upload:** `validateUploadRequest` rejects non-positive, non-integer
  or oversized values; `verifyUploadedObject` rejects a stored length that differs from the declared
  one. For R2 the length is also baked into the signature (`ContentLength`), so storage itself refuses
  a mismatched body and the server check is a backstop.
- **The extension is never trusted:** `buildListingMediaKey` derives it from `EXTENSION_BY_MIME_TYPE`,
  so a file named `evil.php` declared as `image/png` lands as `.png` — asserted in
  `tests/unit/storage.test.ts`.
- **Path-traversal protection (local driver):** `assertSafeKey` rejects empty keys, `..` segments,
  absolute paths, a leading `/` and backslashes, then re-checks the resolved path is inside the root.
- **Object keys:** `listings/{listingId}/{mediaId}/{slug}-{sha8}.{ext}`, hashed over listing, media,
  content type and size, so keys are collision-resistant and a changed upload gets a new key.
- **Alt text:** whitespace-collapsed, capped at 200 characters and never blank (`sanitizeAltText`),
  because it is stored and rendered into `<img alt>`.
- **Cleanup:** deleting a media row also deletes the object; a failure is logged and the row stays
  deleted, because an orphaned object is recoverable while a broken image on a live listing is not.
  Stale `PENDING` rows older than an hour are reaped opportunistically.

**Honest gaps in this area:**

- `requestMediaUpload` and `completeMediaUpload` accept a `listingId` and check the listing exists; the
  admin authorisation comes from the route (`src/app/api/admin/listings/[id]/media/**`), which calls
  `getAdminActorContext()`. Service-level tests that bypass the route would have no admin check, which
  is why the route is the only supported entry point.
- **There is no public/private bucket separation.** `R2_PUBLIC_BASE_URL` points at the CDN/bucket
  domain, and an object's public URL is computable once its key is known. `PENDING` objects are
  therefore technically fetchable by anyone who can guess the randomised key (a `crypto.randomUUID`
  plus an 8-hex hash makes guessing impractical, but this is obscurity, not access control). The
  practical separation today is that only `status = READY` rows are ever referenced by a public
  listing. A production hardening step would be a private uploads prefix plus an explicit
  publish/copy step or a signed-URL read path.
- The `dev-media-upload` route referenced by the local driver now exists
  (`src/app/api/dev-media-upload/route.ts`). It returns 404 when `NODE_ENV === 'production'`, requires
  a key, rejects an empty body, and relies on `writeLocalObject` → `assertSafeKey` to reject traversal.
  It does **not** re-check the MIME allow-list itself; it relies on the declared type being the one the
  presign step signed, and the completion step still re-verifies what was stored. That is acceptable
  for a non-production-only route but should be revisited if it is ever reachable in a deployed
  environment.

## 8. Abuse controls

| Control                                  | Default / value                                                                                               | Implemented in                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Client IP source                         | `TRUSTED_PROXY_HOPS` = 1: the `x-forwarded-for` entry counted from the end, not the client-chosen first entry | `src/lib/client-ip.ts`, `src/lib/env.ts`                      |
| Enquiry rate limit per IP hash           | `RATE_LIMIT_ENQUIRY_PER_IP` = 5 per window                                                                    | `src/lib/env.ts`, `src/server/services/enquiry.service.ts`    |
| Enquiry rate limit per contact email     | `RATE_LIMIT_ENQUIRY_PER_EMAIL` = 3 per window                                                                 | same                                                          |
| Rate-limit window                        | `RATE_LIMIT_WINDOW_SECONDS` = 900 s (15 min)                                                                  | `src/lib/env.ts`                                              |
| Guest tracking                           | 10 attempts / 900 s, keyed on the salted email hash                                                           | `src/server/services/enquiry.service.ts` (`trackEnquiry`)     |
| Auth endpoints                           | Better Auth limiter: window 60 s, max 30                                                                      | `src/lib/auth/server.ts`                                      |
| Honeypot                                 | `companyWebsite` hidden field                                                                                 | `src/lib/validation/enquiry.ts`                               |
| Listing cap per enquiry                  | 10                                                                                                            | `createEnquirySchema`, `MAX_LISTINGS_PER_ENQUIRY`             |
| Duplicate window (returns existing lead) | 15 minutes, same contact **and** same listing set                                                             | `DUPLICATE_WINDOW_MINUTES`                                    |
| Duplicate flag window (admin review)     | 24 hours, same contact, any listing                                                                           | `FLAG_WINDOW_HOURS`                                           |
| Spam triage                              | honeypot → `status = SPAM` on the enquiry and every lead                                                      | `createEnquiry`                                               |
| Idempotency TTL                          | 7 days (`DEFAULT_TTL_SECONDS`)                                                                                | `src/server/services/idempotency.service.ts`                  |
| Cleanup                                  | expired buckets/keys pruned opportunistically (5% sampling)                                                   | `pruneExpiredRateLimitBuckets`, `pruneExpiredIdempotencyKeys` |

**How the client IP is derived.** `getClientIp(headers)` in `src/lib/client-ip.ts` is the single
implementation used by the enquiry route (`src/app/api/enquiries/route.ts`) and the admin actor
context (`src/app/api/admin/_lib/context.ts`). `x-forwarded-for` is a chain: a client can prepend its
own value, and each proxy appends the address it observed. Taking the **first** entry would take the
value the client chose, so a caller could rotate the header and get a fresh rate-limit bucket on every
request. The implementation therefore counts from the end: it takes entry
`chain.length - 1 - TRUSTED_PROXY_HOPS`, where `TRUSTED_PROXY_HOPS` (integer 0–10, default 1) is how
many proxies in front of the application the operator controls. `x-real-ip` is used only when the hop
count is 0, because it is a single client-controlled value otherwise. When no header is present the
function returns `null` and the caller buckets under an `unknown` key rather than sharing a real IP's
bucket. Setting `TRUSTED_PROXY_HOPS` too low trusts a client-supplied entry; too high takes an entry
the platform's own proxy appended. The value is validated in `src/lib/env.ts` and documented in
`.env.example`.

**Why the unique constraint is the idempotency mechanism.** `claimIdempotencyKey` performs a single
`prisma.idempotencyKey.create`. If two concurrent retries arrive, exactly one wins the
`(scope, key)` unique constraint and the loser receives P2002, then reads the existing row to decide
`replay` (same `requestHash`) vs `mismatch` (different payload → 409). A `SELECT`-then-`INSERT` would
let both callers observe "no row" and both create a lead — the check and the write would not be
atomic. Because the key is only claimed after the submit intent is valid, a claim row with no
`enquiryId` means a previous attempt failed part-way; `claimOrRecoverKey` releases that row and
retakes it rather than answering "already submitted" for a lead that was never created. The same
reasoning applies to rate limiting: `consumeRateLimit` uses one atomic `upsert` on
`(key, windowStart)` and retries the update path if two first-requests race the insert, rather than
weakening the limit.

**Why these tables are in PostgreSQL, not memory:** serverless instances do not share memory, so an
in-process counter silently allows the full limit _per instance_ — exactly during a burst, when the
limiter matters most (ADR-10).

**Duplicate handling is intentionally two-tier.** Inside the 15-minute window, a byte-identical
intent returns the original lead (`duplicate: true`) rather than creating a second one; outside it,
the enquiry is created but `isPotentialDuplicate` is set and an internal
`EnquiryActivity(type: DUPLICATE_FLAGGED)` row is written, so an administrator can decide. The flagged
activity is `isCustomerVisible: false`.

**Honeypot (fixed).** `createEnquirySchema.companyWebsite` is `z.string().max(200).optional()` in
`src/lib/validation/enquiry.ts`, so a filled hidden field is accepted by the schema and reaches
`createEnquiry`. The service then checks `input.companyWebsite.length > 0` and, if true, stores the
enquiry and every lead as `SPAM` while returning a normal-looking response. The SPAM path is therefore
reachable through the API. (An earlier revision of this document described the field as `max(0)` and
the path as unreachable; that is no longer the code.) Not implemented either: **minimum dwell time**
and the **link/markup scan of free-text requirements** described in `docs/system-design.md` §7.3.

## 9. Input validation and error handling

- **Zod 4 at the boundaries only.** Request bodies, query strings, route params, admin payloads and
  environment configuration are validated once, at the edge. Internal functions receive typed values
  and trust them; there is no duplicate validation layer.
- **Two-stage validation where the meaning depends on data.** The URL schema checks that `f.<code>`
  filter parameters are well-formed strings; `parseFilterValues` then validates them against the
  active category's declared `FilterDefinition`s and rejects unknown codes, wrong control types,
  disallowed option values, and `min > max` with a 400 rather than silently ignoring them
  (`src/lib/validation/search.ts`, `src/server/domain/search-filters.ts`).
- **One error envelope.** Every failure is `{"error":{"code","message","details?"}}`. `jsonError()` in
  `src/lib/api/response.ts` normalises `AppError`, `ZodError` and anything else through
  `normaliseError`; `apiHandler()` wraps every route so the convention cannot drift per endpoint.
- **No internal leakage.** Anything that is not an `AppError` or `ZodError` becomes
  `AppError('INTERNAL_ERROR', 500, 'Something went wrong on our side')`; the original is logged
  server-side with `console.error('[api] unhandled error', …)` and never placed in the response. A
  stack trace, SQL fragment or secret cannot appear in a client body, because the message is a
  constant and `details` is only populated from an explicit `AppError` subtype. `RateLimitedError`
  adds a `Retry-After` header — the only header the envelope sets.
- **JSON parse failures** are converted to a 400 `ValidationError`, not an unhandled 500
  (`readJsonBody`).

## 10. Secrets and configuration

Every variable the server reads, and whether it is server-only. All of them are documented in
`.env.example`:

| Variable                                                                                                           | Server-only?              | Notes                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                                                     | Yes                       | Pooled app connection. Contains credentials.                                                                                                                                                                                     |
| `DIRECT_URL`                                                                                                       | Yes                       | Unpooled connection used by `prisma migrate` (see `prisma.config.ts`). Optional in the schema, but without it `prisma migrate deploy` runs over the pooled `DATABASE_URL`, so it is required in practice for migrations.         |
| `TEST_DATABASE_URL`                                                                                                | Yes                       | Isolated test database; the integration harness refuses to run if it equals `DATABASE_URL`.                                                                                                                                      |
| `NEXT_PUBLIC_APP_URL`                                                                                              | **No — public by design** | The public origin, used for canonical URLs, metadata and Better Auth callback URLs. It is not a secret.                                                                                                                          |
| `BETTER_AUTH_SECRET`                                                                                               | Yes                       | Session signing secret. Minimum 16 characters everywhere; in production it must be at least 32 characters and must not match a placeholder pattern (`replace-with`, `changeme`, `dev-only`, `secret-here`, `example`).           |
| `BETTER_AUTH_URL`                                                                                                  | Yes (optional)            | Auth base URL.                                                                                                                                                                                                                   |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_ENDPOINT`      | Yes                       | Media storage credentials/endpoints. Optional outside production; a production **deployment** requires `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `R2_PUBLIC_BASE_URL` unless `ALLOW_LOCAL_MEDIA_STORAGE=true`. |
| `ALLOW_LOCAL_MEDIA_STORAGE`                                                                                        | Yes                       | Explicit opt-in (`true`/`false`, default `false`) to the local filesystem driver in production. Set it only where a persistent disk genuinely exists.                                                                            |
| `MEDIA_MAX_UPLOAD_BYTES`                                                                                           | Yes                       | Default 5 MiB.                                                                                                                                                                                                                   |
| `IP_HASH_SALT`                                                                                                     | Yes                       | Salt for the IP hash. Default `dev-only-ip-salt` for development/test; in production it must differ from that default and be at least 16 characters.                                                                             |
| `RATE_LIMIT_ENQUIRY_PER_IP`, `RATE_LIMIT_ENQUIRY_PER_EMAIL`, `RATE_LIMIT_AUTH_PER_IP`, `RATE_LIMIT_WINDOW_SECONDS` | Yes                       | Limiter tuning. `RATE_LIMIT_AUTH_PER_IP` (default 20) is read by the Better Auth limiter in `src/lib/auth/server.ts`.                                                                                                            |
| `TRUSTED_PROXY_HOPS`                                                                                               | Yes                       | Integer 0–10, default 1. How many proxies in front of the app the operator controls; selects the `x-forwarded-for` entry counted from the end (see §8).                                                                          |

**Why nothing sensitive is `NEXT_PUBLIC_`:** `NEXT_PUBLIC_` values are inlined into the client bundle
at build time, so any such variable is readable by every visitor permanently. The only public
variable is the app origin, which is public information. The R2 credentials, the auth secret, the
database URLs and the IP salt are all read through `getServerEnv()` in `src/lib/env.ts`, which begins
with `import 'server-only'` — importing it from a Client Component fails the build rather than
shipping a secret.

**Validation at the boundary:** `getServerEnv()` parses `process.env` with a Zod schema once and
caches the result, throwing a formatted error listing every missing/invalid variable at first access
rather than surfacing `undefined` deep inside a request. The schema is wrapped in a `superRefine` that
only activates when `NODE_ENV === 'production'`, so the production policy fails closed:

- `BETTER_AUTH_SECRET` is rejected if it matches a placeholder pattern or is shorter than 32
  characters;
- `IP_HASH_SALT` is rejected if it is the `dev-only-ip-salt` default or shorter than 16 characters;
- media storage is rejected unless `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and
  `R2_PUBLIC_BASE_URL` are all set, unless `ALLOW_LOCAL_MEDIA_STORAGE=true` is set explicitly.

These checks are **runtime** checks: they run when the server first reads its configuration, which is
why a misconfigured deployment fails immediately instead of serving traffic with a default salt.
`pnpm build` itself needs only the ordinary local `.env` — the production build phase does not have to
supply production secrets, and the build is not where a missing secret is detected. The trade-off is
explicit: a build can succeed with a placeholder secret and the failure surfaces at startup rather
than in CI, which is why the startup failure message names every offending variable at once.

In development and test the `R2_*` variables stay optional and `isR2Configured()` selects the local
filesystem driver, so no cloud credentials are needed locally.

**Known configuration risks:** the production checks above cover the previously documented gaps —
`IP_HASH_SALT` and `BETTER_AUTH_SECRET` can no longer stay at their example values in production, and
an unconfigured storage backend now fails at startup rather than at the first upload. What is still
unchecked: `R2_ACCOUNT_ID` and `R2_ENDPOINT` are not part of the production requirement list (the
`S3Client` reads them, so a bad value fails on first use rather than at boot), and
`isR2Configured()` itself still tests only `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
`R2_BUCKET` — the `R2_PUBLIC_BASE_URL` requirement is enforced only by the production refine.

## 11. Audit logging

Recorded for administrative actions: `action` (closed Zod enum in `src/lib/validation/audit.ts`),
`entityType`, `entityId`, a human-readable `summary`, the actor (`actorUserId`, `actorName`), an
optional JSONB `metadata`, the salted IP hash, the user agent and the timestamp. `recordAudit` accepts
an optional transaction client so the audit row is written **in the same transaction** as the change
it describes — an action that succeeds is always auditable, and one that rolls back leaves no
misleading entry (`src/server/services/audit.service.ts`).

Recorded actions include listing create/update/publish/unpublish/archive/restore/verify/unverify,
attribute updates, media attached/verified/removed, enquiry assignment/status/note/duplicate flag, and
customer suspend/reactivate/deactivate.

**What is deliberately not recorded:**

- **Raw IP addresses.** Only `hashIp(ip, salt)` (SHA-256 over `salt:ip`) is stored, on
  `Enquiry.submittedIpHash` and `AuditLog.ipHash`. This is enough to rate limit and correlate abuse
  without retaining a personal identifier.
- **Request bodies, tokens, passwords or secrets.** No authorisation header or session token is ever
  passed to `recordAudit`.
- **Private note bodies in the customer projection.** A shared note creates a customer-visible
  activity with the note's text; a private note records only "Internal note added" with
  `isCustomerVisible: false` (`adminAddNote`).

**Retention stance:** `AuditLog` is append-only with no delete path and no retention job; the intent
is that administrative history is retained for the life of the deployment. The `actor` FK is
`SetNull`, so audit rows survive account deletion. **Honest caveat:** the claim "no PII in audit
metadata" is not fully true — `adminUpdateCustomerStatus` writes the customer's email address into
`metadata.email` (`src/server/services/admin-enquiry.service.ts`). That is intentional provenance for
a moderation decision, but it is personal data inside the audit log and should be covered by the
privacy notice and by any future retention policy.

## 12. Privacy and consent

- **Consent captured:** `createEnquirySchema` requires `consentPrivacy: z.literal(true)`, so an
  enquiry without explicit consent is a validation error. `consentedAt` is stamped server-side at
  creation and `consentPolicyVersion` is stored for provenance.
- **Policy version:** `PRIVACY_POLICY_VERSION = '2026-02-01'` in `src/lib/validation/enquiry.ts`, and
  the client may send a version (capped at 20 characters) so the exact text the customer saw is
  recorded. The seed writes the same value (`CONSENT_POLICY_VERSION = '2026-02-01'` in
  `prisma/seed.ts`), so seeded and live consents agree. (An earlier revision reported the seed writing
  `'2026-01-15'`; that is no longer the code.)
- **Marketing consent** is separate from privacy consent and defaults to `false` on
  `CustomerProfile.marketingConsent`; it is editable by the customer and never required to submit an
  enquiry.
- **Personal data stored, and why:**

| Data                                                                                                 | Where                                   | Why                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| Name, email, phone (as typed), normalised phone                                                      | `Enquiry`, `User`                       | Contact the customer about their enquiry; match duplicates. |
| Event brief: date, flexibility, guest count, budget, requirements, city, event type, referral source | `Enquiry`                               | The lead itself.                                            |
| Salted IP hash, user agent                                                                           | `Enquiry.submittedIpHash`, `.userAgent` | Abuse investigation. The IP itself is not stored.           |
| Account profile: phone, city, preferred contact method, marketing consent                            | `CustomerProfile`                       | Account area and contact preference.                        |
| Consent flag, policy version, timestamp                                                              | `Enquiry`                               | Provenance of consent.                                      |
| Audit metadata                                                                                       | `AuditLog.metadata`                     | Administrative accountability (may contain an email, §11).  |

- **Data minimisation in the customer projection:** the tracked-enquiry view and the customer DTOs
  intentionally omit internal notes, assignees and duplicate flags.
- **Not implemented:** no data export, no account-deletion flow, no automated retention expiry for
  enquiries, and no consent-withdrawal mechanism — all pre-launch requirements for a real notice.

## 13. Known gaps and accepted risks

What a production launch would still need, ordered roughly by risk:

1. **Email verification and transactional email/SMS.** Neither is implemented; only the
   `NotificationPort` seam exists (`src/server/services/notification.service.ts`). Until
   verification lands, register-with-someone-else's-address is possible, password reset cannot be
   made safe, and guest-enquiry claiming must stay disabled.
2. **Secret rotation and management.** Secrets live in `.env`/platform env vars with no rotation
   procedure, no separate per-environment credentials and no vault. Production now rejects the
   `IP_HASH_SALT` default, so the placeholder cannot ship by accident, but rotating the salt still
   invalidates duplicate detection and abuse correlation.
3. **Security headers and CSP.** `next.config.ts` sets only `cacheComponents` and
   `partialPrefetching`. There is no `Content-Security-Policy`, `Strict-Transport-Security`,
   `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` or
   `Permissions-Policy`. The blocking inline `ColorSchemeScript` means a CSP needs a nonce/hash plan
   rather than a naive `script-src 'self'`.
4. **Dependency scanning.** No `pnpm audit`/Dependabot/Renovate configuration and no CI gate on
   vulnerabilities or licences.
5. **A formal penetration test.** Especially the upload flow, the enquiry endpoint's abuse controls,
   and the admin panel. Nothing has been tested adversarially.
6. **Public-bucket hardening for uploads** (§7): a private uploads prefix, an explicit publish step,
   and lifecycle rules for never-completed objects. Catalogue read rate limiting is also absent
   (T8), so a patient scraper can walk the paginated search API.
7. **Authentication hardening beyond Better Auth defaults:** no MFA, no breached-password check, no
   IP/device anomaly detection, no CAPTCHA fallback, and no account lockout policy. Auth rate limiting
   does use `RATE_LIMIT_AUTH_PER_IP` (see T7), but it is per-instance state inside Better Auth rather
   than a database-backed counter like the enquiry limiter, so it does not span serverless instances.
8. **CSRF/Origin posture on the mutation routes.** No route performs an explicit Origin/Host check;
   the mitigation is the `SameSite=Lax` session cookie (browsers do not attach it to a cross-site
   POST) plus JSON request bodies. That is defensible but implicit — an explicit check, or a documented
   decision, should accompany any future form-encoded or cross-origin client.
9. **Audit retention and privacy operations** (§11–12): the log contains email addresses, grows
   without bound, and there is no data export, account deletion, consent withdrawal or retention
   expiry.
10. **Stale-claim cleanup is ongoing.** The previously listed honeypot/schema contradiction and the
    "seed audit actions are outside the enum" items are fixed: all four distinct actions the seed
    writes (`listing.published`, `listing.media_uploaded`, `listing.featured`, `enquiry.status_changed`,
    `prisma/seed.ts`) are present in `AUDIT_ACTIONS` (`src/lib/validation/audit.ts`), and the honeypot
    is wired as described in §8.
