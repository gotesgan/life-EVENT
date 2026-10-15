# Master UI Redesign Action Plan

**Status: awaiting approval.** Phase One (inspection) and Phase Two (plan) are complete. No UI
implementation has begun beyond the palette and header already landed.

| Phase One evidence                   | Location                                                      | Scale                                                         |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------- |
| Current-state visual audit           | [`current-state-audit.md`](./research/current-state-audit.md) | 841 lines, 49 screenshots                                     |
| Reference audit, sites 1–8 (India)   | [`reference-audit-a.md`](./research/reference-audit-a.md)     | 787 lines — 5 fully seen, 1 partial, 1 dead domain, 1 blocked |
| Reference audit, sites 9–15 (global) | [`reference-audit-b.md`](./research/reference-audit-b.md)     | 660 lines, 285 `[observed]` claims                            |
| Baseline screenshots at HEAD         | `docs/research/shots/head-*.png`                              | 42 shots (7 pages × 3 viewports × 2 themes)                   |

Every claim below is marked `[observed]` (measured in the browser or read from source), `[reported]`
(from the audits) or `[decision]` (my ruling).

---

## 0. Environment restored, and the true baseline

The machine shut down mid-run. Before anything else I restored and re-measured:

- **PostgreSQL was down.** A stale `postmaster.pid` from the killed process blocked startup, and the
  real failure underneath was `postmaster became multithreaded during startup` — a macOS locale issue.
  Fixed by clearing the stale pid (after verifying no postgres process existed) and starting with
  `LC_ALL=en_US.UTF-8`. `liveenvt_dev` and `liveenvt_test` are both present and serving.
- **`/tmp` was wiped**, taking the Playwright browser cache with it; reinstalled.
- **`.next` was stale** — 6 source files were newer than the build, so the first audit screenshots
  showed an older hero. Rebuilt: **58/58 pages, no errors**. All 42 baselines were then re-captured
  against HEAD.

**Verified baseline** `[observed]`:

| Check                                                                  | Result                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `next build`                                                           | 58/58 pages, clean                                         |
| `vitest run`                                                           | 612 tests / 36 files — 609 pass, **3 fail**                |
| `vitest run --project component tests/component/enquiry-form.test.tsx` | **4/4 pass in 2.5s**                                       |
| `eslint` / `tsc --noEmit` / `prettier --check`                         | 0 / 0 / clean                                              |
| Playwright                                                             | not yet re-run this session — will be the Phase Three gate |

The 3 failures are **load-induced timeouts, not defects**: the same tests pass in isolation. The
component project's 5s default is too tight when the 20 integration files run concurrently. This is a
test-infrastructure fragility and is scheduled as **P2-1**; the historical 612/222 figures should be
treated as unverified until Phase Three re-runs them.

---

## A. Visual diagnosis

Ranked by severity. "Broken" means it is wrong or inaccessible; "plain" means it is merely
unremarkable — and plain is **not** grounds for a functional rewrite.

### Critical

**A1. 100% of listing imagery is generated abstract SVG placeholder art** `[observed]`
Every listing `<img>` is `/media/seed/<slug>-cover.svg` with `alt="Abstract placeholder cover for
<name>"`; the `listing_media` rows _are_ those SVGs. Twelve tiles render roughly four motifs
(rings, arches, envelope, stems, columns) recoloured across pink/mauve/gold/sage, so the browse grid
reads as a wireframe with finished typography. On the profile, one motif is scaled to **1198×673** —
about 75% of the first viewport. The `imgs` also carry no `width`/`height`/`sizes`/`srcset`.
_This is a content gap with a visual consequence._ Evidence: `head-browse-1440-light.png`,
`head-profile-1440-light.png`, `_capture-report.json` (`"imgs": 4, "svgs": 21`).

**A2. The header paints the action colour at full bleed and fails AA in dark mode** `[observed]`
Both bars are `--app-brand`. Measured chrome arithmetic on `/vendors` @1440: bars **3.77%** plus 12
"Send enquiry" buttons **3.31%** = **~7.1% in primary fills**, against the brief's ≤4% ceiling. Whole-page
magenta-hue share measured **12.69% light / 19.04% dark**. Worse, nav text is hard-coded white while
`--app-brand` _inverts_ in dark → **white 14px/700 on `#F25F97` = 3.06:1, a WCAG AA failure**
(light passes at 5.14:1). Also **28 hex literals outside `src/theme`** (22 here, 6 in `HomeHero`).
Source: `SiteHeader.module.css:31,39,40,173`.

**A3. Env-validation failure returns HTTP 200 with a zero-byte body** `[observed]`
With a 13-character `IP_HASH_SALT`, every request returned `200` and an empty body while logging
`IP_HASH_SALT must be at least 16 characters`. A misconfigured deploy fails _silently_ rather than
loudly — the opposite of what the fail-closed work was for. Not a styling matter, but it blocks
verification, so it is in scope.

### Major

**A4. Desktop grid truncates the price and destroys the unit on 8 of 12 cards** `[observed]`
Anchor row `clientWidth 263` vs `scrollWidth 277–311`; renders as `per ev…` / `per e…`. The `title`
attribute the brief mandates is **null on all of them**. Only occurs in the 3-column desktop grid;
no clipping at 768/390.

**A5. The "Featured" ribbon is effectively invisible** `[observed]`
Measured **1.25:1–3.52:1** over photography. `ListingCard.module.css:52-66` uses translucent
`--app-accent-soft` with `#7A4405` text, so the label lands on the image — contradicting the same
file's comment that overlay chips take an opaque ground (the sibling `.photoCount` does).

**A6. The mobile filter sheet's primary action is off-screen on open** `[observed]`
Dialog is 620px tall in an 844px viewport; "Show 17 results" measures `top=1004` → `inViewport: false`
despite `position: sticky`. `state-mobile-filter-390-light.png` shows no apply or clear affordance at
all. This is the highest-traffic mobile flow.

**A7. There is no dropdown navigation anywhere** `[observed]`
`navDropdowns = 0`. Four of nine categories (Beauty & Styling, Entertainment, Invitations & Gifts,
Rentals & Transport) have **no header path at all** — footer only (`navigation.ts:14-21` vs `:24-33`).
The mobile drawer attaches `>` chevrons to plain leaf links (`MobileNav.tsx:43`), implying submenus
that do not exist. There is no location affordance in the header.

### Minor / plain

- **A8. The type ladder collapses below 20px.** h1 measures 64 (home) / 48 (browse, profile, category,
  enquire) / **33.76 (sign-in)**; h2 is 33.76 vs **22.64 (enquire)**; category tiles and
  package/service/space names are all **15px** — the same as 15px/450 body. Footer labels are `h2` at
  13px, smaller than the h3s above them.
- **A9. Uppercase tracked labels in 13 CSS modules** contradict the brief's sentence-case rule; worst is
  the accent-coloured eyebrow `4 PUBLISHED LISTINGS` (`PageHeader.module.css:78-83`).
- **A10. `ui/Card` and `ui/Pagination` have zero import sites** yet are documented as the API — and the
  dead `Card` is the one that violates E0. There are 4+ hand-rolled card systems and a second
  pagination. The live `ListingCard` is the correct one.
- **A11. Structural duplication and dead space**: `filter rail ~1,700px` with no clear-all beside 3–4
  results; `/categories/venues` and `/vendors?category=venues` are near-duplicate surfaces; the
  active-filter count reports "1" for 2 applied params; `/enquire` uses 630px of a 1440 canvas (55%
  empty); `/sign-in` is a lone 460px card on an empty field; mobile home is 5,867px.
- **A12. `HomeHero` hard-codes an Unsplash URL** `[observed]` — `app/page.tsx:171`. External image
  dependency, no licence record, no local fallback.

### What already works — protect it

`[observed]` **`ListingCard` is the best-built object in the product**: E0 exactly (1px border
`rgb(240,216,225)`, `box-shadow: none`), radius 12px, hover = E1 + `--app-border-strong` with no
scale/translate, title box reserved to exactly 44px, a 26px `tabular-nums` anchor row, one stretched
link with the heading as accessible name, and a correct reduced-motion branch. States and semantics
hold: every icon-only control has an accessible name, a skip link exists, one `h1` per page, the error
state is designed, and **there is no horizontal overflow at 390/768/1440 on any of 12 probes**. Motion
discipline matches the brief — only 2 `@keyframes` app-wide and zero `transition: all`.

---

## B. Reference-to-implementation matrix

Drawn from both audits. Full per-site tables are in the two audit files; these are the rows that
change our product. `[reported]` throughout, with measured values preserved.

| Reference                | Observed pattern                                                                                                                                                                                      | Why it works                                                                        | Our adaptation                                                                                                                                 | Target component                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Tagvenue                 | Card `378×521`, radius 8px, `1px solid rgb(222,223,227)`, `box-shadow: none`; image radius 0 clipped by the card                                                                                      | Shadow-free flatness scales to a wide grid and keeps the image primary              | Keep our E0 (no resting shadow) — this independently confirms it; unify the 4 hand-rolled card systems on `ListingCard`                        | `ListingCard`, `CategoryTile`        |
| Tagvenue                 | Price chip over the image bottom-right, `154×42`, `rgba(0,0,0,0.7)`, radius 3px, two lines 10px/400 over 16px/600                                                                                     | Puts the scan anchor on the photograph without competing for a text column          | Adopt for the price/anchor slot **but opaque** (see A5) — fixes the ribbon contrast class of bug                                               | `.ribbon`/`.photoCount`, anchor row  |
| Peerspace                | Compact chip `92×24`, `#121212`, radius 2px, inset 8px, 16px/400                                                                                                                                      | Same idea at half the footprint                                                     | Our compact variant for capacity/guest count                                                                                                   | `CapacityTag`                        |
| Tagvenue                 | Entire 7-group 388px filter rail hidden below 768px, replaced by one 42px `Filter results` button                                                                                                     | Mobile users get one clear action instead of a wall                                 | Already partly built — fix the off-screen action (A6) and collapse the 1,700px rail                                                            | `FilterPanel`, `MobileFilterDrawer`  |
| Tagvenue                 | Progressive disclosure `limit-4`/`limit-8`/`limit-no` + `Show more`; option rows 14px/400 at 32px                                                                                                     | Keeps the rail scannable when a category has many facets                            | Adopt: show 4–6 facets, `Show more` in place, no counts                                                                                        | `FilterControl`, `FilterPanel`       |
| Zola                     | 9 collapsed accordion toggles + `<N> vendors` + an explicit `Sort: Distance` pill, never "Relevance"                                                                                                  | Honest sort labelling; count anchors the result set                                 | Our default sort is already "Recommended" — relabel to something truthful and mirror the count placement                                       | `SortSelect`, results header         |
| Peerspace                | H1 88px/**400** lh96 ls **−1.76px**; long scale                                                                                                                                                       | Weight-400 display at scale with negative tracking reads editorial, not shouty      | Our cheapest route to range **with Manrope only**: reduce display weight from 800 and let tracking scale with size                             | `globals.css` type scale             |
| The Knot                 | Display leading ratio exactly **1.0** (60/60 desktop, 40/40 mobile), −1.2px tracking                                                                                                                  | Tight leading at display size is what "premium" looks like                          | Tighten `--text-display`/`--text-h1` leading toward 1.0–1.05                                                                                   | `globals.css`                        |
| Zola                     | Tracking scales with size (−0.72px at 24px = −3%, −1.28px at 32px = −4%)                                                                                                                              | Optical consistency across the ladder                                               | Encode the ratio in the token ladder rather than per-component                                                                                 | `globals.css`                        |
| Eventbrite               | Search in a 61px header; hero is a pure promo card `1272×393` (3.24:1) with 0 fields                                                                                                                  | Removes the duplicate-search problem entirely                                       | Adopt the _principle_: one search landmark. Our header link already avoids a second `role="search"`                                            | `SiteHeader`, `HomeHero`             |
| Eventbrite               | Card price slot has three states: `Free` / `From $397.00` / `Check ticket price on event` — never blank                                                                                               | A blank slot breaks the grid rhythm; an explicit state keeps it                     | Formalise our price ladder so no card renders blank (already partly done)                                                                      | `PriceTag`, anchor row               |
| Weddingz                 | Mobile hero replaces 2 fields with a single full-width ~56px search button; fields sit behind it                                                                                                      | One tap target on a phone                                                           | Adopt the mobile search pattern                                                                                                                | `HomeHero`, `HeroSearchBar`          |
| WeddingBazaar            | Price range top-right at the **same size and weight as the title** (`₹2,000 - 2,200` / `Per Plate`); title 600 16px, location 400 12px, all pure black                                                | Price and identity share the first scan line, so nothing has to be hunted for       | Adopt in the anchor row — co-locate price with identity instead of stacking it below                                                           | `ListingCard` anchor row             |
| WeddingBazaar            | The **only resting card shadow in all 15 sites**: `0 6px 20px rgba(0,0,0,.12)` over a grey page                                                                                                       | A grey page plus a real shadow reads as a catalogue                                 | **Reject the resting shadow.** Our E0 (1px border on white) is supported by the other 14 — this row is evidence our choice is the majority one | `ListingCard`                        |
| WeddingBazaar            | Equal-width dual CTA pair at 44px: `Check availability` (neutral outline) + `View contact` (pink border + pink text)                                                                                  | Two intents, two weights, one row — no ambiguity about which is primary             | **Maps 1:1 to our lead-gen model.** Our card already carries two actions; give them this explicit weighting                                    | `ListingCard` actions                |
| WeddingBazaar / Weddingz | Horizontal filter **bar** (8 wrapping pills, `border-radius:999px`, container 990×96) instead of a sidebar; Weddingz hides its 300px rail with `--hide-tablet`/`--hide-phone` and shows `Filters (n)` | Returns the full width to the cards, which is where the value is                    | Consider replacing our 1,700px rail with a horizontal bar on desktop, collapsing to `Filters (n)`                                              | `FilterPanel`, `FilterControl`       |
| Weddingz                 | Capacity as a **range pill** (`125-200 Guests`), facet options with right-aligned result counts (`Dwarka 125`, `Rohini 106`), `Applied Filters (1)` with per-pill `✕` and per-section `Clear`         | Counts tell you whether a facet is worth clicking; the applied state is unambiguous | Adopt counts; also fixes our “one active filter for two params” bug (A11)                                                                      | `FilterControl`, `ActiveFilterChips` |
| WedMeGood                | Veg / Non-veg price as a **2×2 mini-table** (amounts 700 16px near-black, qualifiers small grey)                                                                                                      | Matches real Indian per-plate economics without a misleading single “from” price    | Consider for venues publishing both covers — an honest two-price anchor                                                                        | anchor row, `PriceTag`               |
| WeddingBazaar            | **Conditional attribute pills** — `500 Hall capacity` on one card, absent on another; the row wraps into whitespace                                                                                   | Never renders empty placeholders or fabricated values                               | Adopt: a card shows only what the listing actually publishes                                                                                   | `ListingCard` metadata rows          |
| BookEventz               | Hero’s primary action is a **3×2 occasion picker** (Wedding / Engagement / Corporate / Birthday / Cocktail / Get-together), not a text search                                                         | Asks the one question that genuinely segments supply                                | Consider as a secondary hero affordance below the search — it uses our real event types                                                        | `HomeHero`                           |
| WedMeGood                | Card hover is a real spec: `0.3s ease` → `background:#fff` + `box-shadow: 0 0 15px rgba(0,0,0,.05)`, **no translate or scale**                                                                        | Interactivity with no layout jank                                                   | Confirms our hover approach; adopt the exact shadow if a hover lift is ever wanted                                                             | `ListingCard` hover                  |
| WedMeGood                | Serif headings / sans body — the strongest typographic idea in the set                                                                                                                                | Instant hierarchy from two families                                                 | **Unavailable to us** (Manrope-only). Equivalent: Manrope weight + letter-spacing contrast                                                     | type scale                           |
| VenueLook / WeddingWire  | Metadata-dense venue cards: capacity, pricing basis, amenities as scannable rows                                                                                                                      | Buyers compare on these four facts                                                  | Ensure our card exposes capacity + price basis without truncation (A4)                                                                         | `ListingCard`, `ListingFacts`        |
| Cvent / MICEbook         | Flat 2px radius, `transition: color/background-color/border-color 0.2s` only; every probed card `transition-duration: 0s`                                                                             | Restraint reads as confidence                                                       | Confirms our 280ms ceiling; standardise one colour-only token                                                                                  | motion tokens                        |
| Zola / The Knot          | Named, dated testimonial + star row                                                                                                                                                                   | Social proof raises conversion                                                      | **Do not copy.** Fabricated reviews are forbidden and we have none                                                                             | —                                    |
| Eventbrite / Zola        | Cart, `Find my tickets`, ticket scarcity chips                                                                                                                                                        | Standard for ticketing                                                              | **Do not copy** — we are lead-gen, not transactions                                                                                            | —                                    |

### Reference-set integrity

Auditing the references changed the reference set, and the changes matter:

- **PartyBookr is a dead domain.** `partybookr.com` is a GoDaddy parked page — a 114-byte JS redirect
  to `/lander`, rendering `"partybookr.com is parked free"`. Every DOM field (headings, nav, cards,
  filters, type roles) is empty. **Dropped from the set.** The only lesson is negative: a lapsed domain
  serves ads at your old URL.
- **ShaadiSaga is hard-blocked, not a harness failure.** All three page types return Akamai's bare
  `Access Denied` edge page; DNS resolves but TLS fails. The `-error.png` files are the harness's blank
  white placeholder, byte-identical to `_probe.png` — they carry no information and are not evidence.
- **VenueLook is partial.** Its listing returns HTTP 200 with a listing `<title>` but serves a
  partner-acquisition page to headless browsers, and `/venues/delhi` is a soft-404 (200 + "URL not
  found"). Its card and filter design is **not** available.
- **Two original evidence files were invalid.** `wedmegood-desktop.png` was a _Real Wedding_ detail
  page, not the homepage, and `wedmegood-listing.png` was a 404 — both re-captured against the correct
  URL shape (`/vendors/<city>/wedding-venues/all/<category>/`, and the Delhi slug is `delhi-ncr`).
  `bookeventz-deep.png` was byte-identical to the blank probe, so it carries nothing; BookEventz's
  mobile shot is a city-picker overlay, so its mobile grid is unobserved.
- **The raw DOM dumps for sites 1–8 did not exist** — only screenshots did. They were regenerated
  through the existing harness, so refs 1–8 are now backed by real computed style rather than inference.

**Net: 13 sites genuinely auditable out of 15** — 12 fully or substantially, plus one partial.

**Responsive-evidence caveat:** both capture harnesses send a **desktop user-agent even at 390px**, so
any site that varies by UA renders its desktop layout in our "mobile" shots. Mobile evidence for sites
1–8 is therefore unreliable, and there is **no dark-mode, focus-state, reduced-motion or performance
evidence for any of the 15**. Do not treat our mobile reference claims as observed.

**The most important single finding:** **WedMeGood proves one font family is sufficient.** A single
custom sans carries its entire identity, and its listing `h1` is only **600 22px** while the card title
is ~**700 17px** — a _small_ scale in which weight and colour do the hierarchy. That independently
validates our Manrope-only constraint, and it is the opposite of the "bigger display type" instinct.
WeddingBazaar is the closest reference to our actual product.

**Not copyable, explicitly:** cart/checkout, ticket inventory and scarcity, every rating/review/follower
artefact, sponsored-placement disclosure, geo-forced content, video heroes, Tagvenue's 11 templated
all-city doorway rails, Cvent's demo-form-in-hero. Also three real accessibility defects observed in
references and not to be imitated: Cvent hides its H1 as a 1×1px element, MICEbook body text is
`rgb(119,119,119)` on white, Peerspace promotes card distance strings to H3.

**Reference limitations, stated honestly:** **ShaadiSaga blocked** all captures with an Akamai
`Access Denied` edge page — no design was inspectable. **Peerspace** returned 502 on all direct
captures; findings come from two Wayback captures and are labelled as such. **The Knot**'s listing and
mobile captures are PerimeterX interstitials; its DOM dumps were usable but flagged. **Cvent** has no
mobile evidence and no listing-card measurements (watchdog kill). All mega-menu panels on all 15 sites
were unobservable.

From the India set, and named individually because each is tempting:

- **Fabricated urgency.** Weddingz's mobile listing carries an amber band reading `18 Bookings done in
the last few days!` and `23 Customers liked, visited & looking forward to book the Venue`. We cannot
  know this and must not imply it.
- **Self-contradicting ratings.** WeddingBazaar renders `★ 4.5` **directly beside `No reviews yet`**;
  VenueLook shows `4.6 (0 reviews)`. This is the strongest possible argument for shipping **no star
  widget at all**, and substituting an honest trust line — WeddingWire's “Responds within 24h” is the
  non-review model to copy.
- **Discount-led interstitials.** VenueLook opens `Get Upto 30% Discount` as a modal on load; BookEventz
  runs `Enquire now & Get Upto 30% Off` plus a `₹0 Advance` badge; Weddingz promises `DISCOUNTS UPTO
30%`. We can guarantee no third-party discount, so we must not advertise one.
- **Uncredited stock imagery.** WeddingBazaar's hero carries no credit at all — a licensing risk. See
  §G: every asset records its source and licence.
- **SEO footer link farms** (Weddingz: 55 cities × 5 venue types × 4 vendor types), **3+ font families**
  (WeddingWire, Weddingz), **multi-hue accent stacks** (WeddingWire red + pink + amber + teal),
  **blocking modals** (“Need updates about new venues”), **ellipsis truncation in identity and location
  fields**, `alt="vendor-pic"` on every card image, city typos (`Gwallor`,
  `Mussoorie - Mussoorie`) and footer garble (`Find A Venue | Vendor`).

---

## C. Global design direction

**Intent** `[decision]`: a credible, warm, high-end Indian wedding marketplace. The emotional target is
_"these people are serious and this venue is real"_ — confidence through photography, generous spacing
and disciplined chrome, not through decoration.

**Authority** `[decision]`: `docs/frontend-styling-brief.md` governs. Manrope only; the pink palette
frozen; Mantine + CSS Modules; no Tailwind, no shadcn, no second component system; existing tokens
reused before new ones are invented.

**Skills ruled on** `[decision]`: `high-end-visual-design` was the largest conflict source and is
**mostly rejected** — its premium-font list, OLED-black and warm-cream palettes, bento/cascade
layouts, `rounded-[2rem]` double-bezel shells with inset shadows, `py-24`–`py-40` macro-whitespace,
uppercase tracking eyebrows, and above all its requirement that elements "never appear statically"
with 700ms curves. The brief caps motion at 280ms and forbids scroll reveals. Its one usable residue:
icons should be optically light (we already use Tabler at 1.5). `ui-ux-pro-max`'s `--design-system`
step was **skipped by design** — persisting its palette over a frozen contract would be a defect — but
its contrast, touch-target, reduced-motion and nav rules are the audit lens that surfaced A2, A5 and
A6. `frontend-design`'s "open with the most characteristic thing in the subject's world" is the
strongest independent confirmation of A1, and its warning against fade-up-every-section _vindicates_
the brief. `web-design-guidelines` passes almost everything; its Title Case rule is rejected in favour
of the brief's sentence case.

**Colour** `[decision]`: keep `#D6006E` / `#F25F97` and the warm plum neutral. The _budget_ is what
changes: chrome must stop being a full-bleed brand fill (A2). Target — neutrals ≥90%, ink ≤9%, primary
**≤4%**, accent ≤1.5%, semantics ≤3%.

**Typography** `[decision]`: keep Manrope; fix the ladder. Concrete moves — introduce a real step
between body and card title (15px → 17px) so tiles stop reading as body copy; normalise `h1` so
`/sign-in` is not 33.76 against 48 elsewhere; stop using `h2` for 13px footer labels; reduce display
weight from 800 and adopt size-scaled negative tracking with leading approaching 1.0 at display sizes;
retire uppercase tracked labels.

**Spacing / radius / elevation** `[decision]`: unchanged tokens. E0 (1px border, no shadow) stays the
resting default; E1 hover; E2 overlay; E3 top layer. Radius steps down as density rises
(4 / 8 / 12 / 14 / pill). No new tokens unless a component genuinely needs one.

**Imagery** `[decision]`: one aspect ratio, chosen once — the code renders **16:9** while the docs claim
3:2 and the seeded 3:2 assets are centre-cropped ~15%. **Keep 16:9** (venue interiors are landscape
subjects); correct the docs.

---

## D. Header and navigation specification

The two-tier shell stays; it becomes functional discovery rather than a coloured band.

1. **Chrome colour** `[decision]` — remove the full-bleed brand fill. The main bar becomes
   `--app-surface-raised` with a brand underline/rule on the active item; the utility strip stays a
   tinted neutral. This resolves A2 (AA failure and the ≤4% budget) without losing the pink identity.
   If the magenta bar is non-negotiable, then it must be proved at ≥4.5:1 in **both** themes using
   `--app-brand-contrast`, and the 22 hex literals must become tokens.
2. **Primary nav with real dropdowns** `[decision]` — Mantine `Menu`/`Popover` panels for all **eight**
   categories, fixing the four that are currently footer-only. Contents come from the existing
   catalogue; **no invented destinations**. Keyboard operable, Escape closes, outside-click closes,
   focus returns to the trigger, `aria-expanded` on the trigger.
3. **Location affordance** `[decision]` — a city control in the utility strip, wired to the existing
   `/vendors?location=` semantics. There is one today: zero.
4. **Mobile** `[decision]` — remove the misleading `>` chevrons on leaf links; expand categories in
   place or open a second level that actually exists; touch targets ≥44px.
5. **Search** `[decision]` — the header keeps its _link_ to `/vendors`, not a form, preserving the single
   `role="search"` landmark the E2E suite depends on.

---

## E. Homepage and page-section hierarchy

| Section              | Current                                | Plan                                                                                                                  | Priority |
| -------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Hero                 | Full-bleed Unsplash, no fallback (A12) | Keep the photograph idea, make it a real asset with a licence and a graceful fallback; apply the display-type changes | P1       |
| Search               | 3 fields + button                      | Keep semantics; adopt the mobile single-button pattern                                                                | P1       |
| Categories           | 7 tiles, generic                       | Use the new card family; ensure counts and copy are honest                                                            | P1       |
| Featured / listings  | 4 cards, placeholder art               | Real photography; consistent card anatomy; fix A4 truncation                                                          | **P0**   |
| Popular destinations | Text strip                             | Photography-led city tiles                                                                                            | P2       |
| Trust signals        | Factual bullets                        | Keep — they are honest. No fabricated reviews                                                                         | —        |
| CTA                  | Search button                          | One primary action per section                                                                                        | P2       |
| Footer               | 13px `h2` labels                       | Correct heading semantics and size                                                                                    | P2       |

Other routes: `/vendors` — fix the grid and the rail; `/categories/[slug]` — reconcile with
`/vendors?category=` (A11) rather than duplicating it; `/vendors/[slug]` — the profile must not lead
with one 1198×673 placeholder; `/enquire` and `/sign-in` — reclaim the dead space (A11).

---

## F. Component-by-component backlog

| #   | Component / route      | Problem                                                    | Proposed design                                                                      | Reference                       | Files                                                    | Depends on     | Functional risk                                              | Acceptance criteria                                                                                   | Pri    |
| --- | ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------- | -------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------ |
| 1   | Listing imagery (data) | A1 — 100% placeholder SVG                                  | Real photography, 16:9, licence recorded; quieten the placeholder register meanwhile | Peerspace, Tagvenue, ShaadiSaga | `prisma/seed-data/*`, `prisma/seed.ts`                   | image sourcing | None (data only)                                             | Zero placeholder covers on published listings; unique image per listing; alt text describes the venue | **P0** |
| 2   | Env failure path       | A3 — silent 200, empty body                                | Fail loudly: 500 + logged cause when server env is invalid                           | —                               | `src/lib/env.ts`, `src/app/api/**`                       | —              | Touches every route — must not break happy path              | Misconfigured env returns 5xx, never a 200 with an empty body; covered by a test                      | **P0** |
| 3   | `SiteHeader`           | A2 — AA failure in dark, ≤4% budget blown, 22 hex literals | De-fill the chrome; brand rule for active state; tokens only                         | Eventbrite, Cvent               | `SiteHeader.module.css`, `SiteHeader.tsx`, `globals.css` | —              | Nav labels are E2E-asserted — do not rename                  | Nav ≥4.5:1 both themes; primary fill ≤4%; no hex outside `src/theme`                                  | **P0** |
| 4   | Nav dropdowns          | A7 — 4 categories unreachable                              | Mantine Menu per category, real destinations only                                    | Zola, Eventbrite                | `HeaderNav.tsx`, `MobileNav.tsx`, `navigation.ts`        | —              | Must not add fake destinations                               | All 8 categories reachable; keyboard + Escape + outside-click; `aria-expanded` correct                | P1     |
| 5   | `ListingCard`          | A4 truncation, A5 ribbon                                   | Widen the dense track ~263→290px; add the mandated `title`; opaque ribbon ground     | Tagvenue, Peerspace             | `ListingCard.module.css`, `ListingCard.tsx`              | —              | **Must not break the E0/hover behaviour that already works** | No truncated price; `title` present; ribbon ≥4.5:1 over any image                                     | **P0** |
| 6   | Mobile filter sheet    | A6 — action off-screen                                     | Pin reset + "Show N results" to the bottom edge                                      | Tagvenue                        | `MobileFilterDrawer.*`                                   | —              | `dialog` role is E2E-asserted                                | Apply action visible without scrolling at 390×844                                                     | **P0** |
| 7   | Type ladder            | A8                                                         | 17px card-title step; normalise `h1`; footer heading semantics; size-scaled tracking | Peerspace, The Knot, Zola       | `globals.css`                                            | —              | Font sizes are not asserted                                  | No two roles share a size; sign-in h1 in range                                                        | P1     |
| 8   | Card family            | 4 hand-rolled systems + dead `ui/Card`                     | One family on `ListingCard`; venue / vendor / space / featured variants              | Tagvenue, Peerspace             | `src/components/listing/**`, `src/components/ui/Card.*`  | #5             | Dead code removal must not remove a live import              | One card implementation; dead `Card`/`Pagination` adopted or deleted                                  | P1     |
| 9   | Category routes        | A11 duplicate surfaces                                     | Merge `/categories/[slug]` into `/vendors?category=`                                 | —                               | `src/app/categories/**`                                  | #4             | **Routing change — must keep sitemap and E2E links valid**   | One canonical surface; redirects; E2E green                                                           | P2     |
| 10  | `ui/Pagination`        | Dead, documented                                           | Adopt in the grid or delete                                                          | —                               | `src/components/ui/Pagination.*`                         | #8             | Low                                                          | No orphan documented components                                                                       | P2     |
| 11  | Uppercase eyebrows     | A9 — 13 modules                                            | Sentence case at weight 650                                                          | —                               | 13 CSS modules                                           | —              | Copy changes are E2E-sensitive                               | No uppercase tracked labels remain                                                                    | P2     |
| 12  | `/enquire`, `/sign-in` | A11 dead space                                             | Rebalance the empty column                                                           | Zola                            | those routes                                             | #7             | Form semantics must not change                               | No page is >40% empty at 1440                                                                         | P2     |

---

## G. Image and demonstration-data strategy

`[decision]`

- **Subjects**: luxury Indian wedding venues, mandaps and ceremonies, banquet halls, destination
  resorts, hotel ballrooms, heritage and garden properties, receptions and decor, professional wedding
  photography, conference venues where relevant.
- **Ratio**: **16:9** everywhere, chosen once and documented. Focal point centre; `object-fit: cover`.
- **Licensing**: licensed stock or approved hosted assets. **No scraping** another site's collection.
  Every asset records its source and licence; the current hard-coded Unsplash URL (A12) is replaced by
  a recorded, local-first asset.
- **Responsive**: add `width`/`height` plus `sizes`, and `srcset` where the host supports it — currently
  absent on every listing image.
- **Fallback**: an on-brand, visually quiet placeholder for missing images in the _same_ 16:9 box, so a
  missing photo degrades quietly instead of showing a wireframe motif.
- **Demonstration data**: where real data is absent, seed plausible listings (e.g. a Jaipur heritage
  venue, a Goa destination resort, a Pune banquet hall, a Udaipur outdoor venue, a Mumbai photographer)
  and mark the dataset illustrative. Values must be internally consistent.
- **Never fabricated**: ratings, review counts, testimonials, verification badges, availability, or
  claims of real bookings. The product has no reviews, and that must not change for visual reasons.

---

## H. Animation specification

`[decision]` — the sequence the brief prescribes: `find-animation-opportunities` → `improve-animations`
→ `animate` → `review-animations`, with `emil-design-eng` and `apple-design` as the craft reference.

Existing tokens are the contract: instant 0ms, micro 90ms, fast 140ms, base 200ms, slow 280ms, exit
140ms; `ease-out` in, `ease-in-out` for state, `ease-in` out. Nothing exceeds 280ms.

**Where motion helps**: dropdown open/close (base in, exit out); button hover/active (micro); a small
image treatment on card hover — _only_ opacity/border, no scale, since every reference card measured
`transform: none`; gallery transitions (base); filter-state change feedback (fast); skeleton shimmer
(existing); layout shift signalling when a filter applies.

**Where it does not**: continuous decoration, parallax, bounces, page-load stagger, scroll reveals,
animating numbers, animating focus rings, animating card scale or translate. The audit confirms we
currently violate none of these — the risk is the _new_ skills adding them.

**Required**: every animation has a `prefers-reduced-motion` branch; state-carrying motion survives,
position-carrying motion goes.

---

## I. Verification plan

Run in this order, after each increment, and unconditionally at the end.

1. **Static**: `prettier --check .`, `eslint .`, `tsc --noEmit` — all must be 0.
2. **Build**: `rm -rf .next && next build` → 58/58 with no errors or warnings.
3. **Unit/integration**: `vitest run` → target 612/612. The 3 current failures are timeouts; fix the
   component project's timeout or serialise the projects (**P2-1**) and re-verify honestly.
4. **Browser**: `playwright test` → re-establish the true count. **The historical 222 is unverified.**
5. **Accessibility**: `accessibility` skill pass for WCAG 2.2 AA — contrast in both themes, keyboard
   traversal, focus visibility, accessible names, image alt text, reduced motion.
6. **Visual QA**: re-capture at **1440 / 768 / 390 in both themes** and diff against the `head-*`
   baselines. Check overflow, broken grids, cropped text, misaligned controls, contrast, spacing,
   image loading, sticky-header conflicts, dropdown clipping, console errors.
7. **Design detector**: run `impeccable detect --json` over changed targets once, after the work.
8. **Docs**: update `docs/design-system.md` to the pink palette and the real component rules — it
   currently documents blue, a 3:2 card, and a resting shadow the code does not paint.

**Definition of done**: premium and distinctive; existing functionality intact; dropdowns functional;
cards use real photography; demonstration data realistic and labelled; responsive verified;
motion restrained and accessible; build and suites run; remaining failures documented; docs match
code; before/after screenshots captured.

---

## Recommended execution order

**Phase 3a — stop the bleeding (P0)**: A3 env failure path · A5 ribbon contrast · A4 price truncation ·
A6 mobile filter action · A2 header contrast and hex literals. These are small, high-severity and do
not depend on imagery.

**Phase 3b — the thing that actually matters (P0)**: photography. No amount of component polish
survives twelve placeholder motifs.

**Phase 3c — discovery (P1)**: dropdown navigation with real destinations; the type ladder; the unified
card family.

**Phase 3d — polish (P1/P2)**: motion pass, route consolidation, dead component cleanup, eyebrow
casing, page rebalancing, docs.

---

**Awaiting approval before Phase Three.** Two decisions are needed from you:

1. **Header treatment** — de-fill the magenta chrome for a neutral bar with pink accents (my
   recommendation: it fixes the AA failure and the budget in one move), or keep the full magenta bar
   and accept a scoped exception that must then be proved at 4.5:1 in both themes?
2. **Photography source** — do you have licensed wedding/venue imagery, should I source licensed stock,
   or should I seed high-quality open-licensed photography and label the dataset illustrative?
