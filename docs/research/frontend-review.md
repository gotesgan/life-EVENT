# Frontend adversarial review — Life Events

Reviewer: `reviewer-frontend` (shared task `task-2`). Scope: `src/app/**` (public + admin), `src/components/**`, `src/lib/filter-state.ts`, `src/theme/**`, and the Server/Client boundary between them. Write scope: this file only.

Method and its limits: I read every code path end to end. Per the resource protocol I did **not** run `next build`, `next dev`, `pnpm start`, `vitest` or `playwright` (another reviewer owns `.next` and the test database). I did run `npx tsc --noEmit --incremental false` (0 errors) and `npx eslint src` (0 errors, 0 warnings) after `source .dev-env.sh`. Both are clean, which matters: **every finding below is a logic, data-flow or design defect, not a type or lint error.** Findings marked `VERIFIED` are traced to a concrete executing code path; `SUSPECTED` are reasoned but depend on runtime behaviour I could not observe in a browser.

---

### F1 — A corrected enquiry is permanently locked by the reused idempotency key (409, and a false "already submitted")

- Severity: blocker
- Location: `src/components/enquiry/EnquiryForm.tsx:265-270`, `src/server/services/enquiry.service.ts:108-157`, `src/components/enquiry/EnquiryForm.tsx:318-324`
- Status: VERIFIED
- What: The key is created on the first submit and held in component state forever (`EnquiryForm.tsx:167`, `:269-270`). The server hashes only `{listings, email, phone, eventDate, requirements}` (`enquiry.service.ts:108-114`). Any edit to a field **outside** that set after a failed attempt resolves as `replay`; any edit to a field **inside** it resolves as `mismatch`. Both are terminal 409s, and nothing in the UI ever mints a new key.
- Evidence: `claimIdempotencyKey` inserts the key _before_ listings are resolved (`enquiry.service.ts:124-128`), so a 400 leaves a key row with `enquiryId = null`. Correcting the typo'd slug changes `listings` → `existing.requestHash !== input.requestHash` → `ConflictError` 409 "This idempotency key was already used with a different enquiry. Use a new key for a new enquiry." (`idempotency.service.ts:69-71`, `enquiry.service.ts:130-134`). The form prints that server sentence verbatim (`EnquiryForm.tsx:318-324`) but provides no way to produce a new key. The second variant is worse: fixing only `contactCitySlug`/`eventTypeSlug` (not hashed) keeps the hash → `claim.state === 'replay'` with `enquiryId === null` → `ConflictError('That enquiry was already submitted')` (`enquiry.service.ts:136-157`) — the user is told an enquiry that was never created already exists.
- Impact: The single most likely recovery path for a rejected enquiry — "read the error, fix the business address, send again" — is bricked until a full page reload, which discards everything typed. Reaching this is easy because `EnquiryForm.tsx:414-438` asks the user to type a raw slug by hand; one typo triggers it.
- Fix: Re-mint the key whenever the payload changes after a failed attempt (e.g. in `transformValues`, or store `{key, hash}` and regenerate when the hash differs), or tighten the server rule: treat `replay` with `enquiryId === null` as `claimed` and return a client-actionable 400 rather than a 409.

---

### F2 — Admin "View on site" points at a route that does not exist

- Severity: high
- Location: `src/components/admin/ListingRowActions.tsx:103-111`, `src/app/admin/enquiries/[id]/page.tsx:235-244`
- Status: VERIFIED
- What: Both admin links use `/listings/${slug}`. There is no `src/app/listings` directory (public profiles live at `/vendors/[slug]`), so every "View on site" action 404s.
- Evidence: `ls src/app` → `about, account, admin, api, categories, cities, contact, enquire, error.tsx, globals.css, layout.tsx, loading.tsx, local-media, not-found.tsx, page.tsx, privacy, robots.ts, sign-in, sign-up, sitemap.ts, terms, track, vendors`. The only other `/listings/...` references are `/admin/listings/...` and the API route `src/app/api/listings/[slug]/route.ts`. The public route is confirmed by `src/app/vendors/[slug]/page.tsx:298`.
- Impact: An administrator reviewing a listing or a provider lead opens a 404 in a new tab, then has to find the profile another way. Broken on the two highest-traffic admin surfaces (listing list, enquiry detail).
- Fix: `href={`/vendors/${slug}`}` in both places; add an e2e assertion for the admin row action's outbound URL.

---

### F3 — One character in a category free-text filter replaces the whole results page with a 400

- Severity: high
- Location: `src/components/filters/FilterControl.tsx:40-77`, `src/server/domain/search-filters.ts:178-186`, `src/app/vendors/page.tsx:64-78`
- Status: VERIFIED
- What: `TextFilter` commits every keystroke through a 350 ms debounce with no minimum length. The server rejects a category `TEXT` attribute shorter than 2 characters with a `ValidationError`, and the page's catch-all renders `ErrorState` _instead of_ the entire results layout.
- Evidence: `FilterControl.tsx:57-61` → `nav.update(... setSingleValue(params, key, next.trim() || undefined) ...)`. `parseFilterValue` case `'TEXT'`: `if (value.length < 2) throw new ValidationError(...)` (`search-filters.ts:179-184`). `SearchResults` returns `<ErrorState …>` from the top-level return (`vendors/page.tsx:88-100`), so `PageHeader`, the sidebar `FilterPanel`, the `SearchBar` and the grid all unmount. The user's half-typed input is gone, along with the control they need to fix it; the only escape is the "Clear every filter" button or a manual URL edit.
- Impact: Typing one character, pausing ~350 ms and typing the next — the normal way anyone types — destroys the page on a category that has a text filter. Reachable only where a category declares a `TEXT` filter, which is a data condition; the code path is unconditional once it does.
- Fix: enforce the same minimum in the client (don't commit below 2 characters, or show an inline field error), and/or return the error inside the results region so the filter rail survives.

---

### F4 — The UI can set filter values the server rejects, and the failure mode is a dead-end error page

- Severity: high
- Location: `src/components/filters/SearchBar.tsx:57-70`, `src/components/filters/NumericRangeField.tsx:85-116`, `src/lib/validation/search.ts:50-69`, `src/app/vendors/page.tsx:64-78`
- Status: VERIFIED
- What: Three values are settable from the UI that fail `searchQuerySchema`:
  1. `q` longer than 120 characters — `TextInput` has no `maxLength` (`SearchBar.tsx:57-70`), schema is `z.string().trim().max(120)` (`search.ts:59`).
  2. A fractional price/capacity — `NumberInput` sets `min={0}` but `clampBehavior="none"` and no `decimalScale` (`NumericRangeField.tsx:91-99,107-115`), schema is `z.coerce.number().int().min(0).max(100_000_000)` (`search.ts:50`). Typing `1500.5` produces `priceMin=1500.5`.
  3. A value above 100,000,000 or below 0 (again `clampBehavior="none"`), e.g. `1500000000` or a pasted negative.
- Evidence: `normalised` goes straight into `searchQuerySchema.safeParse` (`vendors/page.tsx:64-65`); on failure the page renders `ErrorState` with "Part of the address could not be understood" and no reference to the field that failed. Because the error replaces the layout, the budget input the user needs is unmounted.
- Impact: A long search phrase (a pasted venue name + city easily exceeds 120 characters) or a decimal budget silently detonates the whole results surface. The message blames "the address", which is misleading for a value the user typed into a control.
- Fix: add `maxLength={120}` to `SearchBar`, `decimalScale={0}` + explicit `max`/`clampBehavior="blur"` on the numeric inputs, and render parse failures inline in the filter rail instead of replacing the page.

---

### F5 — `featured` is an invisible filter: it filters results but produces no chip and is not counted

- Severity: high
- Location: `src/server/services/search.service.ts:238-363`, `src/app/vendors/page.tsx:170-176`, `src/components/filters/ActiveFilterChips.tsx:39-61`, `src/lib/filter-state.ts:194-211`
- Status: VERIFIED
- What: The sidebar offers a "Featured listings only" switch (`FilterPanel.tsx:149-153`) and the server honours `query.featured` in the `where` clause (`search-filters.ts:369-371`), but `buildAppliedFilters` has no `featured` branch and the server's `countActiveFilters` never counts it.
- Evidence: `buildAppliedFilters` covers `q, location, eventType, verified, price, capacity, amenity, parsedFilters` only (`search.service.ts:252-348`); `countActiveFilters` lists the same set (`:353-363`). `ActiveFilterChips` returns `null` when `appliedFilters.length === 0` (`ActiveFilterChips.tsx:39`), and `vendors/page.tsx:170-176` passes the server's count into both the chip rail and the mobile drawer badge. So `/vendors?featured=true` renders a filtered grid with "1 active filter" nowhere, no chip, and no visible "Clear all". The client copy of the same function _does_ count `featured` (`filter-state.ts:200`), so the two implementations of the same concept already disagree.
- Impact: A shared or refreshed URL shows a subset of results with no on-screen explanation and no one-click removal of the constraint. This directly contradicts the stated role of the chip rail ("Filter state must be legible", `docs/design-system.md:45`).
- Fix: add a `featured` branch to `buildAppliedFilters` and to the server's `countActiveFilters`; delete the unused client duplicate (`filter-state.ts:181-216`) so the count has one source.

---

### F6 — An inverted budget/capacity range silently returns non-overlapping listings

- Severity: medium
- Location: `src/server/domain/search-filters.ts:411-442`, `src/components/filters/NumericRangeField.tsx:72-80`, contrast `src/server/domain/search-filters.ts:222-228` + `src/components/filters/FilterControl.tsx:102-113`
- Status: VERIFIED
- What: The two range filters behave differently for the same user mistake (`min > max`). Category attribute ranges are written as one `min-max` key and rejected with a 400 ("has a minimum above its maximum", `search-filters.ts:222-228`). The budget and guest-count filters are written as two independent keys (`priceMin`/`priceMax`) and `buildRangeOverlapClause` composes them as two independent AND conditions.
- Evidence: `buildRangeOverlapClause` pushes `{[maxField]: {gte: requestedMin}}` and `{[minField]: {lte: requestedMax}}` (`search-filters.ts:419-441`). With `priceMin=5000, priceMax=1000`, a listing priced 500–6000 satisfies both conditions and is returned even though its range never intersects 5000–1000. The natural typing order (maximum first, then minimum) reaches this state. The only visible artefacts are a chip reading "Budget: ₹5000 – ₹1000" and a plausible-looking result set.
- Impact: The results claim to satisfy the customer's budget while demonstrably not doing so — the exact class of "untrustworthy filter" the search domain comments are written to prevent.
- Fix: reject `min > max` in `NumericRangeField` before committing (and show a field error), or have the search service normalise/400 the inverted pair. Also encode both universal ranges with the same `min-max` key the attribute ranges use so there is one range contract, not two.

---

### F7 — Bulk status change is unconfirmed and defaults to _hiding_ the update from the customer (the single-lead control defaults to the opposite)

- Severity: medium
- Location: `src/components/admin/EnquiryInbox.tsx:76`, `:130-180`, `:310-324` vs `src/components/admin/EnquiryStatusControl.tsx:45`, `:118-124`
- Status: VERIFIED
- What: `EnquiryInbox` sends `isCustomerVisible: shareWithCustomer` where `shareWithCustomer` initialises to `false` (`:76`, `:139-147`); `EnquiryStatusControl` initialises `isCustomerVisible` to `true` (`:45`). The bulk path also has no confirmation at all, while single-row destructive admin actions (unpublish, archive, reject verification, delete media, deactivate account) all go through `confirmAction`/`confirmWithReason`.
- Evidence: `EnquiryInbox.tsx:317-324` — "Update N selected" fires `applyBulkStatus()` immediately; the target list is `ADMIN_STATUS_ORDER.filter(...)`, which includes the terminal `CONVERTED` (`ALLOWED_TRANSITIONS` at `enquiry-status.ts:35` has no outgoing edge). `EnquiryStatusControl`'s own doc comment claims "Customer visibility is an explicit choice, **defaulting on**" (`:30-32`).
- Impact: An admin triaging five leads to "Shared with provider" with the switch left alone silently gives the customer no update — the opposite of the single-lead behaviour and of the customer-facing promise in `CUSTOMER_STATUS_DESCRIPTIONS`. A bulk move to `CONVERTED` is irreversible and takes one unconfirmed click.
- Fix: default the bulk switch to `true` to match the single control; route bulk changes through `confirmAction` when the target is terminal (`CONVERTED`, `CANCELLED`) or `LOST`.

---

### F8 — The category landing page has no filter surface below the `md` breakpoint

- Severity: medium
- Location: `src/app/categories/[slug]/page.module.css:14-25`, `src/app/categories/[slug]/page.tsx:120-133`
- Status: VERIFIED
- What: `FilterPanel` is wrapped in `<aside className={classes.sidebar}>`, and `.sidebar` is `display: none` with no mobile counterpart. Unlike `/vendors` (`vendors/page.tsx:154-172`), this page never renders `MobileFilterDrawer`.
- Evidence: `.sidebar { display: none; @mixin larger-than $mantine-breakpoint-md { display: block; … } }` (`page.module.css:14-25`). `grep -rn "MobileFilterDrawer" src/app` matches only `src/app/vendors/page.tsx`. The `FilterNavigationProvider basePath="/vendors"` wiring (`page.tsx:125-132`) is therefore dead below `md`.
- Impact: On a phone, a category page advertises "Browse all N with filters" and nothing else: the category attribute filters (the differentiator the card/profile design is built around) are unreachable from the page that owns them. The mitigation is a navigation hop, not a control.
- Fix: render `MobileFilterDrawer` on the category page too, or reuse the `/vendors` layout so there is one results surface.

---

### F9 — An over-long or malformed admin filter value silently discards _every_ filter on the page

- Severity: medium
- Location: `src/app/admin/_lib/query.ts:31-38`, triggered from `src/components/admin/EnquiryFilters.tsx:83-90`
- Status: VERIFIED
- What: `parsePageQuery` is all-or-nothing: if `safeParse` fails it re-parses `schema.parse({})`, which returns the schema **defaults** — not the valid subset. So one bad key wipes the other keys.
- Evidence: `query.ts:33-38`. The enquiry search box has no `maxLength` (`EnquiryFilters.tsx:83-90`) while `adminEnquiryQuerySchema.q` is `max(120)` (`validation/enquiry.ts:120`), so typing a 121-character search resets status, assignee, category, business, event type, duplicate flag and date range, and shows the unfiltered inbox. The same applies to a hand-edited `createdFrom`.
- Impact: An admin loses a carefully built inbox filter set by typing one character too many into the search box, and the page gives no indication that anything was dropped (the count just changes).
- Fix: strip only the keys that fail (parse per-key, or `safeParse` and fall back per field) and cap `q` in the input with `maxLength={120}`.

---

### F10 — Two filter changes inside one pending navigation can lose the first one

- Severity: medium
- Location: `src/components/filters/useFilterNavigation.tsx:75-99`, `src/components/filters/FilterPanel.tsx:125-172`
- Status: SUSPECTED
- What: `params` is derived from `useSearchParams()` and `update` closes over it (`:75-78`, `:91-96`). Every checkbox/switch mutation is `mutate(params)` from that snapshot. In the App Router the new `searchParams` only arrive when the server render commits, so two rapid clicks can both start from the pre-first-click snapshot and the second `router.push` overwrites the first.
- Evidence: `FilterPanel.tsx:131-133` and `:168-170` call `nav.update((params) => toggleListValue(params, key, value))` with no functional-update or local optimistic state; `useFilterNavigation` has no pending queue and does not use `useOptimistic`/`useTransition`. Contrast the client-side `NumericRangeField` and `SearchBar`, which at least debounce. I could not run a browser, so I cannot confirm the exact width of the race window.
- Impact: Ticking "Photographers" then "Decorators" quickly can silently drop the first filter, leaving the UI showing a checkbox that is checked while the grid (and URL) do not reflect it. This is the failure mode the file header claims is impossible ("Exactly one navigation is issued per change", `:66-67`).
- Fix: keep an optimistic local overlay of pending changes and merge it into `params`, or apply the mutation to `new URLSearchParams(window.location.search)` instead of the React snapshot.

---

### F11 — The chip remove control is a 20×20 px target

- Severity: medium
- Location: `src/components/ui/FilterChip.module.css:54-77`
- Status: VERIFIED
- What: `.remove` is `width: rem(20px); height: rem(20px)` with `padding: 0`, wrapping a 12 px icon. WCAG 2.2 SC 2.5.8 (Target Size Minimum) requires 24×24 CSS px unless spacing provides an equivalent; the enclosing chip is 28 px tall, so the effective target cannot grow either. The adjacent label is not part of the button.
- Evidence: `FilterChip.module.css:58-59`, `.icon { width: rem(12px); height: rem(12px) }`, `.chip { height: rem(28px) }`. The control is used for every applied-filter chip on `/vendors` — the densest cluster of small targets in the product, and the one used on touch while the mobile drawer is closed.
- Impact: Removing a filter on a phone is a precision task, and a mis-tap lands on the chip body (a no-op) rather than the button.
- Fix: make the button at least 24×24 (padding inside a `28px` chip works if the chip grows to ~32 px) or extend the hit area with a pseudo-element.

---

### F12 — Two divergent "active filter" counters, one of them dead, plus a dead `FILTER_KEYS`

- Severity: low
- Location: `src/lib/filter-state.ts:181-216` vs `src/server/services/search.service.ts:353-363`
- Status: VERIFIED
- What: `FILTER_KEYS`, `countActiveFilters` and `hasActiveFilters` in `src/lib/filter-state.ts` have no callers anywhere in `src` or `tests` (`grep -rn "hasActiveFilters\|countActiveFilters\|FILTER_KEYS" src tests` returns only the definitions and the admin `*_FILTER_KEYS` constants, which are unrelated). If anyone ever wires them up, the public count would say `featured` is an active filter while the server's count says it is not (see F5).
- Evidence: `filter-state.ts:200` (`if (params.featured === 'true') count += 1;`) has no counterpart in `search.service.ts:353-363`.
- Impact: No user-visible breakage today; it is a maintenance trap sitting exactly where a future maintainer would look for "the count".
- Fix: delete the unused trio, or make the server import the client helper and add the `featured` case in one place.

---

### F13 — There is no multi-provider shortlist; the helper for it is dead and the profile CTA overwrites the selection

- Severity: low
- Location: `src/lib/filter-state.ts:242-251`, `src/components/listing/ListingCard.tsx:31`, `src/app/vendors/[slug]/page.tsx:119`
- Status: VERIFIED
- What: `setSelectedListings`/`readSelectedListings` are documented as "the multi-provider enquiry form" shortlist, but `setSelectedListings` has zero callers (including tests). Every entry point builds the `enquire` parameter from exactly one slug, with no merge against the current URL.
- Evidence: `ListingCard.tsx:31` and `vendors/[slug]/page.tsx:119` both hard-code `/enquire?enquire=<one slug>`. `enquire/page.tsx:122-125` reads the CSV and caps it at `MAX_PROVIDERS`. `grep -rn "setSelectedListings" src tests` → only the definition. The e2e suite only ever navigates to `/enquire?enquire=<slug>` directly (`tests/e2e/enquiry-flow.spec.ts:17` etc.), so nothing exercises adding a second provider from the UI.
- Impact: The only way to contact several businesses at once is to type each page address by hand into `EnquiryForm.tsx:414-438` — the same free-text field that triggers F1. Sending an enquiry from vendor B's profile does not add to vendor A's selection, it replaces it, which is a silent loss of intent if the user expected a basket.
- Fix: either wire a real shortlist (a "Add to enquiry" toggle on the card/profile writing `setSelectedListings`) or remove the dead helpers and the "businesses you are contacting" plural framing so the product does not promise a flow it lacks.

---

### F14 — A debounced range commit can re-apply a filter after "Reset" / "Clear all"

- Severity: low
- Location: `src/components/filters/NumericRangeField.tsx:72-80`, `src/components/filters/MobileFilterDrawer.tsx:73-78`, `src/components/filters/ActiveFilterChips.tsx:55-61`
- Status: SUSPECTED
- What: `commit` is a 500 ms `useDebouncedCallback` (Mantine reads the latest callback through a ref), so a pending commit fires _after_ a Reset/Clear-all that has already navigated, calling `nav.update` with the post-reset `params` and re-adding `priceMin`/`capacityMin`.
- Evidence: `NumericRangeField.tsx:72-80` schedules `nav.update((params) => …)` on every `onChange`; `MobileFilterDrawer.tsx:75` and `ActiveFilterChips.tsx:58` clear the keys immediately. There is no `commit.cancel()` in either reset path, and `NumericRangeField` exposes no cancel. Whether the stale value actually lands depends on the debounce/transition interleaving, which I could not observe without a browser.
- Impact: "Reset" appears not to work for the budget/guest fields, or the chip reappears a moment after it is dismissed.
- Fix: `commit.cancel()` on unmount and when the controlling navigation clears the key, or have the reset paths call a `cancel` exposed by the numeric field.

---

### F15 — `themeColor` is hard-coded and cannot follow the in-app theme toggle

- Severity: low
- Location: `src/app/layout.tsx:44-52`
- Status: VERIFIED
- What: `viewport.themeColor` is a pair of literal hex values selected by `prefers-color-scheme` media queries. The app's theme is a manual toggle persisted in `localStorage`/cookie (`src/theme/color-scheme-manager.ts`), not the OS preference.
- Evidence: `layout.tsx:48-51` uses `#F8F6F5`/`#131019`, which duplicate `lightSchemeTokens['--app-surface']` and `darkSchemeTokens['--app-surface']` (`src/theme/tokens.ts:148`, `:217`) — the only hex values outside `src/theme` in the whole tree (`grep -rnE "#[0-9a-fA-F]{3,8}" src` minus `src/theme` and `src/generated` returns exactly these two lines).
- Impact: A user on a dark-OS device who explicitly picks the light theme keeps dark browser chrome (and vice-versa), so the frame fights the page. It is also a silent token duplication: changing `--app-surface` will not change the browser chrome.
- Fix: emit the scheme's surface colour into a `<meta name="theme-color">` that the toggle updates, importing the values from the theme tokens rather than literals.

---

### F16 — "Admin projections mask by default" is overstated: the customers list renders the raw email

- Severity: low
- Location: `src/components/admin/CustomerCells.tsx:40-51`, `src/server/services/admin-enquiry.service.ts:713-721`, claim at `docs/security.md:137-139`
- Status: VERIFIED
- What: `docs/security.md` says full contact values "appear only on `AdminEnquiryDetail`". The customers list DTO carries `email: string` and prints it verbatim as the secondary line of every row.
- Evidence: `CustomerCells.tsx:46-48` renders `{row.email}` with no `maskEmail`; `adminListCustomers` selects `email: true` (`admin-enquiry.service.ts:713-721`). `maskEmail` is imported only by `admin-enquiry.service.ts:4` and applied only to `contactEmailMasked` (`:120-121`).
- Impact: Not a leak — admins are authorized — but the documentation is used as the security argument, and the one screen it does not describe is the one that lists the whole customer base.
- Fix: either mask the email in the list (keep the full value on the customer detail view) or correct the doc to state which projections mask and which do not.

---

### F17 — Documentation precision: "no second font family" and "one stroke width on every icon"

- Severity: nit
- Location: `docs/design-system.md:91`, `:522`; `src/components/enquiry/EnquiryForm.module.css:151`, `src/app/globals.css:217-223`, `src/app/admin/page.tsx:237`, `src/components/admin/listing-editor/ListingEditor.tsx:237`, `src/components/admin/listing-editor/MediaManager.tsx:279`, `src/components/admin/listing-editor/CollectionsSection.tsx:71`
- Status: VERIFIED
- What: "There is no second family anywhere in the repository" is false: the enquiry confirmation reference and all `pre`/`code`/`kbd`/`samp` render in `--mantine-font-family-monospace`. "One stroke width … on every icon, always passed explicitly (`stroke={1.5}`)" is false: four `<Icon…>` usages omit `stroke`, so Tabler's default 2 is used.
- Evidence: `EnquiryForm.module.css:151-153` (`.reference`), `globals.css:221`; missing strokes at the four files above (the only four hits for `<Icon[A-Za-z]+ ` without `stroke=`).
- Impact: Cosmetic inconsistency on four icons; the docs are the project's evidence trail, so an overstatement here weakens the credibility of the claims that _are_ true.
- Fix: scope the font claim to the UI family, and either pass `stroke={1.5}` in the four remaining places or relax the doc.

---

### F18 — Missing `aria-label` on the filters trigger's visible count, and decorative search icons not hidden

- Severity: nit
- Location: `src/components/filters/MobileFilterDrawer.tsx:42-49`, `src/components/admin/EnquiryFilters.tsx:88` (+ `ListingsFilters.tsx:89`, `AuditFilters.tsx:99`, `CustomersFilters.tsx:60`)
- Status: VERIFIED
- What: The drawer trigger's accessible name is `Filters, 2 active` while the visible label is `Filters (2)`; WCAG 2.5.3 wants the visible text inside the accessible name, and voice control matches on the visible string. Separately, the four admin search inputs render `<IconSearch …>` without `aria-hidden`, unlike every public search field (`SearchBar.tsx:67`).
- Evidence: `MobileFilterDrawer.tsx:46-48`; the admin `IconSearch` usages listed above versus `SearchBar.tsx:67` / `HeroSearchBar.tsx:81` / `TrackForm.tsx:186`, which are all `aria-hidden`.
- Impact: Minor SR/voice-control noise. The public surface is correct, so this is a consistency defect, not a blocker.
- Fix: drop the `aria-label` and let the visible text name the button (prefix it if a fuller name is wanted), and add `aria-hidden` to the four admin icons.

---

### F19 — A one-character search is silently ignored by the server but shown as an applied filter

- Severity: nit
- Location: `src/server/domain/search-filters.ts:373-378`, `src/components/filters/SearchBar.tsx:42-46`
- Status: VERIFIED
- What: `q` only becomes a `where` clause at `length >= 2`; below that it is dropped with no feedback. The client still commits `q=a`, and the server still emits a "Search: a" chip and counts it as an active filter.
- Evidence: `search-filters.ts:374` (`if (q.length >= 2)`) versus `buildAppliedFilters`'s `if (query.q)` chip (`search.service.ts:252-261`) and `countActiveFilters` (`:355`).
- Impact: Searching one character shows every listing while the UI claims a search constraint is applied — a small but direct contradiction of the "every filter is a real constraint" copy in the empty state (`vendors/page.tsx:200`).
- Fix: enforce the 2-character minimum at the client (as suggested in F3) and label the chip honestly when the query is too short to apply.

---

## User journeys I believe are broken or fragile

1. **Enquiry → rejected → correct → resend (public `/enquire`).** Broken at the second attempt: F1. Every recovery after a non-client-detectable 400 dead-ends on a 409 that the user cannot clear without losing the form.
2. **Admin reviews a listing or a lead and clicks "View on site".** Broken every time: F2 (404).
3. **Customer narrows results with a category text filter.** Broken when a category declares a `TEXT` filter: F3 unmounts the page after one character.
4. **Customer pastes a long search phrase or types a decimal budget.** Broken: F4 turns the results surface into an error page.
5. **Customer shares or returns to a URL that only has `featured=true`.** Fragile: F5 — filtered results with no visible cause and no chip to remove.
6. **Customer sets a budget with max before min.** Misleading: F6 returns listings that do not overlap the stated range.
7. **Admin bulk-triages several leads.** Fragile: F7 — irreversible terminal moves with no confirmation and customer-visible updates off by default.
8. **Mobile visitor lands on a category page.** Broken for filtering: F8 — the filter panel exists in the DOM but is `display:none` and has no mobile replacement.
9. **Ticking several filter checkboxes quickly.** Fragile: F10 (suspected lost update).
10. **Tracking/account pages.** Not re-reviewed in depth this pass (out of the assigned focus); `tsc`/`eslint` are clean but I did not trace those journeys end to end.

## What I could not verify

- **I could not run a browser, `next dev`, `next build`, `vitest` or `playwright`.** Every interactive claim above is traced statically; the two `SUSPECTED` findings (F10 stale-snapshot navigation, F14 debounce-after-reset) are exactly the ones that need a live browser to confirm.
- **Reachability of F3 depends on seed data** — a category must declare a `TEXT`-type filter. I did not read `prisma/seed.ts`, so I cannot say whether any seeded category does.
- **The `featured` claim in F5 assumes the sidebar switch is actually rendered** on the page in question; it is (`FilterPanel.tsx:149-153`) but I did not verify that a seeded listing has `isFeatured` set, so the _visible_ effect of the missing chip may be subtle in dev data.
- **Contrast, focus order, screen-reader output and 320 px overflow** were not measured — no browser. `docs/design-system.md:691-697` already admits there are no automated accessibility tests, which matches what I found.
- **I did not review** `src/app/track/**`, `src/app/account/**`, `src/app/sign-in/**`, `src/app/api/**` handler-level behaviour, or the media-upload flow; those were outside the assigned focus areas.
- I did not modify anything: `src/**`, `tests/**`, `docs/**` and config are untouched. Only this file was created.

## Top 5 by risk

1. **F1** — the reused idempotency key permanently blocks the correction-and-resend journey and can show a false "already submitted" confirmation. Highest business impact (lost leads) and fully verified.
2. **F3** — one character in a category text filter destroys the results page, including the control the user needs to recover. Trivially reachable by normal typing.
3. **F4** — the UI can set `q`/budget values the server rejects, and the failure unmounts the filter surface with a message that blames the URL, so the user cannot see or fix the offending field.
4. **F2** — both admin "View on site" actions link to a nonexistent route; 100 % reproducible 404 on the two main admin surfaces.
5. **F5** — `featured` filters the result set with no chip and no count, so a shared URL presents an unexplained subset of results, and the two `countActiveFilters` implementations already disagree about it.

## Claims in the existing documentation I believe are overstated

- **"There is no second family anywhere in the repository"** (`docs/design-system.md:91`) — false: `--mantine-font-family-monospace` is used for the enquiry reference and for `pre`/`code`/`kbd`/`samp` (`EnquiryForm.module.css:151`, `globals.css:221`). Defensible design, inaccurate claim.
- **"One stroke width: 1.5, on every icon, always passed explicitly"** (`docs/design-system.md:522`) — false for four icons (`admin/page.tsx:237`, `listing-editor/ListingEditor.tsx:237`, `listing-editor/MediaManager.tsx:279`, `listing-editor/CollectionsSection.tsx:71`).
- **"Admin projections mask by default … the full values appear only on `AdminEnquiryDetail`"** (`docs/security.md:137-139`) — the customers list renders the raw email (`CustomerCells.tsx:46-48`, `admin-enquiry.service.ts:713-721`). The masking claim holds for `AdminEnquiryListRow` only.
- **"the UI never reconstructs filter state"** / one query-string implementation (`ActiveFilterChips.tsx:11-14`, `use-url-filters.ts:14-19`) — there are at least four serialisers (`lib/filter-state.ts`, `searchParams.ts`, `admin/_lib/query.ts`, `search.service.ts:83-91`) and two encodings for the same range concept (F6). They agree on the paths I traced, but the "one implementation" claim is not true.
- **"Exactly one navigation is issued per change"** (`useFilterNavigation.tsx:66-67`) — true per call, but the snapshot-based `params` makes rapid successive changes lossy (F10, suspected).
- **"`Filter state must be legible`" / every active filter is removable** (`docs/design-system.md:43-46`) — violated for `featured` (F5) and for a sub-2-character `q` (F19).
- **`FILTER_KEYS`/`hasActiveFilters` presented as the shared "active constraints" contract** (`lib/filter-state.ts:180-216`) — dead code with no callers that already disagrees with the server's counter.
- **`setSelectedListings` documented as the multi-provider shortlist** (`lib/filter-state.ts:242-248`) — no caller; the flow does not exist (F13).
- **`README.md:104` "`pnpm e2e` — 207 passing"** — I could not run it (protocol), and the suite demonstrably does not cover the admin "View on site" target (F2), multi-provider selection (F13) or the enquiry-correction path (F1), so "verified" understates the uncovered surface.
