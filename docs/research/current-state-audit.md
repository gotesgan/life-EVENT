# Live Envt — current-state visual audit

**Purpose:** establish an honest baseline of what the product looks like today, so a premium redesign can be
planned against evidence rather than impressions.

**Status:** read-only audit. No application source, token, or content was modified. The only writes are this
document and 49 new screenshots in `docs/research/shots/`.

**Date of capture:** build `rearWaUvn1dO6iCxlYJDc` (see the staleness warning in §1.2).

---

## 1. Method and limits

### 1.1 What I ran

| Step            | Detail                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build served    | `npx next start -p 3300` against the existing `.next` (no rebuild), env per the brief with one correction (below)                                                         |
| Browser         | Playwright 1.64.1 + Chromium 1248, `PLAYWRIGHT_BROWSERS_PATH=/tmp/liveenvt-cache/ms-playwright` (Chromium was **not** installed; I ran `npx playwright install chromium`) |
| Screenshots     | 7 pages × 3 viewports (1440/768/390) × 2 themes = **42**, plus 7 state shots                                                                                              |
| Themes          | Applied via the real mechanism: cookie + `localStorage` key `liveenvt-color-scheme`, verified against `data-mantine-color-scheme` on `<html>` in every capture            |
| Measurements    | Playwright DOM probe (`getComputedStyle`, `getBoundingClientRect`, `scrollWidth` vs `clientWidth`, `naturalWidth`) on 10 page/viewport combinations                       |
| Contrast        | Computed from sampled pixels of element-level screenshots (WCAG 2.1 relative luminance), plus computed-style colours                                                      |
| Colour coverage | Whole-page pixel classification (HSV) over the captured PNGs                                                                                                              |
| Code audit      | `grep` for hex literals, `TODO`s, `text-transform`, `transition: all`, `box-shadow`, duplication, dead exports                                                            |

**One correction to the supplied command.** `IP_HASH_SALT='audit-ip-salt'` is 13 characters; `src/lib/env.ts`
requires ≥16 in production, so **every request failed** with `Error: failed to pipe response … IP_HASH_SALT must be
set to a unique random value of at least 16 characters`. The symptom was a `200` with a zero-byte body — a server
that looks up and serves nothing. I restarted with `IP_HASH_SALT='audit-ip-salt-0123456789abcdef'`. Anyone
re-running this should use a ≥16-char salt; the literal command in the brief does not work.

### 1.2 Limits — read these before trusting any screenshot

1. **The production build is stale relative to `src/`.** `.next/BUILD_ID` is dated **Oct 15 12:29:21**; six source
   files are newer:

   ```
   src/app/page.tsx                       13:10:45
   src/components/layout/HomeHero.module.css  13:09:41
   src/components/layout/HomeHero.tsx     13:09:22
   src/components/filters/FilterControl.tsx   12:36:06
   src/components/admin/listing-editor/ListingEditor.tsx  12:35:45
   src/components/admin/EnquiryCells.tsx  12:35:45
   ```

   Consequence: the home hero in the screenshots says _"Find the right vendor, with the price on the page."_ with
   three checkmark facts and **no image**, whereas `src/app/page.tsx:166-171` now renders _"Your wedding, your
   way."_, two facts, and a full-bleed Unsplash photograph. **The screenshots are the deployed artifact, not
   `HEAD`.** I did not rebuild, per instruction. Every home-hero claim below is about the built artifact; the
   `HomeHero.module.css` analysis (§3.11) is about the source.

2. **I could not reach a genuine zero-result empty state.** The seeded data (21 listings, 5 cities) never produced
   "valid filters, no matches". The invalid-value path _is_ designed and good (§4.4). I therefore make no claim
   about the true empty state.
3. **Loading states were not captured as screenshots.** They are Suspense/skeleton paths; I verified the skeleton
   CSS and its reduced-motion branch by reading source, not by screenshotting an in-flight transition.
4. **Hover/focus/motion were evaluated from computed style and code**, with one screenshot each for focus and
   hover.
5. **The admin surface was not screenshotted** — it is behind auth and outside the seven pages requested.
6. **Contrast figures for text over imagery are sampled, not exhaustive.** Where a label sits on a photograph I
   sampled three instances and report the range.
7. **`docs/design-system.md` cannot be used as the authority it claims to be.** It documents a blue/slate palette
   that does not exist in the shipped tokens (§3.13). I treated `src/theme/tokens.ts` and the running CSS as
   ground truth.

### 1.3 A documentation conflict that changes the brief itself

`docs/frontend-styling-brief.md:20` and `docs/design-system.md:42` describe the action colour as **"a deep action
blue on a cool slate neutral"**. The shipped palette is **pink/magenta on a warm plum neutral**:

```
tokens.ts:49   brand[6] = #D6006E    (light action colour)
tokens.ts:177  --app-surface  = #FFF7F9
tokens.ts:186  --app-border   = #F0D8E1
tokens.ts:80   plum ramp (not "slate")
```

Runtime confirms it: `--app-brand: rgb(214,0,110)`, `--app-surface: #FFF7F9`.

**Ruling:** the pink/magenta family is the design authority, as the task states. The prose in both docs is stale
and must be corrected before a redesign brief is written — otherwise the team designs against a blue palette the
product does not have.

---

## 2. Baseline screenshot index

All files in `docs/research/shots/`. Naming: `baseline-<page>-<viewport>-<theme>.png`.

| Page          | Path                                       | 1440 | 768 | 390 | What it shows                                                                                                                       |
| ------------- | ------------------------------------------ | ---- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Home          | `/`                                        | L/D  | L/D | L/D | Hero (text-only in this build), hero search panel, 7 text-only category tiles, city chips, 4 verified cards, 3 "how it works" cards |
| Browse        | `/vendors`                                 | L/D  | L/D | L/D | Filter rail + 3-col grid of 12 cards, 2 pages, sort bar                                                                             |
| Category      | `/categories/venues`                       | L/D  | L/D | L/D | Nested "Venues listings" panel inside a page-level filter rail; 4 cards then empty space                                            |
| Profile       | `/vendors/the-sandalwood-grand`            | L/D  | L/D | L/D | Full-bleed placeholder hero 1198×673, thumbnail strip, facts table, sticky contact rail, 6 sections                                 |
| Enquiry       | `/enquire`                                 | L/D  | L/D | L/D | Two half-width cards, pink-tinted optional block, consent, submit                                                                   |
| Sign-in       | `/sign-in`                                 | L/D  | L/D | L/D | 460px centred card on an empty pink field, amber top rule                                                                           |
| Filtered      | `/vendors?category=venues&location=mumbai` | L/D  | L/D | L/D | 1 active-filter chip, 3 results, rail as tall as the page                                                                           |
| **States**    | —                                          |      |     |     |                                                                                                                                     |
| Empty/error   | `state-empty-1440-light.png`               | ✓    |     |     | Invalid location → designed error panel                                                                                             |
| Focus         | `state-focus-1440-light.png`               | ✓    |     |     | Focus ring on a card action                                                                                                         |
| Hover         | `state-hover-1440-light.png`               | ✓    |     |     | Card E1 lift on hover                                                                                                               |
| Mobile filter | `state-mobile-filter-390-light.png`        |      |     | ✓   | Filter sheet open; **no apply affordance visible**                                                                                  |
| Mobile nav    | `state-mobile-nav-390-light.png`           |      |     | ✓   | Drawer with `>` chevrons on leaf links                                                                                              |
| Nav hover     | `state-navhover-1440-light.png`            | ✓    |     |     | Header after hovering "All categories" — no dropdown                                                                                |
| No results    | `state-no-results-1440-light.png`          | ✓    |     |     | `/vendors?category=venues&location=pune` — 1 incidental match, **not** a true empty state                                           |

`docs/research/shots/_capture-report.json` records per-shot `bodyH`, `bodyW`, `articles`, `imgs`, resolved scheme,
and any console errors — all 42 captured clean, no console errors, no failed requests.

---

## 3. Visual diagnosis, ranked

Format: **what is wrong → evidence → why it matters → severity → visual or functional.**

### 3.1 All listing imagery is generated placeholder art. There is no photography anywhere. — CRITICAL

Every `<img>` on the browse grid is `/media/seed/<slug>-cover.svg`:

```
src: /media/seed/smriti-frame-studios-cover.svg
alt: "Abstract placeholder cover for Smriti Frame Studios"
natural: 1200x800   rendered box: 287x162
```

This is not a fallback firing by accident — the database media **is** the placeholder set:

```sql
-- listing_media for the-sandalwood-grand / gulmohar-banjara-banquets
kind=IMAGE  status=READY  publicUrl=/media/seed/the-sandalwood-grand-cover.svg
                          publicUrl=/media/seed/the-sandalwood-grand-gallery-2.svg
                          publicUrl=/media/seed/the-sandalwood-grand-gallery-3.svg
```

The SVG itself is a two-stop gradient plus 4–6 stroked gold shapes (`#E5C073` strokes, `stroke-width: 14`:

```svg
<rect width="1200" height="800" fill="url(#grad-d74c02fb)" />
<g opacity="0.62"><rect x="300" y="21.71" width="104" height="558.29" rx="52" stroke="#E5C073" stroke-width="14"/></g>
```

A 12-tile grid therefore renders **four distinct compositions** (concentric rings, arched tubes, an envelope,
botanical stems, bar-chart columns) recoloured across pink, mauve, gold and sage grounds. See
`baseline-vendors-1440-light.png`: cards 1/5 are the same ring motif, cards 2/3/4/10/11 are the same arch motif,
cards 7/9 the same column motif. A wedding marketplace bought on photography currently reads as a **wireframe
with finished typography**.

The profile amplifies it catastrophically: `baseline-vendor-profile-1440-light.png` renders one motif at
**1198×673** — a single abstract gold arch scaled 6× occupying ~75% of the first viewport.

Image attributes are also incomplete: `width` and `height` are **absent** (`null`), as are `sizes` and `srcset`
(measured). `loading="lazy"` is correctly applied below the fold — the blank tiles at the bottom of
`baseline-vendors-390-light.png` are a full-page-screenshot artifact of lazy loading (`naturalWidth: 0`,
`complete: false`), not a rendering bug. Space is correctly reserved, so there is no layout shift.

**Why it matters:** this is the single highest-leverage premium lever and it is not a design problem. A team that
spends the redesign budget on typography and spacing while leaving this untouched will ship a very tidy wireframe.
**Severity: critical. Type: content/data problem with a visual consequence** — the fix is real imagery, not a
component rewrite. The _design_ follow-up is to decide the placeholder register so a photo-less grid does not
pretend to be a photo grid.

### 3.2 The header paints the action colour at full bleed, blowing the palette budget and failing AA in dark mode — CRITICAL

`src/components/layout/SiteHeader.module.css:31,39`:

```css
.header {
  background-color: var(--app-brand);
} /* #D6006E */
.utilityBar {
  background-color: var(--mantine-color-brand-8);
} /* #850046 */
```

Measured bars: utility **36px** `rgb(133,0,70)`, main **64px** `rgb(214,0,110)`, both full width, in **both**
themes.

Violation of the project's own rule — `frontend-styling-brief.md:52`: _"`--app-primary` is for actions only. Never
a badge, heading, border or decorative fill. Budget: at most one primary fill per card and per page section,
≤4% of painted area."_

Chrome arithmetic on `/vendors` at 1440 (exact, from measured geometry and page height 2652):

- two header bars: 100 × 1440 = 144,000 → **3.77%**
- 12 × "Send enquiry" buttons: 12 × (263 × 40) = 126,240 → **3.31%**
- **primary fills alone ≈ 7.1%** — ~1.8× the stated ceiling, before any pink badge, pill or border.

Whole-page magenta-hue pixel share (upper bound; includes pink-toned placeholder motifs):

| Screenshot                                 | magenta/pink | amber |
| ------------------------------------------ | ------------ | ----- |
| `baseline-vendors-1440-light.png`          | **12.69%**   | 4.16% |
| `baseline-vendors-1440-dark.png`           | **19.04%**   | 4.25% |
| `baseline-vendors-390-light.png`           | **17.82%**   | 5.39% |
| `baseline-sign-in-1440-light.png`          | 8.37%        | 0.07% |
| `baseline-home-1440-light.png`             | 6.36%        | 1.79% |
| `baseline-vendors-filtered-1440-light.png` | 4.48%        | 0.75% |

The file's own comment (`SiteHeader.module.css:1-8`) asserts this is _"the only place the brand colour is used at
full bleed"_ and calls it deliberate. The brief grants no such exception.

**And it fails contrast in dark mode.** The nav text is hard-coded white while `--app-brand` inverts in dark:

| Theme | nav text           | bar background    | ratio      | WCAG AA (14px/700)     |
| ----- | ------------------ | ----------------- | ---------- | ---------------------- |
| light | `rgb(255,255,255)` | `rgb(214,0,110)`  | **5.14:1** | pass                   |
| dark  | `rgb(255,255,255)` | `rgb(242,95,151)` | **3.06:1** | **FAIL** (needs 4.5:1) |

At 14px/700 this is normal text, not large text, so 4.5:1 applies. See `baseline-vendors-1440-dark.png` — the
bright pink main bar with white links. The fix Mantine's own `autoContrast` mechanism exists to prevent
(`theme.ts` `luminanceThreshold: 0.22`) is bypassed here because the colour is hard-coded.

Related token breach: **exactly 28 hex literals exist outside `src/theme/`, and all 28 are in these two layout
files.** `SiteHeader.module.css` contains **22 × `#ffffff`** on lines
`40,58,80,92,123,128,173,180,186,208,232,237,242,250,260,268,272,273,277,287,291,300`. The remaining 132 hex
matches in `src` are inside `src/theme/` (`tokens.ts` 124, `theme.ts` 8) and are legitimate.
`frontend-styling-brief.md:30` says _"never write a hex literal outside `src/theme`"_; rule 4 says _"never
hard-code white text on a coloured button."_ Every violation of that rule in the repo is in the header.

Also visible in `baseline-vendors-1440-dark.png`: the utility strip stays `#850046` in dark mode (the Mantine
brand ramp is scheme-independent) while the main bar inverts to `#F25F97`, producing a two-tone seam with no
stated rationale.

**Severity: critical** (contrast failure, measured) **/ major** (budget). **Type: visual + accessibility**, caused
by one file choosing literal white over the token layer.

### 3.3 The desktop grid truncates the price on 8 of 12 cards, and the truncation is unrecoverable — MAJOR

`src/components/listing/ListingCard.module.css:199-211` sets the scan-anchor row to `white-space: nowrap` +
`text-overflow: ellipsis`. Measured at 1440:

| Card | Text                               | needs | has | clipped | `title` attr |
| ---- | ---------------------------------- | ----- | --- | ------- | ------------ |
| 0    | ₹1,20,000 – ₹4,50,000 per event    | 277   | 263 | ✓       | **null**     |
| 1    | ₹12,00,000 – ₹45,00,000 per event  | 299   | 263 | ✓       | **null**     |
| 2    | ₹6,50,000 – ₹18,00,000 per event   | 288   | 263 | ✓       | **null**     |
| 3    | ₹18,000 – ₹2,40,000 per package    | 284   | 263 | ✓       | **null**     |
| 4    | ₹2,50,000 – ₹15,00,000 per package | 311   | 263 | ✓       | **null**     |
| 7    | ₹1,50,000 – ₹8,50,000 per event    | 277   | 263 | ✓       | **null**     |
| 8    | ₹1,80,000 – ₹12,00,000 per event   | 288   | 263 | ✓       | **null**     |

Rendered as `₹1,20,000 – ₹4,50,000 per ev…` and `₹6,50,000 – ₹18,00,000 per e…` in
`baseline-vendors-1440-light.png`. The only information destroyed is **the unit** — "per event" vs "per package"
vs "per plate" — which is the field that makes two prices comparable at all.

At 768 and 390 the same cards show the full string (`baseline-vendors-768-light.png`) — **the defect exists only
in the 3-column desktop grid**, i.e. the column is ~30px too narrow for the content it was designed around.

`frontend-styling-brief.md:128` already prescribes the remedy: _"prices and cities truncate with a title attribute
rather than wrapping."_ The `title` attribute is missing on every card, so the text is lost rather than deferred.
One metadata row is clipped too ("Wedding Planners · Bandra West", 197 > 182).

**Severity: major. Type: visual + content-handling.**

### 3.4 The primary nav has no dropdown and four of nine categories are unreachable from the header — MAJOR

`src/components/layout/navigation.ts:14-21` — `PRIMARY_NAV` is six flat links:

```
All vendors · Venues · Photography & Film · Planning & Decor · Catering · All categories
```

`FOOTER_CATEGORIES` (`navigation.ts:24-33`) lists **eight** categories. **Beauty & Styling, Entertainment,
Invitations & Gifts and Rentals & Transport have no header entry point**, no mega-menu and no flyout. Measured:
`navDropdowns = 0`; zero `[role=menu]`/`[aria-haspopup]` elements in the header. Hovering "All categories" opens
nothing (`state-navhover-1440-light.png`).

The mobile drawer makes this worse by _promising_ depth it does not have: `MobileNav.tsx:43` attaches
`<IconChevronRight/>` as `rightSection` to every item, but each is a plain leaf `NavLink` with an `href`
(`MobileNav.tsx:37-43`). Every row in `state-mobile-nav-390-light.png` shows a `>` chevron that implies a
submenu; tapping navigates instead.

There is also **no location affordance in the header** — no current-city selector anywhere in the chrome, despite
`/cities/[slug]` existing and the browse rail treating city as a first-class filter.

**Why it matters:** a marketplace's header is its discovery spine. Four of nine inventory classes are reachable
only by scrolling to the footer or finding "All categories", and the mobile menu teaches users that chevrons are
decorative. **Severity: major. Type: functional/IA** (the routes work; the discovery path is missing).

### 3.5 The mobile filter sheet's primary action is off-screen when it opens — MAJOR

`state-mobile-filter-390-light.png`: tapping "Filters" on a 390px viewport opens a dialog **620px tall**
(y 216→836) whose content is **828px** — scrollable — containing Category, City, Event type (8 checkboxes +
"Show 1 more"), Budget, Guests, two toggles, three Amenity groups, and seven venue-specific groups.

Measured position of the sheet's primary action:

```
button "Show 17 results":   width 258, height 36
                            top = 1004, bottom = 1040   (viewport height 844)
                            inViewport = false
                            position: sticky
```

`position: sticky` is set but the button still sits at y=1004 — **160px below the bottom of the viewport and
168px below the dialog's own bottom edge**. A user opening the filter sheet sees no way to apply or dismiss-with-
intent; they must discover that the sheet scrolls, then scroll past roughly two screens of controls. "Reset"
(74×36) is adjacent and equally off-screen.

**Severity: major. Type: functional/UX on the highest-traffic mobile flow.** The fix is layout (pin the action
bar to the sheet edge), not a rewrite.

### 3.6 The "Featured" ribbon is unreadable over imagery — measured 1.25:1 to 3.52:1 — MAJOR

`ListingCard.module.css:52-66` gives the ribbon a **translucent** ground:

```css
.ribbon {
  background-color: var(--app-accent-soft); /* rgba(168, 95, 10, 0.12) */
  color: var(--app-accent-soft-text);
} /* #7A4405 */
```

Because the tint is 12% opacity it composites to nothing over an image, so a dark-brown label lands directly on
photography. Element-level screenshots of the three ribbons on `/vendors` at 1440:

| Card                      | ground sampled                  | label           | contrast   |
| ------------------------- | ------------------------------- | --------------- | ---------- |
| Smriti Frame Studios      | `rgb(186,151,88)` (gold motif)  | `rgb(122,68,5)` | **2.88:1** |
| The Sandalwood Grand      | `rgb(124,84,91)` (plum motif)   | `rgb(122,68,5)` | **1.25:1** |
| Gulmohar Banjara Banquets | `rgb(208,166,102)` (gold motif) | `rgb(122,68,5)` | **3.52:1** |

All three fail the 4.5:1 text floor; the worst is 1.25:1, i.e. effectively invisible. This contradicts the file's
own comment three lines above (`ListingCard.module.css:48-51`): _"Overlay chips sit on a photograph, so they take
an opaque surface rather than `--app-overlay`."_ The sibling `.photoCount` chip **does** use an opaque
`--app-surface-raised` (`:76-78`) and is perfectly legible. `.ribbon` is the one that did not follow the rule.

**Severity: major. Type: visual + accessibility** (WCAG 1.4.3).

### 3.7 The type hierarchy collapses at the bottom, and the same level renders at different sizes per page — MAJOR

Measured computed sizes (`getComputedStyle`, Manrope confirmed as the resolved family everywhere):

| Element     | Home         | Browse   | Profile      | Category    | Enquiry         | Sign-in         |
| ----------- | ------------ | -------- | ------------ | ----------- | --------------- | --------------- |
| `h1`        | **64px**/800 | 48px/750 | 48px/750     | 48px/750    | 48px/750        | **33.76px**/720 |
| `h2`        | 33.76px/720  | —        | 33.76px/720  | 33.76px/720 | **22.64px**/700 | —               |
| `h3`        | **15px**/650 | 17px/700 | **15px**/700 | 17px/700    | —               | —               |
| body        | 15px/450     | 15px/450 | 15px/450     | 15px/450    | 15px/450        | 15px/450        |
| footer `h2` | **13px**/650 | 13px/650 | —            | 13px/650    | 13px/650        | 13px/650        |

Three distinct problems:

1. **The bottom of the ladder collapses.** Category tiles (`h3` 15px/650), package names ("Grand reception",
   "Intimate anniversary"), service names ("Ballroom wedding", "Rooftop cocktail") and space names are all
   **15px** — the _same size as body copy_, separated only by weight. The documented `--text-card-title` role is
   17px/700; the profile's package cards do not use it. At 15px/650 vs 15px/450 a package name reads as a bold
   paragraph, not a title.
2. **`h1` is inconsistent.** Sign-in's primary heading is **33.76px** — the size every other page uses for `h2`.
   The page you land on to sign in is typeset quieter than the page you land on to browse.
3. **Footer column labels are `h2` at 13px**, smaller than the `h3`s above them: the document outline grows
   quieter as its level rises. `design-system.md:649` claims `PageHeader` "owns the single `<h1>`" and that
   `SectionHeading` defaults to `h2`; the footer reuses `h2` for 13px labels.

To be fair to the top end: the display/h1/h2 steps are genuinely well built (real variable weights 800/750/720,
negative tracking −0.03em/−0.025em/−0.02em, `text-wrap: balance`). The failure is entirely below 20px.

**Severity: major. Type: visual.** No new typeface is needed — size and weight only.

### 3.8 Uppercase letter-spaced labels in 13 modules contradict the brief's own label rule — MINOR–MAJOR

`frontend-styling-brief.md:84`: _"Uppercase is not a label treatment here — labels are sentence case at weight
650."_ `grep -rn text-transform src --include=*.css` returns **13 files** using it:

```
ui/PageHeader.module.css:26,82      ui/SectionHeading.module.css:23     ui/DataTable.module.css:46
layout/MobileNav.module.css:25      listing/ListingContactCard.module.css:63
listing/ListingFacts.module.css:24  listing/AttributeList.module.css:17
admin/{FilterBar,Audit,AdminShell×2,Enquiries}.module.css
```

The eyebrow is the most visible instance — `PageHeader.module.css:78-83`:

```css
.eyebrow {
  font-size: var(--text-label-size);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-accent);
}
```

rendering as **"4 PUBLISHED LISTINGS"** above "Venues" (`baseline-categories-venues-1440-light.png`). This is a
template tell and it also spends the accent colour on a decorative label, against
`frontend-styling-brief.md:54` ("Accent is a line or a glyph, never a large fill" — a label is neither, and the
budget is 1.5%). `state-mobile-nav-390-light.png` shows three more: BROWSE / LIVE ENVT / LEGAL.

**Severity: minor–major. Type: visual.** Cheap to fix, and it is one of the few places where the loaded skills and
this brief agree (§6).

### 3.9 Two documented primitives are dead, and the dead one violates E0 — MINOR (code/visual drift)

`design-system.md:664-679` documents `Card` (with `CardHeader/Body/Footer/Media/Title`) and `Pagination` as the
composable API. Measured import sites:

```
components/ui/Card'         -> 0
components/ui/CardTitle'    -> 0
components/ui/Pagination'   -> 0
components/ui/Surface'      -> 5
components/ui/EmptyState'   -> 4
```

Meanwhile the surfaces people actually see are hand-rolled: `listing/ListingCard.module.css`,
`listing/CategoryCard.module.css`, `admin/StatTile.module.css`, `listing/ListingContactCard.module.css`,
`listing/PackageList.module.css`, `listing/SpaceList.module.css`, `listing/ServiceList.module.css` — and pagination
is reimplemented at `filters/ResultsPagination.tsx`. Two search bars also coexist
(`filters/SearchBar.tsx`, `filters/HeroSearchBar.tsx`).

Crucially, **the dead `Card` is the one that breaks the elevation contract**: `Card.module.css:28-31` applies
`box-shadow: var(--app-shadow-raised)` on a resting hovered card and `:37` again on `focus-within`, whereas the
live `ListingCard.module.css:23` correctly sets `box-shadow: none` (E0). So the documented primitive is both unused
and wrong, and the shipped card is both undocumented-in-practice and right.

`design-system.md:561-563` also asserts that `ListingCard` _"still paints `--app-shadow-card` on a resting card,
which contradicts E0"_ — that is now false; it was fixed. The docs are drifting in both directions.

**Severity: minor. Type: code organisation / future-bug risk.**

### 3.10 The filter rail is a wall, the results are a row, and two surfaces are near-duplicates — MAJOR

`baseline-categories-venues-1440-light.png` and `baseline-vendors-filtered-1440-light.png`: the left rail runs
**~1,700px** — Category, City, Event type (8 + "Show 1 more"), Budget min/max, Guests at-least/at-most, two
toggles, Amenities split into Entertainment / Facilities / Guest comfort, then a whole second group of
venue-specific filters: Guest capacity, Venue type (7 checkboxes), Indoor/outdoor, Catering policy, On-site
accommodation, Parking capacity, Number of event spaces. The results beside it are **3–4 cards in a single row**,
followed by a large empty field. On the filtered page the whole document is 3,517px tall for three results, of
which the first 1,700px is controls.

Three separate issues inside that:

- **No containment or summary.** Nothing is sticky, nothing collapses, there is no "clear all" inside the rail and
  no count of what is active per group. The only clear-all lives in the results toolbar as a chip.
- **The active-filter count is wrong.** `/vendors?category=venues&location=mumbai` reports **"1 active filter"**
  for **two** applied parameters; `category` is absorbed into the page identity instead.
- **`/categories/venues` and `/vendors?category=venues` are effectively the same page** — same rail, same grid,
  same cards, different `PageHeader`. Two routes to maintain, one experience.

**Severity: major. Type: visual + IA.**

### 3.11 Whitespace imbalance: the home hero has no image in this build, the form pages are half empty

- `/enquire` (`baseline-enquire-1440-light.png`): the entire form stack is **~630px of a 1440px canvas**; ~55% of
  the page is empty margin, with no summary rail, no vendor recap, no reassurance column. The optional "About your
  event" block is a large `--app-brand-soft` pink rectangle (~600×400) — a big brand fill used as a grouping
  device.
- `/sign-in` (`baseline-sign-in-1440-light.png`): a single 460px card on an otherwise empty pink field. The card
  carries a 2–3px amber rule across its top — the only accent element, and the only decorative flourish on the page.
- `/` (`baseline-home-1440-light.png`): hero is **brand mark → h1 → lede → three check facts → pink search panel**,
  no image at all in the built artifact. `HomeHero.tsx:35-49` shows the design _intends_ a photo: with `imageUrl`
  it renders a `fill` `next/image` plus a dark overlay; without it, it falls back to a `.glow` radial and light
  text via `.hero:not(:has(.photo))`. `src/app/page.tsx:166-170` now passes an Unsplash URL — **so the photo variant
  is one line of source ahead of this build.**
- `HomeHero.module.css` still carries 6 hex literals (`:5 #1a1214`, `:101 #7ddf9a`, and 4 × `#fff` at
  `:53,114,130,137`) and a
  `:115 box-shadow: 0 20px 60px rgb(0 0 0 / 35%)` on `.searchCard` — a 60px 35%-black shadow on a resting element,
  against `sharedTokens` E0/E1 (E1 is `0 2px 8px -3px … 10%`). The dark hero path is unreachable in this build, so
  the shadow may not render — but the rule is live in the file and will render the moment a hero image is supplied.
  **This is a latent contradiction with the elevation contract, not a current visual defect** — flagging it as such.

### 3.12 Mobile home is 5,867px long and mostly text — MINOR

`baseline-home-390-light.png`: 7 stacked text-only category cards (each title + "N listings" + a description),
then 5 city chips across two rows, then 4 stacked listing cards, then three "How Live Envt works" cards, then a
single-column footer. Height **5,867px** against 2,909px on desktop. The category tiles carry **no imagery and no
differentiation** beyond a title, a count and one sentence; stacked seven deep on a phone they are the weakest
content in the product.

### 3.13 Motion: correct but nearly absent — this is a _success_, not a defect

Whole-app motion inventory (`grep @keyframes / animation:`):

- **2 keyframes total**: `listingShimmer` (1.2s linear, skeleton, `ListingResultsSkeleton.module.css:107,111`) and
  `resultIn` (200ms entering, `EnquiryForm.module.css:320,437`).
- **15 CSS modules** declare `transition:`; **zero** use `transition: all` (verified by grep).
- **`prefers-reduced-motion`** handled globally in `globals.css:424` plus 8 component-level overrides
  (`FilterChip`, `Button`, `Inputs`, `Card`, `Pagination`, `ListingResultsSkeleton`, `ListingCard`, `EnquiryForm`).
- Card hover measured: `box-shadow: rgba(28,20,22,.06) 0 1px 2px, rgba(28,20,22,.10) 0 2px 8px -3px` (E1) and
  `border-color: rgb(154,112,132)` (`--app-border-strong`) — exactly the documented E0→E1 rule, with no scale or
  translate.
- Focus measured on a card action: `outline: rgb(214,0,110) solid 2px; outline-offset: 2px`.

Two honest caveats: the focus ring is the **same colour as the fill it surrounds** (`--app-focus-ring` =
`--app-brand` = `#D6006E`, ratio 1.00:1 against the button). It works only because `outline-offset: 2px` places it
over the white card. `design-system.md:627-628` acknowledges this and it is a deliberate tradeoff — but it means
the ring carries no contrast against the control it marks, and any future surface change could break it.

A stale comment: `HeaderNav.tsx:19` says "a 2px brand indicator"; `SiteHeader.module.css:205` sets
`height: rem(3px)` and `background-color: #ffffff` (not brand).

### 3.14 Stale documentation — MAJOR for the planning phase

The two documents the redesign will be planned against do not describe the shipped product:

| Claim                                      | Document                                                       | Reality                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Action colour is blue `#1F5EDC`            | `design-system.md:134,231,622`; `frontend-styling-brief.md:20` | `#D6006E` pink (`tokens.ts:49`, `:197`)                                                                                  |
| Neutral is `slate`, `#F7F8FA` canvas       | `design-system.md:136,221`                                     | `plum` ramp, `#FFF7F9` canvas (`tokens.ts:80,177`)                                                                       |
| `--app-border-strong` `#737D8D`            | `design-system.md:227`                                         | `#9A7084` (`tokens.ts:187`)                                                                                              |
| Card media is **3:2**                      | `design-system.md:721`                                         | measured **`aspect-ratio: 16 / 9`** (287×162 = 1.778)                                                                    |
| `--text-anchor` has no consumer            | `design-system.md:463`                                         | consumed at `ListingCard.module.css:204`                                                                                 |
| No component consumes motion tokens        | `design-system.md:597`                                         | consumed in `ListingCard`, `Button`, `Card`, `FilterChip`                                                                |
| `ListingCard` paints a resting shadow      | `design-system.md:561`                                         | `ListingCard.module.css:23` is `box-shadow: none`                                                                        |
| 3:2 landscape ratio owned by `AspectImage` | `design-system.md:57-59`                                       | the source SVG is 1200×800 (3:2) but is centre-cropped by `object-fit: cover` into a 16:9 box, losing ~15% of its height |

**This matters more than any single component**, because the redesign brief will be derived from these documents.

### 3.15 Genuinely broken vs merely plain — the explicit split

**Genuinely broken (something is wrong, not just unpolished):**

| #   | Issue                                                                                                       | Kind                        |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | Dark-mode header nav 3.06:1 — below AA                                                                      | accessibility defect        |
| 2   | "Featured" ribbon 1.25–3.52:1 over imagery                                                                  | accessibility defect        |
| 3   | Price truncated on 8/12 desktop cards with no `title` — unit lost                                           | content defect              |
| 4   | Mobile filter "Show 17 results" measured off-screen (top=1004, viewport 844)                                | functional/layout defect    |
| 5   | `.next` production build is 6 source files behind `HEAD`                                                    | deployment integrity defect |
| 6   | 28 hex literals outside `src/theme` — 22 × `#ffffff` in `SiteHeader.module.css`, 6 in `HomeHero.module.css` | token-contract defect       |
| 7   | `design-system.md` documents a palette the product does not use                                             | documentation defect        |
| 8   | `ui/Card` is exported, documented, unused, and violates E0                                                  | dead+wrong code             |
| 9   | "1 active filter" reported for 2 applied filters                                                            | correctness defect (minor)  |
| 10  | Mobile drawer chevrons imply submenus that do not exist                                                     | affordance defect           |

**Merely plain / aesthetic (real, but not malfunctions):** placeholder imagery (a _data_ gap — the component
behaves as designed); the type ladder collapsing below 20px; uppercase eyebrows; empty right-hand column on
`/enquire` and `/sign-in`; the 1,700px filter rail; the 5,867px mobile home; near-duplicate category routes;
sparse motion. **None of these justifies a functional rewrite**, and §7 keeps them scoped that way.

---

## 4. What already works well — do not destroy these

### 4.1 The listing card is genuinely well engineered

This is the best-built object in the product and the redesign should extend it, not replace it.
Measured on `baseline-vendors-1440-light.png`:

| Property          | Measured                                                                          | Verdict                                                  |
| ----------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Card box          | 289 × 390, `radius: 12px`                                                         | matches `--app-radius-card-dense` in the dense context   |
| Resting elevation | `border: 1px solid rgb(240,216,225)`; `box-shadow: none`                          | **E0 exactly as specified**                              |
| Hover             | E1 shadow + `--app-border-strong`, no scale/translate                             | matches contract, no banned motion                       |
| Media             | 287×162, `aspect-ratio: 16/9`, `object-fit: cover`                                | consistent across every tile                             |
| Title             | `h3`, 17px/700, `ls −0.17px`, reserved box **exactly 44px = 2 × 22.1px**          | a 1-line and a 2-line name produce identical card height |
| Meta row          | 20px tall, 13px/550, `ellipsis` on text, badge `flex: 0 0 auto`                   | text truncates, the badge never does                     |
| Anchor row        | reserved `min-height: 26px`, `18px/750`, `tabular-nums`                           | anchors align down the column                            |
| Action            | full width, min-height **40px**, `--app-radius-control`                           | consistent, correct token                                |
| Link model        | one stretched `::after` covering the tile, heading is the accessible name         | one target per card, correct semantics                   |
| Reduced motion    | `transition: none`, `:hover { box-shadow: none }` — colour survives, lift dropped | matches the policy precisely                             |

### 4.2 Token discipline where it is actually applied

- One focus treatment for every control: `outline: 2px solid var(--app-focus-ring)` + `outline-offset: 2px`,
  present on buttons, inputs, chips and cards.
- `--app-brand-contrast` (not literal white) is used for button labels in the card and elsewhere — the header is
  the outlier, not the rule.
- The radius ladder is honoured where it matters: 12px dense cards, 8px controls, `999px` reserved for chips.
- `font-variant-numeric: tabular-nums` on the price anchor, per the brief.
- **No horizontal overflow anywhere.** Measured `documentElement.scrollWidth === innerWidth` at 390, 768 and 1440
  on all ten probes — this is harder than it looks and it currently holds.

### 4.3 States and semantics

- **Every icon-only control has an accessible name** (measured): `"Open navigation menu"`, `"Search vendors"`,
  `"Switch to dark theme"`.
- A **skip link** to main content exists; `<html lang="en">`; one `<h1>` per page.
- The **invalid-filter error state is designed and good**: `state-empty-1440-light.png` shows a warning glyph,
  "We could not apply those filters", the specific cause ("Location was not found"), and exactly one action
  ("Clear every filter"). This is better than most production marketplaces.
- **Skeletons** reserve the same boxes as content (`ListingCardSkeleton`), so there is no layout shift on load,
  and the shimmer has a reduced-motion branch that becomes a static muted fill.
- **Dark mode is designed, not inverted**: separate elevation steps (canvas `#191114` → raised `#221719` →
  muted `#2C1E21`), higher shadow alphas (0.55/0.62 vs 0.06/0.10), and re-tuned muted text. It is a coherent
  "rose noir" register (`baseline-vendors-1440-dark.png`).

### 4.4 The type scale's top end

`--text-display` 64px/800/−0.03em, `--text-h1` 48px/750/−0.025em, `--text-h2` 33.76px/720/−0.02em with
`text-wrap: balance` produce a genuinely confident, current heading register. The problem is only what happens
below 20px (§3.7). Similarly, the "four-channel hierarchy" (size + weight + colour + tracking) is real at the top
and absent at the bottom.

---

## 5. Component inventory with current measured anatomy

### 5.1 Global chrome

| Component                | Measured anatomy                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader` utility bar | 36px tall, full width, `rgb(133,0,70)`, white 12px/600 links, min-height 24px per link; tagline hidden below `sm`                                                                                                                                                                                                                  |
| `SiteHeader` main bar    | 64px tall (`--app-header-height`), full width, `rgb(214,0,110)`; nav links 64px tall, `padding 0 10px`, 14px/600 (700 when active), white, 3px white underline when active; logo is a white pill, radius `--app-radius-control`, min-height 44px; icon actions 40×40, `--app-radius-pill`; Sign in is a white pill with brand text |
| `HeaderNav`              | 6 flat links, `gap: 2px`, `role` = `nav[aria-label="Primary"]`, active via `aria-current="page"` + weight + underline. **No dropdown, 0 menus**                                                                                                                                                                                    |
| `MobileNav`              | Mantine `Drawer` 320px wide; groups labelled uppercase 10–11px; every leaf link carries a `>` chevron                                                                                                                                                                                                                              |
| `SiteFooter`             | 4 columns → 1 on mobile; column labels are `h2` at 13px/650 (uppercase-tracked); links 14px/450                                                                                                                                                                                                                                    |
| Breadcrumbs              | 12px/550, `letter-spacing: 0.01em`, **uppercase**, `--app-text-subtle`, `/` separators drawn in CSS, ~17px tall                                                                                                                                                                                                                    |

### 5.2 Listing card (`listing/ListingCard`)

```
media      287 × 162, aspect-ratio 16/9 (NOT the documented 3/2), object-fit cover, 1px bottom border
ribbon     "Featured", 22px tall, accent-soft 12% tint (#7A4405 text) → measured 1.25–3.52:1  ✗
photoCount "3 photos", 22px tall, opaque --app-surface-raised, 12px/550, border --app-border  ✓
shortlist  32 × 32, top-right, radius pill
title      h3 17px/700, −0.01em, 2-line clamp, reserved 44px
meta       13px/550 --app-text-muted; "Category · Locality" + Verified chip (76×20, success soft)
tagline    13px/550, single line, ellipsis
anchor     18px/750, tabular-nums, reserved 26px, nowrap+ellipsis → 8/12 clipped at 1440  ✗
action     full-width 263×40, --app-radius-control, --app-brand fill, --app-brand-contrast label
card       289×390, radius 12px, 1px --app-border, E0 (no shadow), E1 on hover
grid       repeat(auto-fill, minmax(min(280px,100%),1fr)), gap 20px (--app-grid-gap)
```

### 5.3 Other listing components

| Component                                   | Anatomy                                                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `CategoryCard` (home tiles)                 | White card, radius 14px, 1px border; `h3` **15px/650**; count 13px/550; description 13px/450. No image                             |
| `ListingGrid`                               | `--app-grid-gap` 1.25rem in dense, 1.5rem editorial                                                                                |
| `ListingFacts`                              | 3-col fact table, labels **uppercase** 11–12px, values 15px                                                                        |
| `PackageList` / `ServiceList` / `SpaceList` | Cards inside `section`; item titles **15px/700** (same size as body); price right-aligned monospace-ish                            |
| `ListingContactCard`                        | `aside`, sticky; label **uppercase** 12px; pink "Send an enquiry" primary + white "+ Add to enquiry" secondary; EMAIL/WEBSITE rows |
| `ListingGallery`                            | Profile hero **1198 × 673** (1.78, `aspect-ratio: auto`), 2 thumbnails ~96×56 below                                                |
| `ProfileJumpNav`                            | Horizontal list of 8 section links                                                                                                 |

### 5.4 Primitives (status measured by import sites)

| Primitive                                                                                                                                                                                    | Sites  | Notes                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| `Surface`                                                                                                                                                                                    | 5      | tinted panels, `Paper unstyled`                                                         |
| `EmptyState`                                                                                                                                                                                 | 4      | title defaults to `<p>` so it cannot inject a heading                                   |
| `ErrorState`                                                                                                                                                                                 | 2      | always `role="alert"`                                                                   |
| `MediaPlaceholder`                                                                                                                                                                           | 2      | deterministic FNV-1a motif + mulberry32 jitter                                          |
| `AspectImage`                                                                                                                                                                                | 1      | own the ratio; `width`/`height` **not** emitted on `<img>`                              |
| `Card` + `CardTitle`                                                                                                                                                                         | **0**  | dead, and applies `--app-shadow-raised` at rest (`Card.module.css:28-37`) — violates E0 |
| `Pagination`                                                                                                                                                                                 | **0**  | dead; `filters/ResultsPagination` is used instead                                       |
| `Button`, `StatusBadge`, `FilterChip`, `Inputs`, `PriceTag`, `CapacityTag`, `BrandMark`, `ThemeToggle`, `Container`, `PageHeader`, `SectionHeading`, `Prose`, `Skeletons`, `DataTable`, `cx` | in use |                                                                                         |

`StatusBadge` = 7 tones × 3 variants via 4 custom properties per tone. `PriceTag` renders a designed dashed-rule
"price on request" state and never formats a number itself.

### 5.5 Measured type ladder (shipped, token-derived)

```
display  64px  / 800 / 1.05 / −0.03em     body       15px / 450 / 1.6
h1       48px  / 750 / 1.08 / −0.025em    secondary  14px / 450 / 1.55
h2       33.76px / 720 / 1.15 / −0.02em   label      13px / 650 / 1.3
h3       15–23px / 700 / 1.22 / −0.015em  button     14px / 650 / 1
card-title 17px / 700 / 1.3 / −0.01em     caption    12px / 550 / 1.4
anchor   18px  / 750 / 1.2 / −0.01em      dense      13px / 500 / 1.35
```

### 5.6 Spacing tokens in force

```
--app-gutter            clamp(1rem, 0.25rem + 2.5vw, 2.5rem)
--app-section-gap       clamp(2.5rem, 1.5rem + 3vw, 4.5rem)      (dense 2rem; editorial clamp(3.5rem,…,6rem))
--app-stack-gap         1rem        (dense 0.75rem; editorial 1.25rem)
--app-card-padding      clamp(1rem, 0.75rem + 0.75vw, 1.5rem)    (dense 0.75rem; editorial clamp(1.25rem,…,2rem))
--app-grid-gap          1.25rem     (dense 1rem; editorial 1.5rem)
Mantine: xs .5 / sm .75 / md 1 / lg 1.5 / xl 2.25 rem
```

---

## 6. Skill conflicts — every default that would violate this project, and my ruling

I loaded `high-end-visual-design`, `ui-ux-pro-max`, `frontend-design` and `web-design-guidelines` and fetched the
current Web Interface Guidelines source
([command.md](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)).
**The project brief wins in every conflict below.** The skills were used as an audit lens and as a checklist, never
as a source of tokens.

### 6.1 `high-end-visual-design` — the largest set of conflicts

| Skill prescribes                                                                                                                      | Project constraint                                                                                                                   | Ruling                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Assume premium fonts like `Geist`, `Clash Display`, `PP Editorial New`, `Plus Jakarta Sans` are available" (§2)                      | Manrope only, `frontend-styling-brief.md:76`; one variable family, 9 weights                                                         | **REJECT.** No new typeface. The task forbids it and the one-family decision is reasoned (`design-system.md:86-89`).                                      |
| "Ethereal Glass": "deepest OLED black `#050505`, radial mesh gradients, glowing orbs" (§3A)                                           | `#191114` canvas; `frontend-styling-brief.md` + `design-system.md:79` — "No gradients, no glows, no decorative blobs"                | **REJECT.**                                                                                                                                               |
| "Editorial Luxury": warm creams `#FDFBF7`, muted sage, deep espresso, noise overlay (§3A)                                             | Frozen plum/magenta token family                                                                                                     | **REJECT.** A new palette.                                                                                                                                |
| "The Asymmetrical Bento" / "Z-Axis Cascade" (`col-span-8 row-span-2`, `−2deg` rotations, overlapping cards) (§3B)                     | One landscape card ratio owned by `AspectImage`; a fixed 5-element tile anatomy repeated across the grid; a marketplace sorts by eye | **REJECT.** A bento grid destroys the columnar comparison the brief exists to serve.                                                                      |
| "Double-Bezel" on **all** major cards: outer shell `p-1.5`/`ring-1`, inner core, `rounded-[2rem]`, `shadow-[inset_0_1px_1px_…]` (§4A) | E0 = 1px `--app-border`, **no shadow** at rest; radius steps **down** with density; pills only for chips                             | **REJECT.** It would also double the DOM on every tile.                                                                                                   |
| "Nested CTA … fully rounded pills `rounded-full`" (§4B)                                                                               | Radius: controls 8px; `--app-radius-pill` for badges and chips **only**                                                              | **REJECT.**                                                                                                                                               |
| "Macro-Whitespace … `py-24` to `py-40`" (§4C)                                                                                         | `--app-section-gap` max 4.5rem (72px)                                                                                                | **REJECT** as a global rule. The existing rhythm is already generous; 96–160px would break the dense browse register.                                     |
| "Eyebrow tags … `text-[10px] uppercase tracking-[0.2em]`" (§4C)                                                                       | `frontend-styling-brief.md:84` — "Uppercase is not a label treatment here"                                                           | **REJECT.** The project already over-uses uppercase (§3.8); the skill would deepen that fault.                                                            |
| "Elements never appear statically … every section executes a fade-up over 800ms+"; "Scroll entry animations are present" (§5C, §8)    | "**Never animate**: … page-load stagger, parallax, scroll reveals"; "One orchestrated moment per page, at most" (`brief` §5)         | **REJECT — this is the sharpest conflict in the whole set.** The brief's motion policy is the opposite of the skill's default.                            |
| "Custom cubic-bezier `duration-700`" (§5)                                                                                             | Duration ceiling **280ms**; three named easings                                                                                      | **REJECT.** 700ms is 2.5× the ceiling.                                                                                                                    |
| "Banned Borders & Shadows: generic 1px solid gray borders" (§2)                                                                       | A resting card **is** a 1px `--app-border` hairline (E0)                                                                             | **REJECT.** The skill bans the project's contract (§4.1 works well).                                                                                      |
| "Floating glass pill nav, `mt-6`, `rounded-full`, detached from the top" (§5A)                                                        | Sticky two-tier marketplace header with a utility strip                                                                              | **REJECT.** A floating pill would cost the utility strip and the stable browse chrome.                                                                    |
| "The Variance Mandate: NEVER generate the exact same layout twice" (§1)                                                               | A marketplace needs one consistent tile so rows sort by eye                                                                          | **REJECT.**                                                                                                                                               |
| "Banned Icons: standard thick-stroked Lucide/FontAwesome/Material … use ultra-light precise lines" (§2)                               | Tabler at `stroke={1.5}` everywhere, with 4 known deviations that render at Tabler's default 2 (`design-system.md:746-751`)          | **ACCEPT the intent, REJECT the prescription.** No new icon library. The actionable residue is the 4 stroke-2 deviations, already documented — fix those. |
| "Scroll reveals via IntersectionObserver" (§6)                                                                                        | Explicitly out of bounds                                                                                                             | **REJECT.**                                                                                                                                               |

**Net:** the only usable residue from this skill is "icons should be optically light" — which the project already
decided, and which has 4 known exceptions.

### 6.2 `ui-ux-pro-max`

- Its workflow makes `--design-system` **required** for a new page or project direction. **I deliberately did not
  run it.** This task explicitly forbids a new palette or typeface, and the skill's `--persist` would write a
  `design-system/` directory that contradicts a frozen token contract — unverified output persisted over a
  decision. Ruling: **REJECT Step 2**, and use the skill's rule categories as the audit lens instead. I did use:
  Priority 1 (contrast 4.5:1 — which surfaced §3.2 and §3.6), Priority 2 (44×44 touch targets and the
  hover-only trap — §3.5), Priority 7 (reduced motion — §3.13), Priority 9 (nav patterns — §3.4). Those are the
  skill's genuine contributions here.
- Its rule table flags **"Raw hex in components"** as an anti-pattern — this **AGREES** with the brief and is
  exactly the §3.2 finding. Accept.
- Any style/palette/font-pairing output it produces would be a **new visual direction** and is therefore out of
  scope by instruction. **REJECT.**
- One caution I am recording: `--design-system` would emit a font pairing and a product palette, both of which
  would be unverified against this project's constraints. Do not run it later without filtering its output.

### 6.3 `frontend-design`

| Skill says                                                                                                                                     | Ruling                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Open with the most characteristic thing in the subject's world" — for a wedding marketplace, a photograph                                     | **ACCEPT, and it is the strongest independent confirmation of §3.1.** A hero with no image is the biggest missed premium lever. It does not conflict with the brief (which never bans imagery).                                                                       |
| Avoid "all caps for labels"; "numbered markers only when content is a sequence"; avoid "meta strings joined with middle dots"                  | **ACCEPT.** All-caps labels are §3.8. The middle-dot concern is a watch item: `ListingCard.module.css:184-188` already uses `·` between highlights, and `HeroSearchBar`/footer may too.                                                                               |
| "Choose your typefaces deliberately, not the default families" — implies two families                                                          | **REJECT.** Manrope only.                                                                                                                                                                                                                                             |
| "Take aesthetic risk … make deliberate choices about palette"                                                                                  | **REJECT.** The token contract is frozen; the palette is not a free axis.                                                                                                                                                                                             |
| "Avoid the SaaS-card kit: content chopped into identical rounded cards, one border-radius on everything, the same soft grey shadow under each" | **PARTIALLY REJECT.** The repeating marketplace tile is mandated by the brief and works (§4.1). But the sub-points are already satisfied better than the skill assumes: the radius ladder varies by density and the resting card has **no** shadow. No change needed. |
| "Fade-and-slide-up entrances on each section and hover transitions on every card are the generic default and read as AI-generated"             | **ACCEPT — and it vindicates the brief.** The app already avoids both (§3.13). Do not add them.                                                                                                                                                                       |
| "Treat failure and emptiness as moments for direction"                                                                                         | **ACCEPT** — already done well (§4.3).                                                                                                                                                                                                                                |

### 6.4 `web-design-guidelines`

Mostly compatible. Concrete results of applying its rules:

| Rule                                                                      | Result                                                                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Icon-only buttons need `aria-label`                                       | ✓ all three measured have names                                                                                                                                    |
| Form controls need a label                                                | ✓ Mantine emits `<label for>` (measured: checkbox `wrappingLabel: false, externalLabel: true`) — **no defect, and I checked before claiming one**                  |
| Images need explicit `width`/`height`                                     | ✗ **fails** — `width`/`height`/`sizes`/`srcset` all absent on listing images (§3.1). Container aspect-ratio prevents CLS, but the rule is unmet                    |
| `:focus-visible` over `:focus`; never `outline: none` without replacement | ✓ global ring on every control                                                                                                                                     |
| `transition: all`                                                         | ✓ zero occurrences                                                                                                                                                 |
| Honor `prefers-reduced-motion`                                            | ✓ global + 8 component branches                                                                                                                                    |
| `overflow-x` / safe areas                                                 | ✓ no horizontal overflow at 390/768/1440                                                                                                                           |
| "Title Case for headings/buttons (Chicago style)"                         | **REJECT.** The brief's register is sentence case (`brief` §4) and the product copy reads better for it. Project wins.                                             |
| "Loading states end with `…`"; "`…` not `...`"; curly quotes              | **Not verifiable in scope** — I did not audit every string; the one loading affordance I saw is a skeleton, not text. Flagged as a follow-up check, not a finding. |
| "Large lists (>50 items): virtualize"                                     | **N/A** — 12 cards/page, server-paginated                                                                                                                          |
| "Destructive actions need confirmation"                                   | Outside the seven pages audited (admin scope)                                                                                                                      |

**Net:** one real violation (image dimensions) and one stylistic conflict (Title Case) that the brief wins.

---

## 7. Top 10 recommended improvements, prioritised

Ordered by (impact on perceived premium) ÷ (risk of breaking something). **Nothing here requires a new typeface, a
new palette, Tailwind, shadcn, or a functional rewrite.**

**1. Stop painting the action colour at full bleed, and fix the dark-mode nav contrast — one change.**
Make the main bar a raised surface with ink text and keep the brand hue as a _rule_: an active-tab underline plus
a brand wordmark. This deletes the measured 3.06:1 dark-mode AA failure, drops primary chrome coverage from
~3.8% to near zero, and returns meaning to the pink button — which can only read as "the action" if pink is not
already the wallpaper. If the magenta bar is a non-negotiable brand requirement, then at minimum add
`--app-brand-contrast` to `SiteHeader` and prove the dark combination clears 4.5:1.
_Evidence: §3.2. Files: `SiteHeader.module.css:31,39,40,173`._

**2. Replace the 28 hard-coded hex literals outside `src/theme` with tokens, and add the one missing token.**
22 × `#ffffff` in `SiteHeader.module.css` (lines listed in §3.2) + 6 in `HomeHero.module.css` (`:5`, `:101`,
`:53`, `:114`, `:130`, `:137`). Add
`--app-focus-ring-on-brand` for the deliberate on-brand ring override so the exception is expressed as a token
rather than as literal white. This is mechanical, low-risk, and it is the precondition for any theming work.
_Evidence: §3.2, §3.11._

**3. Fix the price row so the unit survives.**
Widen the dense grid track (~263px → ~290px, e.g. `minmax(min(300px,100%),1fr)`) **and** add the `title` attribute
the brief already mandates, **and** let the unit drop to the caption row rather than being clipped. The unit is
what makes two prices comparable — it is the whole point of the anchor slot.
_Evidence: §3.3, table of 8 clipped cards. File: `ListingCard.module.css:199-211`._

**4. Fix the "Featured" ribbon contrast.**
Give `.ribbon` the opaque ground its sibling `.photoCount` already uses, or move the badge below the media well.
Measured 1.25:1 in the worst case — this is a WCAG failure, not a taste question.
_Evidence: §3.6. File: `ListingCard.module.css:52-66` vs `:68-83`._

**5. Make the mobile filter sheet usable in one gesture.**
Pin the Reset + "Show N results" action bar to the sheet's bottom edge so it is visible on open. Measured off-screen
by 160px today.
_Evidence: §3.5. Files: `MobileFilterDrawer.module.css`, `MobileFilterDrawer.tsx`._

**6. Rebuild the header nav as a real discovery surface.**
A category menu covering all eight footer categories (Mantine `Menu`/`Popover` is already available), a location
affordance beside the search, and removal of the `>` chevrons from mobile leaf links. Four of nine inventory
classes currently have no header path, and the mobile menu teaches users that chevrons are decorative.
_Evidence: §3.4. Files: `navigation.ts:14-21`, `MobileNav.tsx:43`._

**7. Give the bottom of the type ladder a real step — size and weight only.**
Move category tiles, package/service/space names onto the `--text-card-title` role (17px/700) or a new step
between it and body, and normalise `h1` so sign-in is not 33.76px while browse is 48px. Fix the footer so 13px
labels are not `h2`. No new font.
_Evidence: §3.7 and the measurement table._

**8. Retire uppercase tracked labels across the 13 modules that use them.**
Apply the brief's own treatment — sentence case at weight 650 — starting with the accent-coloured eyebrow
("4 PUBLISHED LISTINGS") and the mobile drawer group labels. This is the cheapest visible change with the largest
"dated template → considered product" effect, and both the brief and `frontend-design` agree.
_Evidence: §3.8._

**9. Reconcile the docs with the shipped tokens, then rebuild `.next`.**
`design-system.md` §3 (blue/slate), §4 (3:2 ratio), §5.3/§5.4 (stale consumer claims) and `frontend-styling-brief.md`
§1 (action blue) are all wrong against `tokens.ts`. The redesign brief will be derived from these files, so
correcting them first is a prerequisite, not housekeeping. Rebuild the production artifact so any new baseline
matches `src` (the hero differs today).
_Evidence: §1.2, §3.14._

**10. De-duplicate the surfaces and spend the reclaimed space on the value proposition.**
Merge `/categories/[slug]` with `/vendors?category=…`; either adopt `ui/Card` (after setting it to E0) or delete
it, and delete or adopt `ui/Pagination`; then use the empty right-hand half of `/enquire` for a vendor recap /
reassurance rail, and give `/sign-in` a value panel instead of an empty pink field. Consolidation first, then the
whitespace has something to hold.
_Evidence: §3.9, §3.10, §3.11._

**Above all ten: the imagery.** Recommending it as an eleventh item undersells it — a photography marketplace with
zero photographs cannot be made premium by typography and spacing. Pick the aspect ratio and state it (the code
renders **16:9** while the docs claim **3:2**, and the seeded 3:2 assets are being centre-cropped), then seed or
commission real photography. Until that exists, constrain the placeholder register so twelve tiles do not read as a
wireframe — for example a quieter, lower-contrast motif set, or a deliberately text-forward tile that does not
pretend to be a photograph.

---

## 8. Appendix — reproduction commands

```bash
# 1. serve the existing production build (note the corrected salt length)
source .dev-env.sh
BETTER_AUTH_SECRET='audit-secret-not-used-elsewhere-0123456789' \
IP_HASH_SALT='audit-ip-salt-0123456789abcdef' \
ALLOW_LOCAL_MEDIA_STORAGE='true' \
NEXT_PUBLIC_APP_URL='http://127.0.0.1:3300' BETTER_AUTH_URL='http://127.0.0.1:3300' \
npx next start -p 3300

# 2. chromium was not installed
npx playwright install chromium

# 3. captures: 7 paths x {1440,768,390} x {light,dark}, theme via cookie + localStorage
#    key liveenvt-color-scheme; verify data-mantine-color-scheme on <html> after load

# 4. greps used for the code findings
grep -rEn "#[0-9a-fA-F]{3,8}" src --include=*.tsx --include=*.ts --include=*.css | grep -v '^src/theme/' | grep -v generated
grep -rn "text-transform" src --include=*.css | grep -v generated
grep -rn "@keyframes\|animation:" src --include=*.css | grep -v generated
grep -rn "transition: all" src --include=*.css
grep -rn "TODO\|FIXME\|HACK" src --include=*.tsx --include=*.ts --include=*.css   # zero results
```

Servers started for this audit were stopped; port 3300 was verified closed (`curl` → `000`) and all scratch
files were removed. Only `docs/research/shots/**` and this document were written.
