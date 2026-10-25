# Admin panel

The back office for Life Events. It is a working operations surface, not a demo:
every action below writes to PostgreSQL, is audited, and is covered by the same
authorization path as the public site (`getCurrentActor` → `requireAdmin`).

## Running it

| Concern     | Development                                            | Production                    |
| ----------- | ------------------------------------------------------ | ----------------------------- |
| Public host | `http://localhost:3000`                                | `https://www.lifeevents.in`   |
| Admin host  | `http://admin.localhost.me:3000` (needs a hosts entry) | `https://admin.lifeevents.in` |
| Toggle      | set `ADMIN_URL`                                        | set `ADMIN_URL`               |

`ADMIN_URL` is optional. When it is unset the panel is served at `/admin` on the
public host, which is what local development, the e2e suite and preview builds
do. When it is set, `src/proxy.ts` redirects `/admin/*` on the public host to the
admin host, and `/` on the admin host to `/admin`.

Local hosts entry:

```
127.0.0.1 admin.localhost.me
127.0.0.1 lifeevents.localhost.me
```

`*.localhost` resolves natively in Chrome and Firefox; `*.localhost.me` does not,
so it needs `/etc/hosts` (or dnsmasq). Using a real-ish parent domain in
development is deliberate: it exercises the cross-subdomain session cookie that
production needs, which `localhost` cannot.

Cookie sharing: `src/lib/auth/server.ts` sets
`advanced.crossSubDomainCookies` to `.example.com` when the public and admin
hosts share a parent domain, so one Better Auth session works on both hosts.
Authorization is never inferred from the host — every service calls
`requireAdmin`.

## Modules

| Route                        | What it does                                                               |
| ---------------------------- | -------------------------------------------------------------------------- |
| `/admin`                     | Overview, new-enquiry badge                                                |
| `/admin/listings`            | Listing list, create/edit, attributes, media, publication, verification    |
| `/admin/enquiries`           | Enquiry inbox, per-business pipeline, assignment, notes, duplicates        |
| `/admin/vendor-applications` | Application inbox, onboarding invites, approval → draft listing            |
| `/admin/customers`           | Customer list and detail, moderation                                       |
| `/admin/catalogue/*`         | Categories, attributes/options, locations, event types, amenities          |
| `/admin/reports`             | 30-day counts, pipeline by status, most-enquired listings, CSV exports     |
| `/admin/settings`            | Home hero, outbound email, Meta Pixel + Conversions API, admin host status |
| `/admin/audit`               | Audit log                                                                  |

## Vendor onboarding (invite links)

Two ways a business enters the pipeline:

1. **Public form** (`/partner-with-us`) — four fields, stored as
   `VendorApplication` with `source = PUBLIC`.
2. **Private invite** — the back office creates a single-use link from
   `/admin/vendor-applications`; the business fills in its own listing details at
   `/vendors/onboard?t=…`.

Invite properties (`VendorInvite`):

- the raw token is returned exactly once and shown in the admin page as a link;
  only its SHA-256 hash is stored;
- 14-day expiry, single use, revocable;
- states: `SENT → OPENED → SUBMITTED`, plus `EXPIRED` / `REVOKED`.

The onboarding form collects business name, vendor type (catalogue category),
city, contact person, phone, email, optional website and a description. Submitting
updates or creates the `VendorApplication` with `source = INVITE`, marks the
invite `SUBMITTED`, audits the action and emails the administrators.

**Approval** — "Approve & create draft listing" on the application creates a
`BusinessListing` with `publicationStatus = DRAFT`, links it back through
`VendorApplication.listingId`, refreshes the search text and opens the listing
editor. Prices, media and attributes are finished by the team in the existing
editor. A second approval is impossible because `listingId` is checked.

## Enquiries and notifications

Enquiry creation (public or guest) resolves the same notification seam
(`sendNotification`) as before. The email implementation is loaded lazily and:

- sends a confirmation to the customer;
- sends the enquiry to every active `ADMIN` user plus `ADMIN_NOTIFICATION_EMAIL`;
- sends status updates to the customer;
- sends assignment mail to the assigned administrator.

Delivery never fails the business operation. Every attempt is recorded in
`EmailLog` with `SENT`, `FAILED` or `SKIPPED`. With no provider configured (the
default in development and CI) rows are `SKIPPED`, so the admin settings page
shows exactly what would have been sent.

Provider: Resend over its HTTP API (`RESEND_API_KEY`). From address and reply-to
are editable in Settings → Email.

## Meta Pixel + Conversions API

Pixel (browser) and CAPI (server) send the **same** event with the same
`event_id`, so Meta deduplicates them. The event id for a conversion is the
enquiry reference code (`LE-XXXXXXXX`).

| Moment                      | Browser    | Server (CAPI)              |
| --------------------------- | ---------- | -------------------------- |
| Any page view               | `PageView` | —                          |
| Enquiry submitted           | `Lead`     | `Lead`, same event id      |
| Vendor onboarding submitted | —          | email only (no Meta event) |

- **Consent first.** The pixel is loaded only after the visitor chooses "Allow
  analytics" in the consent banner (`src/components/integrations/ConsentBanner.tsx`).
  Declining leaves the site fully functional and no request reaches Meta. Admin
  screens never load analytics.
- **Hashed identity.** CAPI hashes email, phone, first/last name, city, country
  and an external id with SHA-256 (phone normalised to `+91` digits). IP and user
  agent are forwarded as-is (they are not hashed by Meta's contract).
- **Encrypted token.** The Conversions API token is stored with AES-256-GCM in
  `AppSetting` (`src/lib/crypto.ts`), keyed from `BETTER_AUTH_SECRET`, and is
  write-only in the UI.
- **Delivery log.** Every attempt is a `MetaEventLog` row (`SENT` / `FAILED` /
  `SKIPPED`) shown in Settings; `Send test event` exercises the whole path.
- **Enablement.** Settings → Meta: tick "Send events to Meta", add Pixel ID and
  token. For test events, add the Events Manager test code; events then appear in
  Test Events instead of production reporting.

Environment fallbacks exist for a deploy that prefers env-only configuration:
`META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `META_GRAPH_VERSION`.
Database settings win when present.

Privacy: analytics consent is stored in `localStorage` under
`lifeevents-analytics-consent`. The privacy policy must name analytics/Meta
processing, and the Meta data-deletion callback should point at an operator
workflow before launch.

## Reports and exports

`/admin/reports` reads PostgreSQL directly: enquiries in the last 30 days, counts
by status, applications by status, most-enquired listings, and failed email/Meta
counts. Two CSV downloads are admin-gated route handlers:

- `GET /api/admin/reports/export?report=enquiries`
- `GET /api/admin/reports/export?report=applications`

Both cap at 5,000 rows. Move to a queued export before that cap becomes
restrictive.

## Settings

`AppSetting` is a key/value table with JSON values, so a new setting needs no
migration. Keys: `site`, `email`, `meta`.

- **Site** — hero video URL and loop point (streamed into the home page through a
  Suspense boundary, with the shipped defaults as fallback), public contact
  email, announcement text.
- **Email** — from address, reply-to.
- **Meta** — enabled, pixel id, test event code, token (write-only).

## Security notes

- The `/admin` layout refuses anonymous visitors and answers customers with
  `notFound()`, so the panel's existence is not confirmed to a non-admin.
- Every Server Action re-checks the role; the layout gate does not run for
  actions.
- The admin host is an operational boundary (separate cookies, logs, DNS, and a
  place to add SSO/IP allowlisting later), not the authorization mechanism.
- **HTTPS is required for admin sign-in in production.** Better Auth marks its
  session cookie `Secure` when `NODE_ENV=production`, so signing in over plain
  HTTP (including a local `next start`) will not persist a session. Use
  `pnpm dev` locally, or serve the production build behind TLS; this is the same
  limitation the e2e notes record.
- Invite tokens are hashed, expiring, single-use and revocable.
- The Meta token is encrypted at rest; it is never rendered back to the browser.
- All mutations that matter are audited (`AuditLog`), including settings changes,
  invite creation/revocation, onboarding submission, approval-to-listing and Meta
  test events.

## Deliberately not built yet

- Vendor portal login (invite + review only for now).
- Claim-an-existing-listing flow.
- Enquiry bulk actions, saved views and reply templates.
- Granular admin roles and 2FA (Better Auth plugins can supply 2FA; roles would
  extend the existing `UserRole`).
- IP allowlist / SSO for the admin host.
- Queued exports and scheduled reports.
