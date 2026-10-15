# API Design

Status: **Accepted** · Companion documents: [system-design](./system-design.md),
[database-design](./database-design.md), [security](./security.md),
[testing-strategy](./testing-strategy.md).

The platform exposes a single REST API implemented as Next.js Route Handlers under
`src/app/api/**`. Server Components call the same **service layer** in-process rather than
`fetch`-ing this API, so there is exactly one implementation of every business rule and the HTTP
surface exists for browser clients, tests and future consumers.

---

## 1. Conventions

### Layering

```
route.ts (controller)  →  validation schema  →  service  →  repository / Prisma
   HTTP only                Zod                  rules        data access
```

A controller does four things and nothing else: extract input, validate it, call a service, return a
response. It contains no business rule, no Prisma call and no authorization decision of its own.
`apiHandler()` wraps every route so error mapping is uniform.

### Response envelope

Success responses return the payload directly, keyed by resource:

```json
{ "data": { "slug": "gulmohar-banjara-banquets", "name": "Gulmohar Banjara Banquets" } }
```

List endpoints return a page object:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1, "pageSize": 12, "totalItems": 34, "totalPages": 3,
    "hasNextPage": true, "hasPreviousPage": false
  }
}
```

Error responses always use one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Unknown filter for this category",
    "details": {
      "unknown": ["colour"],
      "allowed": ["guest_capacity", "venue_type", "indoor_outdoor"]
    }
  }
}
```

`code` is machine-readable and stable; `message` is safe to show a user; `details` is optional,
structured and endpoint-specific. **No response ever contains a stack trace, SQL, a credential or an
internal identifier that is not part of the documented contract.**

### Status codes

| Code | Meaning in this API                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 200  | Success                                                                                                                                                |
| 201  | Resource created (enquiry submission, listing/catalogue creation)                                                                                      |
| 400  | Validation failed: malformed body, unknown filter, invalid range, bad query parameter                                                                  |
| 401  | No valid session on a protected endpoint                                                                                                               |
| 403  | Authenticated but not permitted (e.g. a customer calling an admin route)                                                                               |
| 404  | Resource absent **or not visible to this actor** — see §5                                                                                              |
| 409  | Conflicts with current state: illegal lead transition, duplicate enquiry, publish precondition not met, idempotency-key reuse with a different payload |
| 413  | Upload too large                                                                                                                                       |
| 415  | Upload content type not allowed                                                                                                                        |
| 429  | Rate limited; includes a `Retry-After` header                                                                                                          |
| 500  | Unexpected server error (message is generic)                                                                                                           |

### Pagination, sorting and filtering

- Every list endpoint accepts `page` (≥ 1) and `pageSize` (1–48 for public search, 1–100 for admin
  lists). Values above the cap are a **400**, not silently clamped, so a client cannot believe it
  received more rows than it did.
- `page` is offset-based. The page query and the `count` run in one `$transaction` with the **same**
  `where` clause, which is what guarantees `totalItems` never disagrees with the rows returned.
- Sort is always whitelisted. An unknown `sort` value is rejected or falls back to the documented
  default (`recommended`) — it is never interpolated into SQL.
- The final sort key is always `id`, so page 2 cannot repeat or skip rows from page 1.

### Naming

`camelCase` for query parameters and response fields; plural nouns in paths with no verbs;
`UPPER_SNAKE_CASE` for enum values; `/api/admin/**` for the administrative surface.

---

## 2. Authentication

Sessions are Better Auth database sessions carried in an HttpOnly cookie. There are three actors:

| Actor         | How the server identifies them                                |
| ------------- | ------------------------------------------------------------- |
| anonymous     | no session, or a session whose account status is not `ACTIVE` |
| customer      | session on an active `CUSTOMER` account                       |
| administrator | session on an active `ADMIN` account                          |

`GET /api/auth/[...all]` and `POST /api/auth/[...all]` are the Better Auth handler
(`sign-up/email`, `sign-in/email`, `sign-out`, `get-session`). Passwords are hashed by Better Auth;
`role` and `status` are declared `input: false`, so a registration request **cannot** set them.

**Identity is never read from the request body, query string or a client-supplied header.** Every
protected route resolves the actor from the session cookie alone, via `getActorFromHeaders()`.
Hiding a control in the UI is never the control.

---

## 3. Public discovery

### `GET /api/categories`

Query: `includeInactive` (`false` always for the public surface).
Returns the category tree with a `listingCount` per node that **rolls up subcategories**, so a
top-level category does not read as empty when only its children have listings.

### `GET /api/categories/{slug}`

Returns the category, its parent, its active children, its `listingCount`, and its resolved filter
definitions. `404` when the slug is unknown or inactive.

### `GET /api/categories/{slug}/filters`

Returns `{ data: FilterDefinition[] }` — the metadata the frontend renders filters from:

```json
{
  "id": "clx…",
  "code": "guest_capacity",
  "label": "Guest capacity",
  "dataType": "NUMBER",
  "control": "RANGE",
  "unit": "guests",
  "groupLabel": "Capacity",
  "sortOrder": 10,
  "options": [],
  "bounds": { "min": 0, "max": 5000 }
}
```

Definitions are **inherited from ancestor categories** and overridden by more specific bindings, so
`capacity` defined once on _Venues_ is offered by _Banquet halls_, _Hotels and resorts_ and _Lawns_.
Adding a category or a filter is therefore an administrator data operation, not a deploy.

### `GET /api/listings` — search

The product's most important endpoint. All filtering and pagination happen server-side; the browser
never receives the dataset.

| Parameter                     | Type         | Notes                                                                                      |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `q`                           | string ≤ 120 | Substring match against the trigram-indexed `searchText`; under 2 characters it is ignored |
| `category`                    | slug         | Includes the category's descendants                                                        |
| `location`                    | slug         | Matches the listing's own location **or** any declared service area                        |
| `eventType`                   | csv          | Any-of                                                                                     |
| `amenity`                     | csv          | Any-of                                                                                     |
| `verified`                    | boolean      | `VERIFIED` businesses only                                                                 |
| `featured`                    | boolean      | Featured only                                                                              |
| `priceMin` / `priceMax`       | integer ≥ 0  | Range **overlap** with the listing's own price range                                       |
| `capacityMin` / `capacityMax` | integer ≥ 0  | Range overlap with guest capacity                                                          |
| `f.<code>`                    | string       | Category-specific attribute filter; see below                                              |
| `sort`                        | enum         | `recommended` (default), `price_asc`, `price_desc`, `newest`, `name_asc`                   |
| `page`, `pageSize`            | integer      | `pageSize` ≤ 48                                                                            |

**Attribute filter encoding** (validated against the active category's declared definitions):

| Data type       | Syntax                                                                       | Semantics                                                  |
| --------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `MULTI_SELECT`  | `f.style=candid,documentary`                                                 | listing has **any** of the values                          |
| `SINGLE_SELECT` | `f.catering_policy=in-house-only`                                            | exactly one value; two values is a 400                     |
| `NUMBER`        | `f.capacity=500-900`, `f.capacity=500-`, `f.capacity=-900`, `f.capacity=500` | bare value means "this or more"                            |
| `BOOLEAN`       | `f.accommodation=true`                                                       | `true/false/1/0/yes/no`; both values means "no constraint" |
| `TEXT`          | `f.brand=loreal`                                                             | case-insensitive contains, min 2 characters                |
| `DATE`          | `f.available=2026-05-01..2026-06-01`                                         | either side may be omitted                                 |

Failures are explicit, never silent: an unknown code returns 400 with the allowed codes; an unknown
option returns 400 with the allowed options; `min > max` returns 400; and using any `f.` parameter
**without** a category returns 400, because those filters have no meaning without a category to
validate them against.

Representative response:

```json
{
  "cards": [
    {
      "id": "clx…",
      "slug": "gulmohar-banjara-banquets",
      "name": "Gulmohar Banjara Banquets",
      "tagline": "A grand banquet address in Andheri East",
      "category": { "name": "Banquet halls", "slug": "banquet-halls" },
      "location": { "name": "Andheri East", "slug": "andheri-east", "type": "LOCALITY" },
      "priceLabel": "₹1,200 – ₹2,400 per plate",
      "capacityLabel": "300–900 guests",
      "isVerified": true,
      "isFeatured": false,
      "cover": {
        "url": "/media/seed/gulmohar-cover.svg",
        "alt": "Abstract placeholder cover for Gulmohar Banjara Banquets",
        "width": 1200,
        "height": 800
      },
      "galleryCount": 3,
      "highlights": [
        { "code": "guest_capacity", "label": "Guest capacity", "value": "900 guests" },
        { "code": "venue_type", "label": "Venue type", "value": "Banquet hall, Hotel" }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "totalItems": 17,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "appliedFilters": [
    {
      "code": "location",
      "label": "Location",
      "displayValue": "mumbai",
      "removeHref": "/vendors?category=venues"
    },
    {
      "code": "guest_capacity",
      "label": "Guest capacity",
      "displayValue": "500+ guests",
      "removeHref": "/vendors?category=venues&location=mumbai"
    }
  ],
  "activeFilterCount": 2,
  "context": {
    "category": { "slug": "venues", "name": "Venues", "path": "venues" },
    "location": { "slug": "mumbai", "name": "Mumbai", "type": "CITY" },
    "query": null,
    "sort": "recommended",
    "verifiedOnly": false
  }
}
```

Every chip carries a ready-made `removeHref` that preserves all other filters, so the client never
rebuilds query state and cannot accidentally drop a neighbouring filter.

**Cards are category-aware.** The `highlights` array is driven by `CategoryAttribute.showOnCard`, so
venues surface capacity and venue type while photographers surface style and coverage hours, without
the frontend hard-coding a card layout per category.

### `GET /api/listings/{slug}`

Returns the full public `ListingDetail`. **Draft, unpublished and archived listings return 404**, so
a guessed slug cannot reveal pre-publication data. Provider contact details are filtered through
`deriveContactDisclosure` — a channel the administrator has not published stays `null` and is
accompanied by an explanatory `contact.message`; a raw phone number is never rendered as page text,
which preserves lead attribution.

### Other public endpoints

- `GET /api/event-types` — active event types.
- `GET /api/locations?type=&parentId=&q=` — locations, `CITY`/`LOCALITY` for the public pickers.
- `GET /api/amenities` — the amenity catalogue.
- `GET /api/search/facets` — browsable categories/locations/event types. Deliberately returns **no
  per-option result counts**: accurate facets need one aggregate per value, which is out of MVP
  scope (ADR-13). The result-set total _is_ exact.

---

## 4. Customer endpoints

| Method  | Path                                    | Notes                                                                                                                                                                                                         |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/account`                          | Account + profile + enquiry counts. 401 when anonymous.                                                                                                                                                       |
| `PATCH` | `/api/account`                          | Name, phone, city, preferred contact method, marketing consent. **Email, role and status are not accepted** — email needs a verification flow the MVP does not ship, and role/status are administrator-owned. |
| `GET`   | `/api/enquiries`                        | The caller's own enquiries only. Ownership is applied in the `where` clause, never as a post-filter.                                                                                                          |
| `POST`  | `/api/enquiries`                        | Create an enquiry (§5).                                                                                                                                                                                       |
| `GET`   | `/api/enquiries/{referenceCode}`        | The caller's own enquiry detail.                                                                                                                                                                              |
| `POST`  | `/api/enquiries/{referenceCode}/cancel` | Allowed only while every lead is still cancellable.                                                                                                                                                           |
| `POST`  | `/api/enquiries/track`                  | Guest progress lookup: reference code **and** email.                                                                                                                                                          |

### Customer-facing status vocabulary

Internal operational statuses never reach a customer. The DTO maps them:

| Stored status                               | Customer label                       |
| ------------------------------------------- | ------------------------------------ |
| `NEW`                                       | Sent to the business                 |
| `CONTACTED`                                 | Business has been contacted          |
| `QUALIFIED`                                 | In discussion                        |
| `SHARED_WITH_PROVIDER`                      | Shared with the business             |
| `CONVERTED`                                 | Booked                               |
| `LOST` / `CANCELLED` / `DUPLICATE` / `SPAM` | Closed / Cancelled / Closed / Closed |

The customer projection also omits `assignedAdminId`, all `EnquiryNote` rows, and every
`EnquiryActivity` whose `isCustomerVisible` is false.

---

## 5. Enquiry submission

### `POST /api/enquiries`

Request:

```json
{
  "listings": ["gulmohar-banjara-banquets", "smriti-frame-studios", "angara-live-kitchens"],
  "contactName": "Priya Nair",
  "contactEmail": "priya@example.test",
  "contactPhone": "+91 90000 00001",
  "contactCitySlug": "mumbai",
  "contactMethod": "EMAIL",
  "eventTypeSlug": "wedding",
  "eventDate": "2026-11-14",
  "eventDateFlexible": false,
  "guestCount": 450,
  "budgetMin": 800000,
  "budgetMax": 1500000,
  "requirements": "Looking for an outdoor ceremony and an indoor reception.",
  "consentPrivacy": true,
  "consentPolicyVersion": "2026-02-01"
}
```

Headers: optional `Idempotency-Key`.

Response `201`:

```json
{
  "data": {
    "referenceCode": "LE-3BDP9TWX",
    "status": "NEW",
    "duplicate": false,
    "listings": ["Gulmohar Banjara Banquets", "Smriti Frame Studios", "Angara Live Kitchens"]
  }
}
```

Ordered behaviour:

1. **Rate limited** per IP hash and per contact email (fixed window, PostgreSQL-backed).
2. **Honeypot** — a filled `companyWebsite` yields a normal `201` and a stored `SPAM` lead, so a bot
   learns nothing from the response.
3. **Idempotency pre-check.** An existing claim for this key is read before validation: same key +
   different payload is a **409** (a client bug, reported ahead of any field error), and a previous
   attempt that claimed the key but produced no enquiry is released so this attempt can own it. When
   the client sends no key, the server derives one from the canonical payload and a coarse time
   bucket, so retries inside the same bucket collapse.
4. **Listings resolved by slug and required to be published**; anything else is a 400 naming the
   offending slugs. Slugs are used rather than ids so a form cannot reference a draft listing by
   guessing a database identifier.
5. **Idempotency claim.** The key is only _claimed_ once steps 1–4 have succeeded, so a rejected
   submission does not burn the key. The claim is one atomic insert against the `(scope, key)` unique
   constraint; a claim already fulfilled by an enquiry replays that enquiry with `duplicate: true`
   instead of creating a second row.
6. **Duplicate detection** — the same contact identity (normalised email or the digits-only phone
   tail) with the identical listing set inside a 15-minute window returns the existing enquiry.
   Outside that window the enquiry is created but flagged `isPotentialDuplicate` for admin review.
7. **One transaction** writes the brief, one `EnquiryListing` per provider, the `CREATED` activity
   and any internal duplicate flag, then derives the overall status from the children.
8. **Notification** is dispatched after commit through a `NotificationPort` seam and is wrapped so a
   delivery failure can never fail or roll back a committed lead.

Guests may submit (no sign-in wall) and their submission is **not** auto-claimed by a later sign-up —
see [security.md](./security.md#guest-enquiries-and-why-they-are-not-auto-claimed).

### `POST /api/enquiries/track`

```json
{ "referenceCode": "LE-3BDP9TWX", "email": "priya@example.test" }
```

Both values are required and rate limited. A mismatch returns the **same 404** as an unknown
reference, so the endpoint cannot be used to confirm that a reference code exists.

---

## 6. Administration

Every route under `/api/admin/**` resolves the session server-side and requires an active `ADMIN`
account. A customer receives **403**; an anonymous caller receives **401**. Services re-check
authorization internally, so calling a service directly cannot bypass the guard.

### Listings

| Method      | Path                                                | Notes                                                                                                                         |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET`       | `/api/admin/listings`                               | Filters: `q`, `publicationStatus`, `verificationStatus`, `categoryId`, `locationId`, `isFeatured`                             |
| `POST`      | `/api/admin/listings`                               | Always creates a `DRAFT`; publishing is a separate audited action                                                             |
| `GET`       | `/api/admin/listings/{id}`                          | Full editor payload                                                                                                           |
| `PATCH`     | `/api/admin/listings/{id}`                          | `services`, `packages` and `venueSpaces` are **replaced wholesale** when present, because the editor submits the complete set |
| `POST`      | `/api/admin/listings/{id}/publication`              | `{ action: publish \| unpublish \| archive \| restore, reason? }`                                                             |
| `POST`      | `/api/admin/listings/{id}/verification`             | `{ action: verify \| reject \| reset, reason? }`                                                                              |
| `GET`/`PUT` | `/api/admin/listings/{id}/attributes`               | Privileged attribute values, validated against the category's definitions                                                     |
| `POST`      | `/api/admin/listings/{id}/media/presign`            | Presigned single-object upload                                                                                                |
| `POST`      | `/api/admin/listings/{id}/media/{mediaId}/complete` | Verifies what actually landed in storage                                                                                      |
| `DELETE`    | `/api/admin/listings/{id}/media/{mediaId}`          | Promotes another image to cover                                                                                               |
| `PATCH`     | `/api/admin/listings/{id}/media`                    | Reorder; `sortOrder: 0` becomes the cover                                                                                     |

Publishing is refused with **409** when the listing has no `READY` image or no description — a
photoless, description-less listing is a dead end for the customer, and the API says so with a usable
message instead of failing silently.

The attribute endpoint validates **semantically**, not just structurally: the request schema can only
check that the payload is well-formed, but whether a `valueNumber` is permitted depends on the
attribute's declared `dataType`, whether an option value exists depends on the option catalogue, and
which attributes are required depends on the category bindings. Violations return 400 naming the
offending attribute.

### Media upload sequence

```
1. POST .../media/presign      → validates MIME type (allow-list) and size cap, creates a PENDING
                                 row, returns a 5-minute presigned PUT constrained to one key,
                                 one Content-Type and one Content-Length
2. browser PUT → object storage   (the file never passes through the application server)
3. POST .../media/{id}/complete → the server HEADs the object and compares the REAL content type
                                 and byte length with what was declared; mismatch → 415/400
```

The extension is never trusted (it is derived from the validated content type), and a completed row
requires descriptive alt text, because the image must be describable for accessibility.

### Enquiries

| Method | Path                                       | Notes                                                                                                                                            |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/admin/enquiries`                     | Filters: `q`, `status`, `assignedAdminId` (or `unassigned`), `categoryId`, `listingId`, `eventTypeId`, `flaggedDuplicate`, created range, `sort` |
| `GET`  | `/api/admin/enquiries/{id}`                | Full lead detail: complete contact details, private notes, full non-customer timeline, consent provenance                                        |
| `POST` | `/api/admin/enquiries/{id}/status`         | `{ status, note?, isCustomerVisible?, lostReason?, providerResponseNote?, enquiryListingId? }`                                                   |
| `POST` | `/api/admin/enquiries/{id}/assign`         | `{ assignedAdminId: string \| null, scope: 'lead' \| 'enquiry', note? }`                                                                         |
| `POST` | `/api/admin/enquiries/{id}/notes`          | `{ body, enquiryListingId?, shareWithCustomer? }`                                                                                                |
| `POST` | `/api/admin/enquiries/{id}/duplicate-flag` | `{ isPotentialDuplicate, note? }`                                                                                                                |

A status change is one transaction that: validates the transition against the closed state machine
(illegal transitions are **409**), stamps the stage's SLA timestamp, writes an `EnquiryActivity` with
an explicit customer-visibility flag, recomputes the enquiry's overall status from its children, and
writes an audit row. If any part fails the whole change rolls back — a lead can never end up moved
without a corresponding history entry.

Omit `enquiryListingId` to apply the transition to every provider lead in an enquiry.

### Customers, metrics and audit

| Method  | Path                        | Notes                                                     |
| ------- | --------------------------- | --------------------------------------------------------- |
| `GET`   | `/api/admin/overview`       | Operational metrics plus recent listings                  |
| `GET`   | `/api/admin/customers`      | Search, status and role filters                           |
| `PATCH` | `/api/admin/customers/{id}` | `{ status: ACTIVE \| SUSPENDED \| DEACTIVATED, reason? }` |
| `GET`   | `/api/admin/audit-logs`     | Action, entity and actor filters                          |

Suspension takes effect immediately because `getActorFromHeaders()` treats a non-active account as
anonymous — sessions do not need to be chased down. The endpoint refuses to change your **own**
account (400) and refuses to suspend another administrator, which would otherwise be an easy way to
lock everyone out.

### Catalogue

`/api/admin/catalog/{categories,event-types,locations,amenities,attributes,attribute-options}` plus
bindings (`POST /api/admin/catalog/categories/{id}/attributes`) and binding updates
(`PATCH /api/admin/catalog/category-attributes/{id}`).

These are the endpoints that make "new categories and filters without code changes" real. Slugs are
generated server-side (`slugify` + `disambiguateSlug`) and materialised paths (`Category.path`,
`Location.path`) are maintained with `buildPath`, because those paths are what make subtree and
inheritance queries a single indexed range scan. Catalogue mutations have no dedicated service layer;
the routes use Prisma directly and hold the reservation explicit with a comment.

---

## 7. Error and abuse behaviour summary

| Situation                                    | Status | Body detail                                           |
| -------------------------------------------- | ------ | ----------------------------------------------------- |
| Malformed JSON body                          | 400    | `VALIDATION_ERROR`, "Request body must be valid JSON" |
| Unknown category attribute filter            | 400    | `details.unknown`, `details.allowed`                  |
| `f.*` filter without a category              | 400    | `details.filters`                                     |
| `min > max` on a range                       | 400    | `details.min`, `details.max`                          |
| `pageSize` above the cap                     | 400    | Zod field error                                       |
| Unpublished listing by slug                  | 404    | generic not-found message                             |
| Another customer's enquiry                   | 404    | **not 403** — the API does not confirm existence      |
| Wrong email on `/enquiries/track`            | 404    | identical to an unknown reference                     |
| Illegal lead transition                      | 409    | `details.from`, `details.to`, `details.allowed`       |
| Duplicate idempotency key, different payload | 409    | explicit message                                      |
| Publish without an image or description      | 409    | actionable message                                    |
| Self-suspension                              | 400    | explicit message                                      |
| Enquiry submission over the limit            | 429    | `Retry-After` header                                  |

---

## 8. Idempotency contract

`POST /api/enquiries` accepts an optional `Idempotency-Key` header. A key identifies one **intent**,
not one form:

- **The browser derives the key from the canonical payload** (`deriveIdempotencyKey` in
  `EnquiryForm.tsx`, a 64-bit FNV-1a hash). A retry of the same intent sends the same bytes and so the
  same key and replays; an edited resubmission sends different bytes and so a different key, which is
  what makes "correct the typo and send again" work. Two rapid clicks on an untouched form produce one
  key, so the second click is a replay rather than a duplicate lead.
- **The key is inspected before validation and claimed after it.** An existing claim with a different
  payload is a **409** reported before the body is validated. A claim that was taken by a previous
  attempt but never produced an enquiry (the request failed, or the process died in between) is
  released and retaken — a claim with no enquiry behind it is not a commitment.
- **A rejected submission does not burn the key.** Rate limiting, the honeypot, key inspection and slug
  resolution all run before the claim, so a 400 for a typo'd business address leaves the key free.
- **The claim is one atomic `INSERT`** against the `(scope, key)` unique constraint — never a `SELECT`
  followed by an `INSERT`, which is a race under a retry storm. A claim already fulfilled by an
  enquiry replays the original result (`duplicate: true`) rather than creating a second lead. Key reuse
  with a different payload fails loudly with **409**.
- **When no header is sent**, the server derives a key from the canonical payload hash and a coarse
  time bucket, so a retry inside the same bucket still collapses into one lead.
- Keys are retained for 7 days (`IdempotencyKey.expiresAt`), deliberately longer than any realistic
  client retry window, so a delayed or queued retry cannot create a second lead.
- Only `POST /api/enquiries` is idempotent. Other mutations are either naturally idempotent
  (`PATCH`, `PUT`) or guarded by the state machine (`POST .../status`), and are documented as such.

---

## 9. Development-only endpoints

Two routes exist purely so the local filesystem storage driver can be exercised without Cloudflare
credentials. **Both return 404 when `NODE_ENV === 'production'`**, so they cannot be reached in a
deployed environment:

| Method | Path                          | Purpose                                                                                                                                                                                       |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT`  | `/api/dev-media-upload?key=…` | The upload target the local driver's presigned URL points at. Mirrors the R2 presign constraints: one object key, declared `Content-Type`, non-empty body, and the same path-traversal guard. |
| `GET`  | `/local-media/{key}`          | Serves objects written by the local driver so seeded and uploaded media render in development and tests.                                                                                      |

In production the equivalent flow is: the server issues a real presigned R2 `PUT`, the browser uploads
directly to R2, and delivery happens from the configured public bucket/CDN domain.

## 10. What is deliberately absent

- No payment, booking or availability endpoints — this is a discovery and lead-generation platform.
- No provider/vendor endpoints — administrators manage provider data, and there is no vendor portal.
- No reviews/ratings endpoints (see ADR-6).
- No notification or email endpoints; delivery is behind a `NotificationPort` seam with a no-op
  implementation.
- No API versioning: the surface is additive-only and unversioned, and no external consumer exists
  yet. Introducing `/v2` is the documented path if a breaking change is ever required.
