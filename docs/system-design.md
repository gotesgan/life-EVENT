# System Design — Live Envt

A multi-category wedding and event business **discovery and lead-generation** platform.

Status: **Accepted** · Companion documents: [technology-decisions](./technology-decisions.md),
[database-design](./database-design.md), [api-design](./api-design.md), [security](./security.md),
[testing-strategy](./testing-strategy.md), [implementation-plan](./implementation-plan.md).

---

## 1. Problem and product boundary

Customers planning a wedding or event must find and contact many different kinds of businesses —
venues, photographers, caterers, decorators, makeup artists, entertainers, planners and more — each
with **completely different decision criteria**. A venue is chosen on capacity, indoor/outdoor and
catering policy; a photographer on style, coverage hours and deliverables; a caterer on cuisine,
service style and per-plate price.

Existing products in this space do one of two things badly:

1. They build a **venue-first** data model and bolt other categories onto it, so filters and
   listing fields become incomplete for everything that is not a venue.
2. They turn into **transaction marketplaces** (availability, payments, bookings) when the real job
   to be done is discovery followed by a conversation.

**This system is explicitly a discovery + lead-generation platform.** The unit of value is a
qualified enquiry that reaches a business, not a completed booking.

**In scope:** multi-category discovery, combined server-side filtering, category-specific filter
metadata, listing profiles, multi-provider enquiries with a shared event brief, lead lifecycle
management, private admin notes and audit, customer account area with enquiry history, one central
admin panel.

**Out of scope (deliberate):** payments, bookings, provider/vendor accounts and dashboards, provider
subscriptions, reviews/ratings (no trustworthy source data — see §11), automated email/SMS delivery
(isolated behind a port), a dedicated search engine.

---

## 2. Application architecture

One deployable Next.js 16 application with three surfaces that share a service layer:

```
Browser
  │
  ├── Public discovery  (RSC pages)  ─┐
  ├── Customer account  (RSC pages)  ─┤   call services in-process
  └── Admin panel       (RSC pages)  ─┘
                                      │
  fetch() from client components ──► src/app/api/**/route.ts  (Route Handlers)
                                      │
                        ┌─────────────┴──────────────┐
                        │        Service layer        │  business rules, authorization,
                        │  src/server/services/*      │  transactions, lifecycle rules
                        └─────────────┬──────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      src/lib/validation       src/server/repositories   src/lib/storage
        (Zod schemas)            (complex queries)        (StorageDriver)
              │                       │                       │
              ▼                       ▼                       ▼
        inferred types          Prisma Client           Cloudflare R2 / local FS
                                      │
                                      ▼
                            PostgreSQL (Neon in prod)
```

### Module boundaries

| Layer        | Location                            | Owns                                                                                                                   | Must not                                             |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Controllers  | `src/app/api/**/route.ts`           | HTTP method/status/headers, parsing `params`/search params/body, calling schema + service, mapping `AppError` → status | Contain business rules or Prisma calls               |
| Services     | `src/server/services/*.ts`          | Business rules, authorization decisions, transactions, lifecycle transitions, audit writes                             | Know about `Request`/`Response` or HTTP status codes |
| Schemas      | `src/lib/validation/*.ts`           | Input validation + normalisation; exported Zod schemas **and** inferred types                                          | Perform I/O                                          |
| Repositories | `src/server/repositories/*.ts`      | Only genuinely complex data access (search query builder, aggregate metrics)                                           | Hold business rules                                  |
| Domain rules | `src/server/domain/*.ts`            | Pure functions: status machines, duplicate heuristics, contact-visibility, slug generation                             | Touch the database                                   |
| Storage      | `src/lib/storage/*.ts`              | Presign, verify, delete objects                                                                                        | Be imported by client components                     |
| Auth         | `src/lib/auth/*.ts`                 | Better Auth server config, session → `Actor` resolution, role guards                                                   | Trust client-supplied roles/ids                      |
| UI           | `src/components/**`, `src/theme/**` | Presentation, tokens, accessibility                                                                                    | Query the database                                   |

The `src/server/**` tree is **server-only** and guarded by the `server-only` package, so importing a
service into a Client Component fails at build time rather than leaking a database credential into
the browser bundle.

**Why one app and not two:** the public site, the customer area and the admin panel share ~80% of
their domain logic and all of their data model. A separate admin service would duplicate the service
layer or force an internal HTTP hop with no security gain — the admin panel is protected by
server-side session + role checks, not by network topology. Proven in practice here: one API
contract, one validation layer, one set of tests covering both surfaces.

### Rendering strategy per surface

| Surface                                      | Rendering                                                       | Why                                                                             |
| -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Homepage, category landing, location landing | Server-rendered, cached by the Data Cache with tag revalidation | Same HTML for everyone; must be fast and indexable                              |
| Search results                               | Server-rendered per request (query-dependent)                   | Result set depends on URL filters; must be correct and shareable                |
| Listing profile                              | Server-rendered with revalidate-by-tag                          | Read-mostly, heavily indexed for SEO, invalidated when an admin publishes/edits |
| Enquiry form, account, admin                 | Server-rendered per request, never cached                       | Contains permission-sensitive, per-user data                                    |
| Filter controls, gallery, admin tables       | Client Components                                               | Genuinely interactive                                                           |

Customer-specific and permission-sensitive responses are **never** written to a shared cache. The
cache key for public pages derives only from `(category, location, event type, page, sort)` and never
from a session.

---

## 3. Frontend, backend, database, storage responsibilities

- **Frontend (Next.js RSC + Client Components)** — routing, layout, accessibility, URL state for
  filters, optimistic UI where safe, form validation feedback. It performs _no_ authorization and
  _no_ data filtering; it renders what the server decided.
- **Backend (Route Handlers + services)** — the only place business rules, authorization, validation
  and persistence happen. Every rule the UI shows is enforced again here, because the URL and the
  request body are fully user-controlled.
- **Database (PostgreSQL)** — the system of record. Enforces uniqueness, foreign keys, check-able
  invariants and indexes that the query patterns depend on. Not a cache, not a file store.
- **Object storage (Cloudflare R2)** — byte storage for listing media only. The database stores
  object keys + verified metadata (`mimeType`, `sizeBytes`, `width`, `height`, `altText`). R2
  credentials never leave the server.

---

## 4. Core entities and relationships

```
User 1─1 CustomerProfile
User 1─* Session / Account
User 1─* AuditLog (actor)

Category ──self──► Category (parent/child = subcategory)
Category *─* AttributeDefinition      via CategoryAttribute
AttributeDefinition 1─* AttributeOption

Location ──self──► Location (COUNTRY→STATE→CITY→LOCALITY)

BusinessListing *─1 Category        (primaryCategory)
BusinessListing *─* Category        (ListingCategory, isPrimary on one)
BusinessListing *─* EventType       (ListingEventType)
BusinessListing *─* Location        (ListingServiceArea)
BusinessListing 1─* ListingMedia
BusinessListing 1─* ListingService
BusinessListing 1─* ListingPackage
BusinessListing 1─* VenueSpace
BusinessListing 1─* ListingAttributeValue *─1 AttributeDefinition
BusinessListing *─* Amenity         (ListingAmenity)
BusinessListing 1─* EnquiryListing
BusinessListing 1─* ListingAttributeValue

Enquiry (the shared event brief)      ← one brief per customer request
  *─1 User (customer, nullable for guest)
  *─* BusinessListing                 (EnquiryListing — independent status per provider)
Enquiry 1─* EnquiryActivity           (status history, customer-visible subset)
EnquiryListing 1─* EnquiryActivity
Enquiry/EnquiryListing 1─* EnquiryNote (private, never customer-visible)

AdminAssignment is expressed as EnquiryListing.assignedAdminId (+ Enquiry-level fallback)
AuditLog : actor, action, entity, metadata
RateLimitBucket : fixed-window counters for public endpoints
IdempotencyKey : replay protection for enquiry submission
```

**One listing system for every category.** There is no `Venue`, `Photographer` or `Caterer` table.
They are all `BusinessListing` rows with a different category, a different set of applicable
attributes, and different card/filter presentation driven by data — not by separate code paths.
This is the single most important structural decision in the schema (§10).

**One brief, many providers.** A customer planning a wedding is interested in a venue _and_ a
photographer _and_ a caterer. The event brief (date, city, guest count, budget, requirements) is
captured **once** on `Enquiry`; each provider is a child `EnquiryListing` with its own status,
assignee and history. This avoids duplicating the brief per provider while still letting the venue
lead be "contacted" while the photographer lead is still "new" — which is how the business actually
works on the admin side.

---

## 5. Authentication, authorization and ownership

Three actor types, resolved **server-side on every request**:

| Actor                  | How identified                                               | Can do                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor      | no session                                                   | read published listings, categories, filters, locations; submit an enquiry with contact details                                                            |
| Authenticated customer | Better Auth session cookie + DB session row                  | everything above, plus: view/update own profile, list own enquiries, read own enquiry detail + customer-visible activity, cancel own enquiry while allowed |
| Administrator          | session whose `User.role = ADMIN` and `User.status = ACTIVE` | all admin mutations: listings, catalogue, media, enquiry assignment/status/notes, moderation, metrics, audit                                               |

Ownership rules:

- `Enquiry.customerUserId` and `EnquiryListing → Enquiry` determine customer visibility. A customer
  query **always** carries `customerUserId = actor.id` in the `where` clause at the repository level;
  it is never a post-filter in application code.
- Admin-only fields — `EnquiryNote`, `EnquiryActivity.isCustomerVisible = false`, `assignedAdminId`,
  provider contact details before disclosure — are **excluded at the query/serialisation boundary**
  by separate DTO mappers (`toCustomerEnquiry`), not by hiding them in the UI.
- Provider contact details on a listing are additionally gated by `deriveContactDisclosure()` and by
  lead stage: full provider contact is disclosed to a customer only after the lead reaches
  `SHARED_WITH_PROVIDER` or `CONVERTED`. Enforced in `deriveContactDisclosure()`, a pure, tested
  function.
- A client-supplied `role`, `userId`, `assignedAdminId` or `customerUserId` is **ignored**; identity
  always comes from the session and assignment changes are validated against the admin's permission.

Full policy matrix, threat model and abuse controls: [security.md](./security.md).

---

## 6. Listing discovery and filtering architecture

This is the hardest part of the product and is therefore a first-class subsystem, not a set of
ad-hoc `where` clauses.

### 6.1 Filter definition model

An administrator defines, per category, which attributes exist and how they behave:

`AttributeDefinition` — global catalogue: `code`, `label`, `dataType`
(`TEXT | NUMBER | BOOLEAN | DATE | SINGLE_SELECT | MULTI_SELECT`), `unit`, `helpText`,
`minNumber` / `maxNumber` / `maxLength` bounds.

`CategoryAttribute` — the per-category binding that makes the same definition behave differently:
`isRequired`, `isFilterable`, `isSearchable`, `isVisibleOnProfile`, `isComparable`, `sortOrder`,
`groupLabel`.

So `capacity` can be a required, filterable numeric range for _Venues_ and simply not exist for
_Makeup Artists_, while `style` is a filterable multi-select for both _Photographers_ and
_Decorators_ with different option sets — **without a schema change or a new code path**.

### 6.2 How a category's filter set is produced

```
GET /api/categories/:slug/filters
  → CategoryService.getFilterDefinitions(categorySlug)
  → AttributeDefinition ⋈ CategoryAttribute WHERE isFilterable = true ORDER BY sortOrder
  → mapped to FilterDefinition DTOs (control type, options, bounds, unit, group)
```

The frontend renders controls **from this metadata**, so adding a category or a filter is an admin
data operation. This is the mechanism that satisfies "new business categories can be added without
rebuilding the entire application".

### 6.3 Request → query pipeline

```
URL query string
  → SearchParamsSchema (Zod)             validate shape: page, pageSize, sort, category, q, filters
  → FilterDefinition lookup (per category) validate *semantics*: unknown filter codes rejected,
                                          wrong control type rejected, options checked against
                                          allowed AttributeOption values, ranges checked for min<=max
  → buildListingWhere()                  pure function → Prisma `where` object
  → ListingSearchRepository              single `$transaction`: count + page of results,
                                          with selective includes chosen by category kind
  → ListingCard DTO mapper               category-aware card projection
```

Two-stage validation is deliberate: the schema can only check that `filters` is a well-formed map,
because the _meaning_ of a key depends on the active category. The second stage validates against
the category's declared filter definitions, which is where "unknown category" and "filter that does
not belong to this category" are rejected with a 400 rather than silently ignored.

### 6.4 Structured vs. flexible storage

| Data                                                                                                                                                             | Storage                                                                                                                                                                 | Why                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Universal, always-queried fields (publication status, verification, primary category/location, `priceMin`/`priceMax`, `searchText`, `isFeatured`, `publishedAt`) | Real columns on `BusinessListing`                                                                                                                                       | Every query touches them; need B-tree indexes and cheap sorting                                                                                         |
| Category-specific attribute values                                                                                                                               | `ListingAttributeValue` rows with **typed columns** (`valueText`, `valueNumber`, `valueBoolean`, `valueDate`, `optionId`, `optionIds[]`) keyed by `AttributeDefinition` | Enables indexed range queries (`valueNumber`), fast boolean/option facets (`optionId`, GIN on `optionIds`), and one uniform code path across categories |
| Multi-select attribute values                                                                                                                                    | `optionIds text[]` + GIN index                                                                                                                                          | One row per `(listing, attribute)` keeps writes atomic; `hasSome` gives correct AND/OR semantics                                                        |
| Non-queried flexible payloads (audit metadata, activity payloads, attribute UI hints)                                                                            | `Json`/JSONB                                                                                                                                                            | Genuinely schema-less, never filtered on                                                                                                                |
| Amenities / tags                                                                                                                                                 | Normalised `Amenity` + `ListingAmenity`                                                                                                                                 | Reusable across categories, displayable, filterable via join, avoids free-text sprawl                                                                   |

**Rejected: EAV for everything** (a single `text` column would lose range indexing), **rejected:
JSONB for everything** (range and facet filters become unindexable or require expression indexes
that Prisma cannot migrate safely — the brief explicitly warns against "store every property in JSON
merely to avoid designing the schema"), **rejected: a column per category attribute** (unmaintainable
as categories grow, which the brief explicitly calls out).

### 6.5 Query performance strategy

- One `where` builder produces both the `count` and the page query, so the **result count can never
  disagree with the rows**. Both run inside one `$transaction`.
- Pagination is **offset-based with a hard `pageSize` cap (max 48, default 12)**. Offset is chosen
  over cursor pagination because the UI needs a total count and page numbers; the offset is bounded
  by the cap and by shallow result sets, and the trade-off is documented (§10, ADR-7).
- Sorting is **whitelisted** (`recommended | price_asc | price_desc | newest | name_asc`) and
  mapped through a fixed table to concrete order-by clauses — never interpolated from user input.
- `recommended` (the default) is a curated composite, not a text-relevance score: featured listings
  first, then most recently published, then `id` as a deterministic tie-break so pagination is
  stable. A text query **filters** results through the trigram-indexed `searchText` column but does
  not re-rank them. Query-text relevance ranking (TF-IDF/similarity ordering) is deliberately out of
  MVP scope and is a documented next step — the alternative would have meant duplicating the `where`
  builder in raw SQL purely to order by `similarity()`, which is a real divergence risk for modest
  benefit. Implementing it properly is a single-module change inside `ListingSearchRepository`.
- **Per-facet result counts are not returned.** Accurate counts require re-running the query once per
  facet value (excluding that facet's own constraint), which is a meaningful cost multiplier for a
  cosmetic gain. The result set total _is_ exact and is always consistent with the returned rows. See
  ADR-13.
- **No N+1.** Search results are fetched with explicit `select`/`include` for cover media, primary
  category, location and the small set of card attributes, in one query. Listing detail loads its
  relations in a bounded set of queries. Where a card needs attributes for many listings, a single
  follow-up query keyed by the result ids is used instead of per-listing queries.
- Indexes exist for exactly the access paths in §6.4 and are enumerated in
  [database-design.md](./database-design.md#indexes). Every index in that list is justified by a
  named query.

### 6.6 URL as the state container

All filter state lives in the URL (`?category=photographers&city=mumbai&style=candid,documentary&price_max=200000&sort=price_asc&page=2`).
Consequences that are designed for, not discovered later:

- Results are shareable and survive refresh/back/forward.
- Pagination and sort changes **preserve** every active filter because they are rewritten as a
  copy of the current query object.
- Removing one chip is a single-key delete on the query object; "clear all" removes only filter keys
  and keeps the base path (so clearing on a category page does not eject the user from the category).
- Text search is debounced (~350 ms) and applied through `router.replace` so typing does not push
  dozens of history entries.
- Facet/filter controls are Client Components that read from `useSearchParams`; the results grid
  itself is server-rendered, so filtering never fetches the whole dataset into the browser.

---

## 7. Enquiry creation and lifecycle

### 7.1 Creation flow

```
POST /api/enquiries
  → EnquiryCreateSchema (Zod)            brief + customer contact + listing slugs + consent
  → RateLimitService.consume(ip, email)  fixed-window, DB-backed
  → inspect any existing idempotency claim  different payload → 409; unfulfilled claim → release
  → resolve published listings           any unpublished/unknown listing → 400 with field errors
  → IdempotencyService.claim(key)        unique constraint; only claimed once the intent is valid;
                                         a fulfilled claim replays the original enquiry
  → duplicate detection                  same contact + same listing set within window
  → prisma.$transaction:
        create Enquiry + EnquiryListing[] + initial EnquiryActivity[] + AuditLog
  → NotificationPort.enquiryCreated(...) fire-and-forget seam (no-op in MVP)
  → 201 { referenceCode, status, listings[] }
```

**Guest and authenticated submission are both supported.** An authenticated submitter gets
`customerUserId` linked automatically; a guest must supply name, email and phone plus explicit
consent. Guest submissions are intentional — forcing account creation before a first enquiry is the
single biggest lead leak in this product category — but they are _not_ auto-claimed by a later
sign-up, because auto-claiming would let anyone register with a victim's email address and read
their enquiries. This is a security decision, documented in
[security.md](./security.md#guest-enquiries-and-why-they-are-not-auto-claimed). Guest progress
tracking works through a dedicated lookup requiring **both** the reference code **and** the contact
email.

### 7.2 Status lifecycle (closed set)

`EnquiryStatus` and `EnquiryListing.status` share one enum. Arbitrary status strings are impossible
— the database column is a Postgres enum generated from a Prisma enum.

```
NEW ──► CONTACTED ──► QUALIFIED ──► SHARED_WITH_PROVIDER ──► CONVERTED
  │         │              │                  │
  ├──► CANCELLED (customer or admin)          └──► LOST
  └──► DUPLICATE / SPAM  (admin triage)
CONTACTED/QUALIFIED can also drop to LOST.
Terminal: CONVERTED, LOST, CANCELLED, DUPLICATE, SPAM.
```

Allowed transitions live in one pure table `src/server/domain/enquiry-status.ts`, exported as
`canTransition(from, to)` and `assertTransition(from, to)`. Every transition writes an
`EnquiryActivity` row (`fromStatus → toStatus`, actor, optional note, customer visibility) and, for
admin actions, an `AuditLog` row. `CONVERTED` is only reachable from `SHARED_WITH_PROVIDER` so the
platform cannot record a conversion for a lead the provider never received.

**Overall status is derived, then denormalised.** `deriveEnquiryStatus(children[])` is a pure,
unit-tested function (any CONVERTED → CONVERTED; else any SHARED_WITH_PROVIDER; else QUALIFIED;
else CONTACTED; else NEW; all terminal-lost → LOST; etc.). The result is stored on `Enquiry.status`
in the same transaction so it can be indexed and filtered without a join, and the derivation
function guarantees the stored value can always be recomputed — no drift is possible because the
only writer of that column is the service, inside the transition transaction.

### 7.3 Duplicate and abuse control

1. **Idempotency** — the browser derives an `Idempotency-Key` from the canonical payload, so a retry
   of the same intent reuses it and an edited resubmission does not. The server inspects an existing
   claim before validating the body (same key + different body → `409` so a client bug never silently
   returns the wrong lead) and only _claims_ the key — a single `INSERT` against a unique constraint,
   never a `SELECT`-then-`INSERT`, which is a race — after rate limiting, the honeypot and slug
   resolution succeed, so a rejected submission does not burn the key. A claim left by a failed
   attempt with no enquiry behind it is released and retaken; a fulfilled claim replays the original
   enquiry.
2. **Semantic duplicates** — same contact identity (email or normalised phone) with the same listing
   set inside a 15-minute window returns the existing enquiry with `duplicate: true` instead of
   creating a second lead. Outside that window the enquiry is created but flagged for admin review.
3. **Rate limiting** — DB-backed fixed-window buckets on enquiry submission (per IP and per contact
   email) and on authentication endpoints. Deliberately in the database rather than in process
   memory, because serverless instances do not share memory.
4. **Spam heuristics** — a honeypot field and a hard cap on the number of listings per enquiry. A
   tripped honeypot stores the enquiry with status `SPAM` for admin triage and is never shared with a
   provider.

   _Not yet implemented:_ a minimum dwell-time check and a link/markup scan of the free-text
   requirement. Both are recorded as gaps rather than claimed here.

5. **Consent** — `consentPrivacy` must be explicitly true, and the accepted policy version + timestamp
   are stored for provenance.

### 7.4 Notification seam

`NotificationPort` is a one-method-per-event interface with a `NoopNotificationPort` implementation.
Enquiry creation calls it _after_ the transaction commits, wrapped so a notification failure can
never fail or roll back a lead. Swapping in an email provider later touches one file.

---

## 8. Media upload and retrieval

```
1. POST /api/admin/listings/:id/media/presign
     validate { filename, contentType, sizeBytes } against allow-list + max size
     -> creates ListingMedia row (status = PENDING) + returns presigned PUT (5 min TTL,
        single key, Content-Type and Content-Length constrained)
2. browser PUTs the file straight to R2   (file bytes never touch the Next.js server)
3. POST /api/admin/listings/:id/media/:mediaId/complete
     -> server HEADs the object, verifies real contentType + exact byte length
     -> status = READY, records the verified byte length and content type; width/height are
        optional metadata supplied with the upload (the server does not decode images)
4. GET  public listing -> cover image + ordered gallery, `unoptimized` via next/image so a
     CDN transformation is not applied twice
```

Rules: allow-listed `image/jpeg|png|webp|avif` only; a hard byte cap enforced at presign _and_
re-verified at completion; extension is never trusted (real content type is read from storage);
`PENDING` rows older than an hour are reaped; deleting media removes the database row and then the
object (a storage-deletion failure leaves an unreferenced object for a cleanup job rather than a
broken image on a live listing); alt text is required by the admin form for accessibility.
`StorageDriver` is an interface with an R2 implementation and a local-filesystem implementation, so
dev, tests and CI need no cloud credentials.

---

## 9. Validation and error-handling conventions

- **Zod 4 is the only validation layer.** Request bodies, query strings, route params, admin
  payloads and environment configuration are all validated at the boundary. Types are **inferred**
  from schemas (`z.infer`) and never re-declared, so drift is structurally impossible.
- Validation happens **once, at the edge** of the server. Internal functions receive already-typed
  values and trust them; the brief's "no duplicate validation" constraint is respected.
- Every failure is normalised to one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid filter: unknown attribute 'colour'",
    "details": { "fieldErrors": { "filters.colour": ["Unknown filter for this category"] } }
  }
}
```

- `AppError` subclasses map deterministically to status codes: `ValidationError → 400/422`,
  `UnauthenticatedError → 401`, `ForbiddenError → 403`, `NotFoundError → 404`,
  `ConflictError → 409`, `RateLimitedError → 429`, anything else → `500` with a message that never
  contains a stack trace, SQL or a secret. The mapper lives in `src/lib/api/errors.ts` and is used by
  every route handler, so error semantics cannot drift per endpoint.
- Server Components surface failures through `error.tsx` boundaries; expected "not found" states use
  `notFound()` and a designed `not-found.tsx`. Loading uses Suspense + skeletons; empty results use
  a designed empty state with a filter-clearing action.

---

## 10. Architectural decisions and trade-offs

**ADR-1 — Generic `BusinessListing` + configurable attributes, not per-category tables.**
_Chosen because_ the brief requires new categories without rebuilding the app and forbids duplicated
listing systems. _Trade-off_: reads need a join to resolve attribute values, and the search builder
is more complex than a plain `WHERE`. _Mitigated by_ selective includes for cards and a single well
tested `where` builder; the alternative (per-category tables) fails the brief's maintainability bar
and cannot support "a listing may belong to multiple categories".

**ADR-2 — Typed EAV columns instead of JSONB for filterable attributes.**
_Chosen because_ capacity, budget and per-plate price need real indexed range queries; JSONB range
filters are not index-friendly. _Trade-off_: one row per (listing, attribute) and a typed column set.
_Mitigated by_ storing genuinely flexible, non-queried payloads in JSONB and keeping the attribute
catalogue admin-configurable.

**ADR-3 — Database sessions instead of stateless JWTs.**
_Chosen because_ moderation requires immediate revocation and role changes must apply without
waiting for token expiry. _Trade-off_: one extra indexed read per authenticated request.
_Mitigated by_ the session lookup being a single primary-key read on a table that is small and hot.

**ADR-4 — Route Handlers, not Server Actions, as the single mutation path.**
_Chosen because_ the brief requires a documented, testable API with consistent error semantics and
API-level tests. _Trade-off_: slightly more boilerplate per mutation than a Server Action.
_Mitigated by_ thin controllers (~15 lines) and shared error/validation helpers.

**ADR-5 — Guest enquiries allowed, never auto-claimed.**
_Chosen because_ sign-in-before-enquiry is the largest conversion loss in this category, while
auto-claiming without verified email would be an account-takeover vector. _Trade-off_: guests cannot
see an enquiry list; they track via reference code + email. _Revisit when_ transactional email and
email verification exist.

**ADR-6 — No reviews or ratings in the MVP.**
_Chosen because_ the brief permits ratings "only if trustworthy rating data exists" and explicitly
forbids fabricated ratings and metrics. _Trade-off_: a familiar sort/signal is absent. _Mitigated by_
admin **verification** status, published pricing and media completeness as honest trust signals, and
by leaving a clean extension point (a `Review` relation and an aggregate column) for when real
reviews can be collected.

**ADR-7 — Offset pagination with a hard cap.**
_Chosen because_ the UI needs a total count, page numbers and accurate result counts when filters
change. _Trade-off_: deep offsets get slower and results can shift if data changes mid-paging.
_Mitigated by_ the `pageSize` cap and by the stable deterministic sort tiebreak chain. Cursor
pagination is the documented upgrade path if a category ever exceeds tens of thousands of rows.

**ADR-8 — PostgreSQL search, no external search engine.**
_Chosen because_ the corpus is comfortably within range for trigram + B-tree indexes and a second
system would add sync complexity for no present benefit. _Mitigated by_ the search repository being
the only module that knows how a query is executed, so swapping in OpenSearch/Meilisearch later is a
single-module change.

**ADR-9 — Derived-then-stored overall enquiry status.**
_Chosen because_ admins need to filter/sort enquiries by overall status without a recursive join,
and customers need one understandable status. _Trade-off_: a denormalised column. _Mitigated by_
making a pure function the sole source of that value and only writing it inside the transition
transaction.

**ADR-10 — Idempotency and rate limiting in PostgreSQL.**
_Chosen because_ serverless instances share no memory, so in-process guards are silently wrong under
scale-out. _Trade-off_: a small table and a write per submission. _Mitigated by_ unique constraints
doing the real work and periodic bucket cleanup.

**ADR-11 — Theme preference is applied client-side before paint, not server-rendered.**
_Chosen because_ `cacheComponents: true` makes a `cookies()` read in the root layout a build error: the
resolved value is needed for an `<html>` attribute, which sits above every `<Suspense>` boundary React
can create. _Trade-off_: a first-time dark-preferring visitor's HTML source says `light` until the
blocking head script runs. _Mitigated by_ that script running before first paint, so the rendered
pixels are always correct — there is no flash. _Upgrade path_: the preference cookie is already written
and `resolveColorScheme` already exists, so restoring the server read means adding the read plus
`export const instant = false` to the root layout — a small change gated on deciding to give up the
static shell. Recorded in [design-system.md](./design-system.md#103-the-cookie-cookies-and-cachecomponents--a-documented-conflict).

**ADR-12 — Placeholder media is abstract generated art, not stock photography.**
_Chosen because_ no real photographs of these (fictional) businesses exist, and presenting stock
wedding photography as a specific business's work would be fabrication. _Trade-off_: the seeded
catalogue looks less photographic than a real launch will. _Mitigated by_ deterministic per-category
duotone SVG motifs that render deliberately rather than broken, real alt text that says the image is a
placeholder, and a `MediaPlaceholder` primitive for listings with no media at all. Real photography
drops in through the same admin upload flow with no code change.

**ADR-13 — No text-relevance ranking and no per-facet counts in the MVP.**
_Chosen because_ the honest default ordering (featured → recency → id) is stable and explainable, and
exact facet counts would require one extra aggregate query per filterable value. Text search still
_filters_ through the trigram-indexed `searchText` column, so results are correct — they are simply
not re-ranked by match quality. _Trade-off_: a search for "candid photographer" returns matching
listings in curated order rather than best-match order, and the sidebar shows the exact total instead
of per-option counts. _Upgrade path_: `similarity()` ordering and facet aggregates are both contained
inside `ListingSearchRepository`, and were rejected now only because implementing them means
duplicating the `where` builder in raw SQL, which would create a real divergence risk between the
filtered count and the returned rows.

---

## 11. Testing layers

| Layer       | Tool                                              | Scope                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest (`unit` project, no DB)                    | Zod schemas, filter parsing/normalisation, `buildListingWhere` purity, status machine, duplicate heuristics, contact-disclosure rules, slug generation, pagination/sort whitelisting, DTO mappers                                                                                                                                      |
| Integration | Vitest (`integration` project, real PostgreSQL)   | constraints and cascades, transaction rollback, listing publish/unpublish, category+attribute configuration, multi-filter search correctness, pagination/sort/result-count agreement, enquiry creation with multi-listing links, activity history, **customer data isolation**, admin authorization, rate limiting, idempotency replay |
| API         | Vitest against route handlers with a real session | 200/201/400/401/403/404/409/429 shapes, malformed bodies, unknown filters, cross-customer access, invalid transitions                                                                                                                                                                                                                  |
| Component   | Vitest + Testing Library (jsdom)                  | filter chips, form validation messages, empty/error states                                                                                                                                                                                                                                                                             |
| End-to-end  | Playwright (real server, seeded DB)               | browse → filter → clear → listing → enquiry → sign in → own enquiry; two-customer isolation; admin create/publish/assign/note; mobile filter drawer; light/dark; focus behaviour                                                                                                                                                       |

Details, fixtures and the isolation strategy: [testing-strategy.md](./testing-strategy.md).

---

## 12. Deployment considerations

- **Vercel** hosts the Next.js app. Route Handlers and Server Components run on the Node.js runtime
  wherever Prisma is used; the Edge runtime is never used for database access.
- **Neon** provides PostgreSQL with a pooled endpoint for the app (`DATABASE_URL`) and a direct
  endpoint for migrations (`DIRECT_URL`).
- **Migrations** run as a deploy step (`prisma migrate deploy`) before the app is promoted — never
  by editing the schema in place.
- The database is the shared state for everything that must survive horizontal scaling: rate-limit
  buckets, idempotency keys and sessions. No correctness depends on process memory or on the
  filesystem.
- **Caching** currently relies on Next.js route-level behaviour only: there is no `revalidateTag`,
  `cacheTag` or `'use cache'` call in the codebase. Public pages render per request, which is correct
  but not optimal, and tag-based invalidation is the documented optimisation (see
  implementation-plan.md). Admin, account and enquiry responses are never cached, and no
  customer-specific or permission-sensitive response is written to a shared cache.
- **Observability**: structured server logs with a request id; `AuditLog` rows for every
  administrative mutation; no PII, tokens or secrets in logs.
- **Backups / retention**: Neon point-in-time restore; media objects are retained while their row
  exists and deleted with it; archived listings are retained (not deleted) to preserve enquiry
  history integrity, because deleting a listing that has leads would corrupt the lead record.

---

## 13. Scaling bottlenecks and how the design responds

| Bottleneck                         | How it shows up                                         | Mitigation already in the design                                                                                           | Upgrade path                                                                                                |
| ---------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Search query cost as listings grow | Slow `count` + page queries under many combined filters | Indexes matched to each filter path; `pageSize` cap; count and page share one `where`; `searchText` trigram index for text | Materialised facet counts, keyset pagination, or an external search engine behind `ListingSearchRepository` |
| Attribute join fan-out             | A listing with 30 attributes multiplies rows            | Card projections fetch only the category's card attributes, not all values; detail page uses bounded includes              | Cache a denormalised facet column per listing                                                               |
| Media delivery bandwidth           | Large galleries served from origin                      | R2 public CDN domain, `next/image` sizes, cover-first loading, lazy gallery                                                | Cloudflare image transformations                                                                            |
| Lead volume for admins             | Enquiry inbox grows unbounded                           | Indexed `(status, createdAt)` and assignment filters, pagination, bulk status tooling                                      | Queue-backed assignment and SLA automation                                                                  |
| Connection count against Neon      | Serverless concurrency                                  | Pooled `DATABASE_URL`, one Prisma client per process, no per-request client creation                                       | Neon connection pooling tuning + read replica for public reads                                              |
| Rating/review aggregation          | not applicable in MVP                                   | —                                                                                                                          | Denormalised aggregate columns if reviews are added                                                         |

---

## 14. Backend readiness gate

The gate that had to be satisfied before frontend implementation began. Each item names its evidence,
and the status is what was actually observed.

| #   | Requirement                                                    | Status   | Evidence                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | System design and data model documented                        | **Done** | This document, [database-design.md](./database-design.md), [api-design.md](./api-design.md)                                                                                                                                                                                              |
| 2   | Core Prisma models and migrations implemented                  | **Done** | `prisma/schema.prisma`, 6 migrations in `prisma/migrations/`                                                                                                                                                                                                                             |
| 3   | Validation schemas in place                                    | **Done** | `src/lib/validation/{common,catalog,listing,enquiry,account,audit,search}.ts`                                                                                                                                                                                                            |
| 4   | Controllers and services follow consistent boundaries          | **Done** | 50 route files under `src/app/api/**`; 48 are wrapped in `apiHandler()` (the exceptions are the Better Auth catch-all and the development-only `dev-media-upload` route). Direct Prisma use appears only in the 15 documented catalogue CRUD routes under `src/app/api/admin/catalog/**` |
| 5   | Authentication and authorization enforced                      | **Done** | `src/lib/auth/*`; `tests/integration/better-auth.test.ts` proves a sign-up cannot self-assign `ADMIN`; `tests/api/admin.test.ts` proves 401/403 on admin routes                                                                                                                          |
| 6   | Public listing search supports combined filters and pagination | **Done** | `src/server/services/search.service.ts`; `tests/integration/search.test.ts` covers combined filters, result-count agreement, stable pagination and sorting                                                                                                                               |
| 7   | Category-specific filter metadata available                    | **Done** | `GET /api/categories/{slug}/filters`; `getFilterDefinitionsForCategory()` with ancestor inheritance                                                                                                                                                                                      |
| 8   | Enquiries creatable, retrievable and manageable per permission | **Done** | `src/server/services/enquiry.service.ts`; `tests/api/enquiries.test.ts`                                                                                                                                                                                                                  |
| 9   | Admin operations protected                                     | **Done** | Every admin route resolves the actor from the session; verified by `tests/api/admin.test.ts`                                                                                                                                                                                             |
| 10  | Critical backend tests pass                                    | **Done** | `npx vitest run` → 612 tests passed, 36 files, 0 failed, 0 skipped (397 unit, 29 component, 186 integration/API). 20 of the 50 API route files are imported by a Vitest suite; see [testing-strategy.md](./testing-strategy.md) §5                                                       |
| 11  | Linting passes                                                 | **Done** | `pnpm lint` clean                                                                                                                                                                                                                                                                        |
| 12  | Type checking passes                                           | **Done** | `pnpm typecheck` — 0 errors under `strict`                                                                                                                                                                                                                                               |
| 13  | Production build passes                                        | **Done** | `pnpm build` succeeds                                                                                                                                                                                                                                                                    |
| 14  | Environment configuration documented without secrets           | **Done** | `.env.example`, validated at the boundary by `src/lib/env.ts`                                                                                                                                                                                                                            |

Two deliverables landed _after_ this gate rather than before it, and are called out so the ordering is
not misrepresented: the frontend surfaces and the end-to-end suite.

Snapshot honesty: items 10–13 were re-measured for this revision — `npx vitest run` → 612 passed,
`npx eslint .` → 0 problems, `npx tsc --noEmit` → 0 errors, `npx next build` → compiled successfully
with 58/58 pages and no errors, using only the ordinary local `.env` (the production environment
checks are enforced at server startup, not during the build).

## 15. What is deliberately _not_ here

- No microservices, message queue, event bus or separate admin service — the brief forbids
  infrastructure that a requirement does not justify, and none does at this stage.
- No payment, booking, availability calendar, subscription or provider portal.
- No provider self-service of any kind; administrators own provider data in the MVP.
- No review/rating system or fabricated trust metrics.
- No email/SMS delivery (only the seam for it).
- No i18n framework: UI copy is English-only for the MVP, with all copy centralised so translation
  is a later, mechanical change. Indian-city/locality data is seeded as reference data.
