# Reference Audit B — References 9–15

**Sites audited:** Eventbrite (9), Tagvenue (10), Peerspace (11), The Knot (12), Zola (13), Cvent (14), MICEbook (15)

**Method.** No re-crawl. Every claim below is grounded in files already on disk:

- `docs/research/shots/*.png` — read with the image tool, not inferred from filenames.
- `docs/research/raw/*.json` — the capture dumps (`data.typeRoles` carries real computed `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` / `borderRadius` / `boxShadow` / `transition` per text role; `data.header.style`, `data.filterContainers`, `data.cardCandidates`, `data.images[].r` carry real geometry).
- `docs/research/raw/probe-tagvenue.json`, `probe-peerspace.json`, `probe-peerspace-home.json`, `probe-ps2.json`, `peerspace_wb_home-desktop.json`, `peerspace_wb_listing-desktop.json` — targeted probes with selector-level computed styles.
- Pixel colours below were sampled programmatically from the PNGs with Pillow (bundled runtime), so hex values are measured, not eyeballed.

**Evidence markers**

| Marker       | Meaning                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `[observed]` | I saw it in a screenshot or read the value in a raw dump.                                              |
| `[reported]` | Stated by the capture harness (HTTP status, timing, timeout) in a `.log.txt` / `_capture-report.json`. |
| `[inferred]` | My reading of a visual without a computed number behind it. Flagged deliberately.                      |

**Provenance warning — read before reusing Peerspace numbers.** `peerspace-desktop.png`, `peerspace-listing.png` and `peerspace-mobile.png` are all **502 Bad Gateway** pages: the harness logged `STATUS 403` → `TITLE 502 Bad Gateway` `[reported]`, and the screenshots show the nginx error page `[observed]`. The usable Peerspace evidence is the two Wayback Machine captures (`peerspace_wb_home-desktop.*`, `peerspace_wb_listing-desktop.*`) plus the three probe files. Those are live DOM measurements of archived pages, so geometry and typography are real; anything that depends on the live site's current state (availability, filters, price formats today) is not verified.

---

# 9. Eventbrite — eventbrite.com

**Evidence:** `eventbrite-desktop.png` (1440×900), `eventbrite-mobile.png` (390×844), `eventbrite-listing.png` (1440×900), `eventbrite-{desktop,mobile,listing}.json`, `eventbrite-{desktop,listing}.log.txt`.

### Header / nav

- **One tier, 61px** `[observed]`: `height: 61px`, `position: static`, `background rgb(255,255,255)`, `border-bottom: 1px solid rgb(238,237,242)`, `box-shadow: none` (dump). Mobile header is 57px, `position: relative`, `z-index: 1001` `[observed]`.
- **Search sits in the header** and is the visual centre of it `[observed]`: a pill containing a search icon + `input[type=search]` "Search events" (`x235 y6 167×48`) + a divider + a location field (`x459 y7 211×46`) + a circular orange submit. Two inputs, one control.
- Contents desktop: `Eventbrite | Updates | Find Events | Create Events | Find my tickets | Sign in` `[observed]` — 6 items, all flat links, no dropdown on the home page. On the listing page the set becomes `Updates | Contact Sales | Create Events | Help Center ▾ | Find my tickets | Log In | Sign Up` `[observed]` — i.e. the nav is contextual, and `Help Center` is the only item with a chevron.
- **Primary CTA:** `Create Events`, a filled **#F05537** rectangle `[observed, pixel]` — the only filled item in the bar. All other items are 14px/500 with `radius: 100px; padding: 10px 16px; background: #fff` `[observed]` (dump) — pill hit areas with no visible border.
- Not sticky, no mega-menu, no second tier `[observed]`.

### Hero

- **Not a search hero.** It is a single full-bleed promotional image card: `1272×393` at `(84, 77)` → **aspect 3.24:1**, inset 84px from each edge, top of the page `[observed]`.
- Zero search fields in the hero — search already lives in the header `[observed]`. This is the single most transferable structural decision on the page.
- Copy approach: ad-style, not descriptive. Headline is stacked over the image with **solid highlight blocks behind the words** — a lavender bar behind "FROM POP BALLADS" and a blue/purple bar behind "TO EMO ENCORES", plus a small `GET INTO IT` eyebrow chip `[observed]`. A white pill button (`Get Into Live Music`, `radius: 100px` `[inferred]`) sits below.
- Image treatment: dark, warm, cinematic photograph, subject right, type left, no gradient scrim — legibility comes from the highlight blocks rather than from a dark overlay `[observed]`.
- Below the hero: a row of 8 category **circles** — `125×125` image wrappers with `border-radius: 50%`, `overflow: hidden`, on a `250px`-wide pitch (so 125px icon + 125px label column) `[observed]` (dump). Labels are 2-line centred caps.

### Listing card anatomy

- Event cards, measured on the home page `[observed]` (dump): image **286×143 = 2:1**, `border-radius: 4px`, `background: #fff`, `box-shadow: none`. Card pitch 318px → **32px gutter**, 4 per row inside a 1296px container starting at x72.
- On the category listing page the same card is **308×154 (2:1)** with a **16px** gutter and 4 cards per row + a peeking 5th to advertise horizontal scroll `[observed]`.
- The **outer card container** is `radius: 16px` while the image is `radius: 4px` `[observed]` (dump: `Container_root__1m761` at `radius: 16px` wrapping `EventCardImage-module` at `radius: 4px`). The 16px radius is the hover/selected surface, not the resting card.
- Title: **2 lines max**, clamped, drawn as an `H3` 266px wide inside a 286px card `[observed]` (dump geometry). Exact computed size for the card title was **not captured** — visually ≈16px/600 `[inferred]`.
- **Metadata rows, in order** `[observed]` (bodyText + dump):
  1. Title
  2. Date/time — `Mon, Nov 9 • 11:00 AM EST` — **14px/500, lh 20px, rgb(58,50,71)**
  3. Price **or** venue, occupying the same slot — `Free` / `From $397.00` / `Check ticket price on event` / `Hilton San Francisco Union Square`. Price is 16px/400 `[observed]`.
  4. Organiser — `Protect Wealth Academy` — 14px/500, **rgb(88,81,99)** (a step lighter than the date) `[observed]`
  5. Optional status chips above the image: `Sales end soon`, `Almost full`, `Promoted` `[observed]`
- **Hover:** probed on the whole card container — `transform: none`, `box-shadow: none`, `transition-duration: 0s` `[observed]`. Eventbrite does not lift cards. The interaction signal is the 16px-radius background surface plus title underline; no elevation anywhere on the page.

### Filters

- The category listing page surfaces exactly **two filter dropdowns** in an 88px-tall band: `San Francisco ▾` (99×48) and `Date ▾` (99×48), each 48px tall `[observed]` (dump `category-browse__filters`). **No left rail, no chips, no checkboxes.**
- Applied-filter removal: not captured in the dumps and not visible at rest in the screenshot — see _Could not inspect_.
- **No result counts** are shown next to filters `[observed]`.
- Above the results, a horizontal tab row: `All | For you | Today | This weekend` with an underline on the active tab `[observed]`.

### Price / capacity / rating

- **Price is the scan anchor.** It is placed in the metadata slot a venue name would occupy, and the three states are visually distinct: `Free` (bold, same slot as the date), `From $397.00`, and the honest fallback `Check ticket price on event` `[observed]`.
- No rating, no review count, no capacity anywhere on the event cards `[observed]`. Eventbrite's social proof is the **follower count** (`5k followers`) attached to the organiser line, not a star rating `[observed]`.

### Colour and surfaces

- Action colour: **#F05537** (orange-red) — header CTA and the circular search submit `[observed, pixel]`.
- Accent/see-more: **rgb(54,89,227) = #3659E3** (blue) on the wordmark link `[observed]` (dump).
- Text: primary **#39364F** (dark desaturated purple, not black); secondary **rgb(88,81,99) = #585163**; heading-on-dark **rgb(239,237,171) = #EFEDAB** (pale yellow) `[observed]`.
- Category hero band: **#044F60** (deep teal), full-bleed 288px tall, headline `Business events` in the pale yellow at **64px/700 lh60** `[observed]` — a deliberately inverted, high-contrast band that splits the page.
- Neutrals do the work: white page, `#EEEDF2` hairlines, no shadow used anywhere on the cards or the header `[observed]`.

### Type hierarchy (real numbers)

| Role                     | Size | Weight | Line-height                    | Colour    |
| ------------------------ | ---- | ------ | ------------------------------ | --------- |
| H1 category hero         | 64px | 700    | 60px (0.94)                    | `#EFEDAB` |
| Section H2               | 24px | 600    | 32px, `letter-spacing: 0.25px` | `#1E0A3C` |
| Header utility H1        | 18px | 500    | 24px, `ls 0.25px`              | `#39364F` |
| Nav link                 | 14px | 500    | 20px                           | `#39364F` |
| Card date / price / chip | 14px | 500    | 20px                           | `#3A3247` |
| Card organiser           | 14px | 500    | 20px                           | `#585163` |
| Price value              | 16px | 400    | 16px                           | `#39364F` |
| Card meta — **mobile**   | 16px | 500    | 24px                           | `#3A3247` |

Body font is `Founders Grotesk R` (proprietary) `[observed]` — cannot be used; Manrope is the substitute.
Mobile **upsizes** card meta from 14/20 to **16/24** `[observed]` — the only reference here that increases type size on mobile instead of shrinking it.

### Responsive

- 61px → 57px header; no visible nav labels on mobile — logo glyph only + four 24px icons (search, tickets, profile, hamburger) → **destinations move into the header as icons rather than a hamburger-only menu** `[observed]`.
- Hero keeps its full-bleed image treatment but the copy reflows to 3 highlighted lines with a smaller eyebrow `[observed]`.
- Category circles become a horizontally scrolling strip of ~4 visible `[observed]`.
- Card meta type grows (see table) while card titles stay 24px/600/32px `[observed]`.
- The mobile screenshot is **partly obscured by a cookie-consent sheet** (`Accept all` / `Reject all` / `More choices`) covering the lower 55% `[observed]` — so mobile grid column count and mobile filter behaviour could not be read from that shot.

### Motion

- No transitions found on cards or nav in the eventbrite dumps: every probed element reported `transition: all` with duration `0s`; the hover probe returned `transform: none; box-shadow: none` before and after `[observed]`.
- The only animation present is the horizontal carousel scroll and the sticky underline on the active tab `[inferred]`.

---

# 10. Tagvenue — tagvenue.com

**Evidence:** `tagvenue-desktop.png`, `tagvenue-listing.png`, `tagvenue-mobile.png`, `tagvenue-listing-mobile.png`, `tagvenue-{desktop,mobile,listing,mlisting}.json`, `probe-tagvenue.json`. This is the richest evidence set of the seven.

### Header / nav

- **One tier, 64px**, white, `border-bottom: 1px solid rgb(222,223,227)` on the listing page, `box-shadow: none`, `z-index: 5000`, `position: static` `[observed]`.
- Contents: **3 items** — `Browse spaces ▾` (a `BUTTON`, so it opens a panel), `Log in`, `List your space` (with a house icon) `[observed]`. Only `Browse spaces` has a disclosure chevron.
- Nav links are **14px/400, lh 19.6px, `padding: 0 16px`**, hit area 63px tall (full header height) `[observed]`. Colour: brand teal `rgb(0,162,135)` on the logo link, `rgb(55,57,65)` on the rest.
- **Primary CTA:** none filled. `List your space` is a plain text link. Tagvenue deliberately has no filled button in the header — the only filled control on the page is the pink `Search` button in the hero `[observed]`.
- **No search in the header** — search is a hero object on every page `[observed]`.
- Not sticky; no mega-menu panel captured `[observed]`. Mobile collapses to logo + hamburger in a **56px** header `[observed]`.

### Hero

- **Home:** a 2-column asymmetric hero. Left = a mint pill badge (`Over 22K venues · Trusted by 1M+ customers`), then the headline, then the search bar. Right = a tall portrait photograph measured at **540×720 → aspect 0.75 (3:4 portrait)**, square corners, no caption `[observed]`.
- **The home page and the listing page use different type tokens for the same element.** Home H1 is **48px/700, lh 56px, `rgb(37,39,44)`**; the city-listing H1 is **48px/600, lh 66px, white** `[observed]`. Same for section headings: home H2s are **38px/700 lh53.2**; the listing page's `Most popular event spaces in London` is **32px/600 lh44** `[observed]`. Do not assume one scale across templates.
- **Search field count: 3** — `EVENT TYPE` (text, "What are you planning?"), `GUESTS` (number, "Number of guests"), `LOCATION` + the pink **Search** button, all inside one white card `[observed]`. Each field carries a small **uppercase 14px label above the value** — labels are part of the field, not placeholders `[observed]`.
- The search card **overlaps the boundary between hero and content** — on the home page its bottom edge sits below the image, on the city page it straddles the dark hero's lower edge `[observed]`. The city-page variant has **2 fields** (`EVENT TYPE`, `GUESTS` — the city is implied by the page) + button `[observed]`.
- **Listing/city hero:** full-bleed dark city photograph, breadcrumb `UK > London` pinned top-left, **H1 centred white 48px/600 lh66** (`London Venue Hire`), a subtitle line (`Search and book 5,000+ event venues in London`), and the search card overlapping the bottom edge `[observed]`.
- Below the hero: a plain **H2 32px/600 lh44** section title plus a 3-line descriptive paragraph — programmatic SEO copy, not marketing copy `[observed]`.

### Listing card anatomy

Measured from `probe-tagvenue.json` (`LI.c-room-card`) — the most completely measured card in this audit `[observed]`:

- Card `LI`: **378×521**, `border-radius: 8px`, **`border: 1px solid rgb(222,223,227)`**, `box-shadow: none`, `margin-bottom: 24px`.
- **Image: 378×253 → aspect 1.5 (3:2)**, `overflow: hidden` on the slide wrapper. Note the image itself carries `border-radius: 0px` — **the radius lives on the card border, and the image is clipped by the card's top corners** `[observed]` (chain: `lory-slide` radius 0, card radius 8).
- **Price chip sits inside the image, bottom-right**: `154×42`, `background rgba(0,0,0,0.7)`, `border-radius: 3px`, `padding: 6px 8px`, two stacked lines — `from £200` / `minimum spend / per session` at **10px/400 lh14**, with the `£200` itself at **16px/600 lh14** `[observed]`. Inset is **8px from the image's right edge and 9px from its bottom edge** (chip 747–901 vs image 531–909; chip 925–967 vs image 723–976) `[observed]`.
- Content padding: `4px 12px 56px` on `c-room-card__content` `[observed]` — the 56px bottom is reserved for the `Check availability` CTA.
- **Metadata rows, exact order** `[observed]` (bodyText):
  1. Price chip (over the image, bottom-right)
  2. Card title `H3` — **14px/700, colour rgb(55,57,65)** — e.g. _The Wildwood Room_
  3. Capacity pair — two numbers side by side in a `display: flex` row, **15px/400**: _30_ _60_ (seated / standing). `c-room-card__capacity`, 74×16 `[observed]`
  4. Venue name + review count in parentheses — _The Green Man_ _(317)_
  5. Nearest transport — _Goodge Street Station_
  6. Neighbourhood, City — _Fitzrovia, London_
  7. Feature tag — `#Supervenue`
  8. Venue class + space/privacy + vibe — _Function Room in a Pub · Private space · Vintage feeling_
  9. Reviewer initial + name + one-line quote — _E._ / _Eve V._ / _"I'd absolutely recommend…"_
  10. Full-width `Check availability` CTA
- **2 columns** at 1440px: cards at x531 and x931, both 378 wide → **22px gutter**; results column is 800px at x520 `[observed]`. The left filter rail is 388px at x120.
- **Hover:** probed element showed `transform: none`, `box-shadow: none`, `transition-duration: 0s` before and after `[observed]` → no lift, no shadow change. The card is a bordered, flat object at rest and on hover.

### Filters

- **Left rail, 388px wide**, `ASIDE.c-card.js-filters-container` at x120, spanning 1914px of vertical height `[observed]`.
- **Seven accordion groups**, each an `H3` 16px/700 lh22.4 with option rows below `[observed]`:
  1. **Popular filters** (`External catering allowed`, `Private space`, `Affordable`, `Party` + Show more)
  2. **Capacity** (`For 10 guests` … `For 40 guests` + Show more)
  3. **Budget** (`Up to £1.000` … `Up to £4.000` + Show more)
  4. **Event Type** (`Party`, `Birthday Party`, `Corporate Event`, `Baby Shower` + Show more)
  5. **Area type** (4 options: `Whole venue`, `Private space within the venue`, `Semi-private area within the space`, `Private outdoor space`) — no Show more
  6. **Venue type** (`Hall`, `Function Room`, `Bar`, `Community Centre`, `Restaurant`, `Hotel`, `Pub`, `Church` + Show more)
  7. **Catering and drinks** (4 options) — no Show more
- **Control type: checkbox rows, not pills** — each label is 14px/400 with `padding: 4px 0` (32px row height) `[observed]`.
- **Progressive disclosure is the core mechanic**: `lp-show-more-container--limit-4` / `--limit-8` / `--limit-no`, each with a `+ Show more` button `[observed]`. Groups start at 4 visible options and expand in place — no modal, no navigation.
- **No counts are shown on any filter option and no result count in the rail** `[observed]`.
- Applied-filter chips and their removal affordance were not captured in the dump `[observed, absent]` — see _Could not inspect_.
- **Mobile: the entire rail is replaced by a single 42px-tall `Filter results` button** in a `container js-mobile-filter-results-button` bar (390px wide) `[observed]`. This is the cleanest mobile-filter pattern in the set.

### Price / capacity / rating

- **Price is the anchor, and it is rendered as a two-line chip on the image** (`from £200` small / `minimum spend / per session` smaller) rather than in the text block. Because it sits on a 70%-opacity black plate over photography, it is readable on any image and it is the first thing the eye lands on `[observed]`.
- **Capacity is the second anchor** — two bare numbers flanked by icons in a flex row directly under the title. No units printed; the icons carry the meaning `[observed]`.
- **Rating exists as a review count in parentheses** after the venue name (`(317)`), plus a quoted review — no star glyph and no numeric average on the card `[observed]`. **Do not copy** (see below).

### Colour and surfaces

- Action colour: **#FF5B65** (coral pink) for `Search` on both the home hero and the listing hero `[observed, pixel]`.
- Secondary action: **#1CAC94** (green) for the map card's `Show map` button `[observed, pixel]`; brand teal `rgb(0,162,135) = #00A287` on the logo link `[observed]`.
- Page background pure white; card surfaces white with a **1px `#DEDFE3` border and no shadow at all** `[observed]`. Shadow policy: **zero shadows anywhere in the listing layout** — exactly one elevated element (the hero search card).
- Neutrals: text `rgb(55,57,65) = #373941` (warm dark grey, never black), secondary `rgb(85,87,99) = #555763`, hairline `#DEDFE3`, badge mint background, image placeholder `#DDDDDD` `[observed]`.
- The city hero band and the map card are the only large colour fields; everything else is white-on-white separated by hairlines `[observed]`.

### Type hierarchy (real numbers)

| Role                         | Size                     | Weight  | Line-height | Colour                |
| ---------------------------- | ------------------------ | ------- | ----------- | --------------------- |
| H1 home hero                 | 48px                     | **700** | 56px        | `rgb(37,39,44)`       |
| H1 city hero (desktop)       | 48px                     | 600     | 66px        | `#FFFFFF`             |
| H1 city hero (mobile)        | 32px                     | 600     | 44px        | `#FFFFFF`             |
| Section H2 home              | **38px**                 | **700** | 53.2px      | `#373941`             |
| Section H2 listing (desktop) | 32px                     | 600     | 44px        | `#373941`             |
| Section H2 listing (mobile)  | 24px                     | 600     | 32px        | `#373941`             |
| Card title H3                | 14px                     | 700     | normal      | `#373941`             |
| Card details row             | 15px                     | 400     | normal      | `#373941`             |
| Filter group heading H3      | 16px                     | 700     | 22.4px      | `#373941`             |
| Filter label / search label  | 14px                     | 400     | 19.6px      | `#373941`             |
| Nav link                     | 14px                     | 400     | 19.6px      | `#373941` / `#00A287` |
| Price chip line 1            | 10px                     | 400     | 14px        | `#FFFFFF`             |
| Price chip value             | 16px                     | 600     | 14px        | `#FFFFFF`             |
| Home article card image      | 320×200 (aspect **1.6**) | —       | —           | —                     |

Body font `Inter, -apple-system, system-ui, …` at 14px `[observed]` — a stack Manrope can drop into directly.
The **4.8× ratio between the smallest type (10px price-caption line) and the largest (48px H1)** is what gives the page its density: metadata is genuinely tiny and the display type is genuinely large `[observed]`.

### Responsive

- Header 64px → **56px**, nav → hamburger only `[observed]`.
- Hero H1 48/66 → **32/44**; section H2 32/44 → **24/32**; card title stays 14/700; price chip sizes unchanged `[observed]`.
- **Card image aspect changes from 1.5 (378×253) on desktop to 1.79 (358×200) on mobile** `[observed]` — the image gets relatively wider/shorter when the grid goes single-column. Card becomes full-bleed-ish at 358px with the page inset at 16px.
- Search card goes from a 3-field horizontal row to a **stacked card**: fields full width, hairline separators between them, full-width pink `Search` button, and a lock icon + `Trusted by over 1M+ customers` line beneath the button `[observed]`.
- Filter rail → single `Filter results` button `[observed]`.
- Mobile menu is a long grouped list (cities, event types, venue types) rather than a shallow menu `[observed]` (dump `header.text` contains the full link inventory).

### Motion

- **Nav links: `transition: color 0.1s ease-out`** `[observed]` — a 100ms colour fade, no movement. This is the only declared transition on the desktop page.
- Card hover: `transition-duration: 0s`, `transform: none` `[observed]` → the cards are completely static; motion is reserved for navigation state only.
- Carousel-based image browsing exists per card (`lory-slide current active` classes and 5 dots under the image) `[observed]`, indicating a swipeable multi-photo card on both desktop and mobile.

---

# 11. Peerspace — peerspace.com

**Evidence (usable):** `peerspace_wb_home-desktop.png/.json`, `peerspace_wb_listing-desktop.png/.json` (Wayback Machine captures), `peerspace-listing-grid.png`, `probe-peerspace.json`, `probe-peerspace-home.json`, `probe-ps2.json`.
**Evidence (blocked):** `peerspace-desktop.png`, `peerspace-listing.png`, `peerspace-mobile.png` — all 502/403 `[reported]`+`[observed]`.

### Header / nav

- **One tier, 72px**, `position: sticky; top: 0; z-index: 1020`, `box-shadow: none` `[observed]`.
- **Two header states on the same site** `[observed]`:
  - _Transparent over the hero_ (home): `background: rgba(0,0,0,0)` — the black wordmark and `Sign Up` button sit directly on the photograph, with a solid black band immediately beneath the hero.
  - _Solid black_ (venue/listing pages): `background: rgb(0,0,0)`, 72px, same geometry.
- Contents: `PEERSPACE` wordmark (condensed, uppercase, custom lettering), globe icon, `Browse Spaces ▾` (the only dropdown), `List Your Space`, `Log In`, and **`Sign Up` as the primary CTA — a solid white rectangle with black text** `[observed]`; measured `86×40` `[observed]`.
- **Search is not a field in the header** — it is a `Search` link/button that occupies a full-height 72px column at x250 (`74×72`), opening search rather than embedding it `[observed]` (`probe-ps2`: `hero-search-btn`, `font-size: 16px; font-weight: 400; lh 24px; color: #fff`).
- Home page nav list includes `About | Press | Careers | Activities | Locations | Resources | Ambassador Program` and a **country selector** (`Deutschland | United Kingdom | United States | Canada | Australia | España | France`) `[observed]` — footer/mega-menu inventory, not bar items.
- Not sticky-with-a-shadow: sticky with **no elevation change** — the black bar just meets the content `[observed]`.

### Hero

- Full-viewport photograph with the search bar floating in the middle and a **solid black band below carrying the display headline** `[observed]`.
- **Search field count: 3** — `What are you planning?`, `Where?` (pre-filled `San Francisco, CA, US`), `When?` (pre-filled `Anytime`) — plus a **black `Search →` button** with an arrow glyph `[observed]`. Field labels are **12px/400 lh16, rgb(106,110,122)** sitting above 18px/400 values (`probe-ps2`: `hero-activity-input` 18px/400 lh27, colour `rgb(52,56,64)`) `[observed]`.
- The search card is a single white rectangle, flush fields, hairline dividers, square corners on the container with a slightly rounded inner button `[inferred]`.
- **Copy approach — the differentiator:** the headline is a two-line declarative statement in **88px/400, lh 96px, letter-spacing −1.76px (−0.02em), white** — `Find a space. Fulfill your vision.` `[observed]`. And to the right, on the same black band, a small **image credit in content-not-decoration style**: `Meeting — Splendid loft` / `PARIS, FR` `[observed]`. The hero advertises the inventory itself.
- Image treatment: the hero photo is unretouched/documented (a real shoot in progress, not a styled wedding photo) `[observed]`. Below the fold, imagery gets **editorial labels**: `Birthday Party` / `HOUSTON, TX, US` printed over a 568×600 (aspect **0.947**) image `[observed]`.

### Listing card anatomy

Measured on the Wayback listing grid `[observed]`:

- Image **352×235 → aspect 1.5 (3:2)**; card total 374px tall (235 image + 139 text).
- **Price chip inside the image, bottom-right**: `92×24`, `background rgb(18,18,18)`, `color: #fff`, **`border-radius: 2px`**, `padding: 0 4px`, text **16px/400 lh24** — reads `from$100/hr` (the font closes the word space) `[observed]`. Inset: 8px from the image's right and bottom edges `[observed]` (chip right edge 504 vs image right 512).
- **Metadata rows, in order** `[observed]`:
  1. Price chip (over image, bottom-right)
  2. Title — **16px/400 lh24, colour rgb(18,18,18)** `[observed]` (`probe-ps2`: `card-title`) — _Skeleton Key Designs_
  3. Distance / location — **`H3`** — _18.6 miles from Abingdon, MD_ (20px tall, single line) `[observed]`
  4. A single combined row: **★ 5.0 (122) · 👥 10** — rating + review count + capacity, dot-separated with glyph icons `[observed]`. Rating text is **14px/400 lh20** `[observed]` (`probe-ps2`: `card-rating`).
  5. Description, **clamped to 2 lines** with an inline `Show more` link `[observed]`
- **3 columns** at 1440px: images at x160, x544, x928, each 352 wide → **32px gutter**, container 1120px `[observed]`.
- **Border vs shadow: neither.** Cards have no border and `box-shadow: none` on every ancestor `[observed]`. Separation is achieved purely by whitespace and the bottom-left alignment of text under the image.
- **Hover:** probed wrapper returned `transform: none`, `box-shadow: none`, `transition-duration: 0s` `[observed]` → no lift, no zoom, no shadow.

### Filters

- **No filter rail is present on the venue-type landing page** (`filterContainers: []`, listing dump) `[observed]`. Filtering is pushed into the search flow (`/s/?a=event&location=abingdon--md&space_type=rooftop` — filters are **URL query parameters**, visible in the header link href) `[observed]`.
- **No result count, no applied-filter chips, no filter counts** on the captured pages `[observed, absent]`.

### Price / capacity / rating

- **Price is the unambiguous scan anchor**: black chip, white 16px text, positioned over the image's bottom-right corner, always prefixed `from`, always per-hour (`/hr`) `[observed]`.
- **Capacity is a bare number next to a people glyph** inside the same row as the rating `[observed]`.
- **Rating is a star + one-decimal average + parenthetical review count** — `★ 5.0 (122)` `[observed]`. This is the single clearest "do not port" element (see below).

### Colour and surfaces

- Action colour: **#121212** (near-black) for the price chip and the black hero band; **#000000** for the solid header bar `[observed]`.
- The only chromatic surface is the awards section: **`rgb(52,26,74) = #341A4A` (deep purple)**, 600px tall, full-bleed, with the image at 896×550 (aspect 1.629) `[observed]`.
- `Sign Up` is **white fill with black text** `[observed, pixel]` — the CTA inverts against every dark surface on the site.
- Shadow policy: **none**. Not one card, header or panel uses `box-shadow` in any dump `[observed]`.
- Neutrals: text `rgb(18,18,18)`, secondary `rgb(52,56,64)`, label grey `rgb(106,110,122)`, page white `[observed]`.

### Type hierarchy (real numbers)

| Role                      | Size      | Weight | Line-height | Letter-spacing | Colour                |
| ------------------------- | --------- | ------ | ----------- | -------------- | --------------------- |
| Display H1 (hero)         | 88px      | 400    | 96px        | −1.76px        | `#FFFFFF`             |
| Oversized statement words | **160px** | 400    | 160px       | −4.8px         | `#FFFFFF` / `#121212` |
| Section H2                | 56px      | 400    | 64px        | −1.12px        | `#121212`             |
| Landing H1                | 32px      | 400    | 40px        | normal         | `#121212`             |
| Card/section heading      | 20px      | 400    | 26px        | normal         | `#FFFFFF`             |
| Search field label        | 12px      | 400    | 16px        | normal         | `#6A6E7A`             |
| Search field value        | 18px      | 400    | 27px        | normal         | `#343840`             |
| Card title                | 16px      | 400    | 24px        | normal         | `#121212`             |
| Price chip                | 16px      | 400    | 24px        | normal         | `#FFFFFF`             |
| Card rating/meta          | 14px      | 400    | 20px        | normal         | `#121212`             |
| Search button label       | 16px      | 400    | 24px        | normal         | `#FFFFFF`             |

**The defining choice: every heading is `font-weight: 400`.** Scale and negative tracking do the work of hierarchy; nothing is bolded. Body font is `__ABCSocialRegular` (ABC Social, proprietary) `[observed]`.

### Responsive

- **Not inspectable.** `peerspace-mobile.png` is a 502 page `[observed]`; no mobile Wayback capture or mobile dump exists. See _Could not inspect_.

### Motion

- Nothing measurable: every probed element reports `transition: all` with `transition-duration: 0s`, and hover before/after are identical (`transform: none`, `box-shadow: none`) `[observed]`.
- The archived home page contains an `AnimatedMockSlider` component with track/slide classes `[observed]` — a continuously animated device mockup, i.e. motion reserved for editorial illustration, not for UI feedback.

---

# 12. The Knot — theknot.com

**Evidence (usable):** `theknot-desktop.png` (1440×900) + `theknot-desktop.json` + `.log.txt`.
**Evidence (partially blocked):** `theknot-listing.png` and `theknot-mobile.png` are **PerimeterX "Verification Required" interstitials** (`SCREENSHOT` written before the block rendered, slide-to-secure-your-access widget, `ID: befb811c-…`) `[observed]`. `theknot-mobile.json` and `theknot-listing.json` nevertheless contain real DOM geometry from before the interstitial — used below but flagged.

### Header / nav

- **Two tiers, 120px total** `[observed]` (`HEADER` rect 1440×120, `position: static`, `background: rgba(0,0,0,0)`, `box-shadow: none`, no border-bottom).
- Tier 1 (≈0–60px): script **`theknot`** wordmark left; right = `👥 Find a couple` (people icon + 11px–12px label) + **`Log in` as a solid black pill** + **`Sign up` as a solid magenta pill #FF44CB** `[observed, pixel]`.
- Tier 2 (≈60–120px): a flat row of **8 labels** — `Planning Tools · Vendors · Wedding Website · Guests & RSVPs · Invitations · Registry · Attire & Rings · Ideas & Advice` `[observed]`. All are top-level; only the wordmark tier carries the account controls.
- **Primary CTA: two.** This is the notable structural choice — the header offers a **neutral black `Log in` and a brand-magenta `Sign up` side by side**, so the brand colour marks the acquisition action and black marks the return-visit action `[observed]`.
- **No search in the header.** The only search input on the homepage is a `name="City, State"` field far down the page (`x661 y1652`) inside a labelled vendor-search block whose floating label is **`Location`, 16px/400 lh22, in a box with `border-radius: 8px`, `background: #fff`, `border: 1px solid rgb(202,204,208)`** `[observed]`.
- Not sticky, no mega-menu captured `[observed]`.

### Hero

- **Video hero, not an image hero**: a full-bleed 1440×581 video panel (page region 139→720) with a **circular translucent pause button at top-right** `[observed]`. The imagery is documentary — a group of guests applauding a couple, daylight, unposed.
- **Search field count: 0 in the hero** `[observed]`.
- Copy: **H1 `Your wedding team & everything in between` at 60px/700, lh 60px, letter-spacing −1.2px (−0.02em), white** `[observed]`; a single-line subhead at 16px/400 (`Join the free wedding planning platform that's helped more than 30 million couples.`); then a **magenta `Sign up` pill** plus a plain white **`Find a couple`** text link — the same pair as the header, repeated `[observed]`.
- No dark scrim is evident; legibility comes from the type scale and text-shadow-free white on a mid-tone frame `[inferred]`.
- Below the hero: a centred **`Free wedding planning tools`** heading at ~40px `[inferred]` over a **4-column grid of tool cards**.

### Listing card anatomy

The Knot's captured cards are _planning-tool_ cards, not vendor cards — but their anatomy is fully measured `[observed]`:

- Image **307×384 → aspect 0.8 (4:5 portrait)**, wrapper `border-radius: 16px`, `overflow: hidden`, `box-shadow: none`, `border: 0` `[observed]`.
- Card is `display: flex; gap: 16px` with two children (image wrapper, then caption); the captured `style` did not include `flex-direction`, so whether the caption sits **below** the image (column) or beside it (row) is `[inferred]` from the screenshot, which shows it below.
- Caption pattern: `Checklist → Keep every detail organized by month.` — **label, arrow glyph, description, in one 16px/400 lh22 string** `[observed]`. The arrow is the affordance; there is no button.
- Other cards use the identical shape: `Registry → Add no-fee cash funds and gifts from any store.`, `Wedding website → One spot for RSVPs, gifts and wedding details.`, `Invites & paper → Get 3 free paper samples and shop stationery.` `[observed]`.
- Grid: 4 columns of 307px with **24px gutters**, container padding `0 70px` (1300px content), section padding `60px 0`, white background `[observed]`.
- Card titles/labels are **semantically weak** — the H3s on the listing page carry the _distance/location_ strings rather than the venue names `[observed]` (`H3 "18.6 miles from Abingdon, MD"` pattern appears on the Zola/Peerspace side; on theknot-listing the card heading set was not captured).
- **Hover:** no hover probe was captured for The Knot. **Not inspectable.**

### Filters

- **No filters exist on the homepage** `[observed]` (`filterContainers: []` after the tool-card section).
- The only filter-like control is the one labelled vendor-search field: `Location` label, `name="City, State"`, **radius 8px, 1px `#CACCD0` border, `padding: 19px 15px 5px`** (floating-label geometry: label sits inside the top of the box) `[observed]`. A `Category` select (`Reception Venues`) and a `Search` button accompany it `[observed]`.
- No counts, no chips, no removal affordance `[observed, absent]`.

### Price / capacity / rating

- **None on the captured homepage** `[observed]`. No price, no capacity and no rating appear in `typeRoles.price` (empty), `typeRoles.card-meta` (a single paragraph) or the card chains.
- Social proof is asserted as **copy, not as data**: the hero subhead claims "more than 30 million couples" and a card paragraph claims "nearly 175,000 top-rated wedding vendors" `[observed]`. Both are marketing claims in body text, unreferenced and unverifiable — **explicitly out of scope for us**.

### Colour and surfaces

- Action colour: **magenta `#FF44CB`** — a single filled pill in the header and the hero `[observed, pixel]`. This is the closest colour relative to our own pink/magenta palette, and it is used with extreme restraint: one fill per viewport.
- Secondary action: **black `#000000`** pill for `Log in` `[observed, pixel]`.
- Backgrounds: white; the hero is a full-bleed photographic video panel; nav row divider `#EEEEEE` `[observed, pixel]`.
- Shadow policy: `box-shadow: none` on header, card, image wrapper and section `[observed]` — **zero shadows; rounding does the work** (16px on every image wrapper) `[observed]`.
- Neutrals: text `rgb(0,0,0)`; form borders `rgb(202,204,208) = #CACCD0`.

### Type hierarchy (real numbers)

| Role                        | Size | Weight | Line-height | Letter-spacing | Colour    |
| --------------------------- | ---- | ------ | ----------- | -------------- | --------- |
| Hero H1 (desktop)           | 60px | 700    | 60px        | **−1.2px**     | `#FFFFFF` |
| Hero H1 (mobile)            | 40px | 700    | 40px        | —              | `#FFFFFF` |
| Card paragraph / form value | 16px | 400    | 22px        | normal         | `#000000` |
| Form label `Location`       | 16px | 400    | 22px        | normal         | `#000000` |

Body font `ods-font-secondary` (a proprietary stack) at 16px `[observed]`. Note the **line-height equals the font-size** on both the 60px desktop and 40px mobile H1 — a hard leading ratio of 1.0 on display type, and −2% tracking. That combination (tight leading + negative tracking + 700 weight) is the opposite of Peerspace's approach and produces a much denser headline.

### Responsive

- Header **120px → 60px** (single visible tier) `[observed]` (mobile dump).
- Hero H1 **60/60 → 40/40** — the leading ratio is preserved at 1.0, so the type does not loosen as it shrinks `[observed]`.
- Card paragraph and form text stay at 16px/22px — no downscale of body copy `[observed]`.
- Mobile page height 6526px vs desktop 5545px `[observed]` (dump `docHeight`) — consistent with a single-column reflow of the 4-column tool grid.
- **The mobile screenshot is a bot-verification page** `[observed]`, so mobile layout, nav collapse and menu behaviour could not be seen. See _Could not inspect_.

### Motion

- Not captured (no hover probe; no transition values in the desktop dump's `typeRoles` beyond the default `all`) `[observed, absent]`.
- The hero is a **looping video with a user-facing pause control** `[observed]` — a motion decision we should note (a pause control is mandatory if we ever autoplay) but not the transition data requested.

---

# 13. Zola — zola.com

**Evidence:** `zola-desktop.png`, `zola-listing.png`, `zola-mobile.png`, `zola-{desktop,listing,mobile}.json`, `zola-{desktop,listing,mobile}.log.txt`. All three pages are genuinely loaded.

### Header / nav

- **Three tiers, 189px total**, `position: relative`, `background: #fff`, **`border-bottom: 1px solid rgb(183,183,183)`**, `box-shadow: none` `[observed]`.
- **Tier 1 — announcement bar** (≈0–56px): a dark **#183B54** band `[observed, pixel]` holding a white `Sale` chip, the promo copy (`40% off* invites & paper through 10/19 with code SPOOKY40`, 16px/600, white) `[observed]`, a `Terms` button, and far right the sibling-brand links `Zola Baby · Zola Home · Zola for vendors` at **12px/400 white** `[observed]`.
- **Tier 2 — main bar** (≈56–133px): left = `Plan your wedding ▾`, `Expert advice ▾`, `Find a couple`; centre = the **ZOLA wordmark with a heart glyph, optically centred**; right = a 44×44 search icon button, a 44×44 shopping-cart link, a **`Log in` outlined pill (73×44)** and a **`Get started` solid near-black pill (107×44, `#0E0E0E`)** `[observed, pixel]`.
- **Tier 3 — category bar** (≈133–189px): `Wedding venues ▾ · Vendors ▾ · Destination weddings ▾ · Become a vendor`, sitting below the header's bottom border, 23px tall labels on a 40px pitch `[observed]`.
- **Primary CTA: `Get started`**, black pill, top-right `[observed]`. Secondary CTA: `Log in`, outlined pill.
- **Search is an icon in the header that reveals the field** — on the listing page the field itself is the hero-adjacent search bar, not a header input `[observed]`.
- Nav has three dropdowns (`Wedding venues`, `Vendors`, `Destination weddings`); no mega-menu contents captured `[observed]`.
- **Not sticky**: `position: relative` `[observed]`. With 189px of chrome, stickiness was presumably avoided deliberately.

### Hero

- **Home:** a centred, inset image card — photograph starts ~16px in from each edge with a large radius, and the headline sits **below** the image rather than over it on mobile; on desktop the H1 overlays the image in a **serif display face** `[observed]`.
- **Search field count on the home hero: 0** `[observed]`. Search lives on the listing page.
- **Listing page search:** a single **full-width pill** (radius = fully round) containing a `Venues` select, a hairline divider, a `Location` input (`aria-label="Search by location"`, placeholder `Location`) and a **solid black `Search` pill button on the right** `[observed]`. Dump geometry: two inputs at `y244 h44` in a container starting at x721, plus a third zone at x1021 — i.e. **a 3-zone pill: category select | vendor type | location | button** `[observed]`.
- Copy approach: promise + mechanism. `Wedding planning starts here` H1, then a 3-line subhead listing the actual products (`From venues and save the dates to a free wedding website, a registry and even your cake — Zola is here for all the days along the way`), then the CTA `Let's do this!` and a secondary `Find a couple` link `[observed]`.
- Image treatment: **inset, rounded (16px), editorial** — the hero is a framed photograph of a real couple, not a full-bleed banner `[observed]`. On the listing page, imagery is consistent 16px-rounded 3:2 cards `[observed]`.

### Listing card anatomy

Measured from `zola-listing.json` `[observed]`:

- **Layout: horizontal list rows, not a tile grid.** Image left, text right, one card per row `[observed]` (both screenshot and geometry: text column at x736, width 584).
- **Image: 332×222 → aspect 1.5 (3:2)** — dump `ratio 1.5`, `332×221`; `border-radius: 16px`, `overflow: hidden`, `box-shadow: none`, **placeholder background `rgb(243,243,243)`** while loading `[observed]`.
- Image is a **swipeable carousel** — 5 full-width slides at x380, 712, 1044, 1376, 1708 inside an `emblaViewport` with `overflow: hidden`, and 5 pagination dots under the image `[observed]`.
- Overlays on the image: a white **`Quick responder`** chip top-left, and a **white circular heart/save button** (56×56, per the `images[]` entry for the `Awarded Best of Zola` badge of the same size) top-right `[observed]`.
- Card row pitch ≈**327px** (image y = 422, 749, 1076, 1403) `[observed]`.
- **Metadata rows, exact order** `[observed]` (screenshot + bodyText):
  1. Venue name — **24px/600**, e.g. _Willowdale Estate_ — set on the same baseline row as the location
  2. Location, right-aligned on that same row — _Topsfield, MA_
  3. **Rating row**: star glyphs + `5.0` + `·` + `Ratings include Zola and Google reviews` — all at **14px/400 lh22** `[observed]`
  4. **Fact row with icons**, dot/dividers between: `👥 Up to 240 guests` · `✓ All-inclusive` · `⛰ Indoor & outdoor`; the second card additionally carries `ⓘ Starts at $18,500` `[observed]`
  5. Description — **14px/400 lh20, colour rgb(74,74,74)**, clamped with an ellipsis after ~3 lines `[observed]`
  6. **Nested quote card** — `background #F3F3F3`, quote text 14px, a `Read more` link, a thumbnail, and an attribution line (`Bradley P., 10 months ago`) `[observed, pixel]`
  7. `Best of Zola` circular award badge absolutely positioned at the card's right edge `[observed]`
- **Border vs shadow: neither.** No border, `box-shadow: none` on the card, the image container and the row wrapper `[observed]`. **Rows are separated by a 1px hairline rule** across the results column `[observed]`.
- **Hover:** probed on the image container — `transform: none`, `box-shadow: none`, `transition-duration: 0s` before and after `[observed]` → no lift, no image zoom.

### Filters

- **Left rail, 300px wide**, `DIV.desktopFilters` at x40, spanning **10030px** of height `[observed]`.
- **Nine collapsible groups**, every one a `BUTTON` (i.e. a toggle, not a link), in this order: `Price · Availability · Capacity · Indoor/outdoor · Venue type · Included · Award winners · Amenities · Event types` `[observed]`.
- **The rail is displayed expanded-able but the group headers are the only visible text — no option is rendered until a group is opened** `[observed]` (the rail's entire text content is the nine labels). This is a **fully collapsed accordion rail**, in contrast with Tagvenue's partially-expanded `+ Show more` rail.
- **No counts on options, no count in the rail** `[observed]`.
- Above the results: a result count **`1000+ Wedding Venues`** on the left and a **`Sort: Distance` pill** (`background #F3F3F3`, rounded) on the right `[observed, pixel]`. A disclosure link sits above the H1: `How do we sort results, including Sponsored Ads and personalized results?` with an info glyph `[observed]`.
- Applied-filter chips: not captured in the dump `[observed, absent]` — see _Could not inspect_.
- **Mobile filters: none captured** — `filterContainers: []` in `zola-mobile.json` (that capture is the homepage, not the listing) `[observed]`.

### Price / capacity / rating

- **Price is not the anchor here — capacity and inclusions are.** Price appears only as an `ⓘ Starts at $18,500` item inside the fact row, third-position at best `[observed]`.
- Capacity leads the fact row as `Up to 240 guests` `[observed]`.
- **Rating is heavy**: star glyphs + numeric average + an explicit provenance string (`Ratings include Zola and Google reviews`), plus a full quoted review with a named, dated attribution in a nested surface `[observed]`. Maximum social proof density of any site in this set — and entirely out of scope for us (see below).

### Colour and surfaces

- Action colour: **#0E0E0E** (near-black) for `Get started`, `Search` and the primary CTAs `[observed, pixel]`.
- Distinct surfaces: announcement bar **#183B54**; neutral surface **#F3F3F3** (sort pill, quote card, image placeholder) `[observed, pixel]`.
- Text: primary **rgb(14,14,14) `#0E0E0E`**, secondary **rgb(74,74,74) `#4A4A4A`** `[observed]`.
- **Shadow policy: none.** Every card, chip, quote block and button is flat; the quote card is distinguished by its `#F3F3F3` fill rather than elevation `[observed]`.
- Neutrals carry the layout: white page, `#F3F3F3` for everything secondary, **one** hairline `rgb(183,183,183)` under the header, one hairline per result row `[observed]`.
- There is **no brand accent colour at all on the listing page** — black plus greys, with the only colour coming from photography and the award badge `[observed]`. That is a strong, cheap pattern for a fixed palette.

### Type hierarchy (real numbers)

| Role                             | Size     | Weight  | Line-height | Letter-spacing    | Colour    |
| -------------------------------- | -------- | ------- | ----------- | ----------------- | --------- |
| Hero H1 (desktop, serif display) | —        | —       | —           | —                 | `#FFFFFF` |
| Hero H1 (mobile)                 | 32px     | 500     | 36px        | normal            | `#0E0E0E` |
| Page H1 (listing)                | **24px** | **600** | 32px        | **−0.72px (−3%)** | `#0E0E0E` |
| Section H2 (large)               | 32px     | 400     | 40px        | −1.28px (−4%)     | `#0E0E0E` |
| Section H2                       | 24px     | 400     | 32px        | −0.72px           | `#0E0E0E` |
| Section H3                       | 20px     | 400     | 24px        | normal            | `#0E0E0E` |
| Nav link (announcement)          | 16px     | 600     | 22.86px     | normal            | `#0E0E0E` |
| Nav link (sibling brands)        | 12px     | 400     | normal      | normal            | `#FFFFFF` |
| Venue name                       | 24px     | 600     | —           | —                 | `#0E0E0E` |
| Rating text                      | 14px     | 400     | 22px        | normal            | `#0E0E0E` |
| Description                      | 14px     | 400     | 20px        | normal            | `#4A4A4A` |
| Fact-row emphasis                | 14px     | 600     | 22px        | normal            | `#4A4A4A` |

Two things stand out quantitatively. First, **negative tracking scales with size**: −0.72px at 24px (−3%), −1.28px at 32px (−4%). Second, **the page H1 is only 24px** — the page title is deliberately quieter than the 24px venue names and is distinguished by weight (600 vs 600) and position rather than size. Body font `circular, helvetica, sans-serif` (Circular, proprietary) `[observed]`.

### Responsive

- Header 189px of three tiers → **two visible rows in 56px total: hamburger + centred wordmark + cart icon** `[observed]`. The announcement bar and the nav links disappear entirely.
- Hero image becomes an **inset rounded card with visible page gutters** on mobile, with the H1 moved **below** the image instead of over it `[observed]`.
- H1 32px/500/36px, subhead 14px/400 lh22 **centred**, black CTA pill near-full-width, secondary text link underlined beneath it `[observed]`.
- Below the hero, a **2-column card grid with 1:1 square images**, 16px radius, and the labels placed **above** the image (`Free wedding websites`, `Find nearby vendors`) with an underline/arrow affordance `[observed]`. Image aspect changes from 3:2 (desktop listing) to **1:1** (mobile home grid) `[observed]`.
- Body font size drops from 16px (desktop body) to 14px on mobile card/meta roles `[observed]`.

### Motion

- **Announcement-bar links: `transition: opacity 0.5s ease-in`** `[observed]` — a notably long 500ms opacity fade, unusual for a nav item, and probably a legacy artifact rather than a considered choice.
- All probed cards: `transition-duration: 0s`, `transform: none`, `box-shadow: none` `[observed]` → no card motion.
- Carousel slide changes on card images and a disclosure/collapse animation on the filter accordion are the only interactive motion present `[inferred]`.

---

# 14. Cvent — cvent.com

**Evidence:** `cvent-desktop.png` + `cvent-desktop.json` + `.log.txt`; `cvent-listing.png` (screenshot only). `cvent-listing.log.txt` shows the listing run hit the **105s watchdog** `[reported]` (`STAGE pre-extract 96349 ms`, `WATCHDOG_TIMEOUT_MS 105000`), so **no `cvent-listing.json` exists**. `cvent-mobile.log.txt` shows `SCREENSHOT_ERROR TimeoutError: page.screenshot: Timeout 30000ms exceeded` `[reported]` — **no Cvent mobile evidence of any kind**.

### Header / nav

- **One tier, 97.3px tall**, `position: relative` (not sticky), `background: rgba(0,0,0,0)`, `box-shadow: none`, no border-bottom `[observed]`.
- Contents: an oversized `cvent™` wordmark; then **5 dropdown buttons** — `Event solutions ▾ · Hospitality solutions ▾ · Your role ▾ · Resources ▾ · About Cvent ▾` at 16px/400 lh22.4 `[observed]`; then the utility cluster: **`REQUEST DEMO` (filled green button, 143×33)**, **`FIND EVENT VENUES` (underlined text, 132×32)**, **`LOG IN` (underlined text, 47×32)**, then a search glyph `[observed]`.
- The header markup separates these explicitly as "Main navigation (MICE)" and "Utility navigation" `[observed]` (dump `header.text`).
- **Primary CTA: `REQUEST DEMO`, filled `#01EF6C` (electric green), 14px/400 lh15.4, `border-radius: 2px`** `[observed, pixel]`. The next two actions are underlined all-caps text links — a three-level action hierarchy in one bar (filled → underlined → icon).
- All nav labels are **Title Case** at 16px, while the utility links are **ALL CAPS at 12–14px** `[observed]`. Mixed case convention as a tier signal.
- **Search is not in the header** — it is a glyph that opens an overlay `[observed]`.
- **Listing header differs entirely** `[observed]`: a dark bar with `cvent™`, `Venues · Promotions · Destinations · Discover · Luxury`, an **outlined white `Venues` button (the active state)**, a gear/settings glyph, and `Sign up` / `Log in` text. The two properties do not share a header.
- No mega-menu panel captured; no sticky behaviour `[observed]`.

### Hero

- **Home:** full-bleed dark video/photograph with a **left-aligned uppercase headline at 64px/400, lh 70.4px (1.1)** `[observed]` — `EXPECT MORE FROM YOUR EVENTS™`, broken across three lines. Subhead 16px/400. **Two CTAs:** a filled **green `EXPLORE THE PLATFORM`** and a **white-outlined `REQUEST A DEMO`** `[observed]`.
- **Search field count in the hero: 0** `[observed]`.
- A **circular pause control bottom-right** on the hero `[observed]` (video hero).
- **Listing hero:** a full-width **blue→purple gradient band** (measured from the PNG: left `#2D50B0`, mid `#433C99`, right `#50318C`) `[observed, pixel]` carrying a centred `Discover and Book the Perfect Event Space` heading (~32px/700, white) plus the one-line promise `No commission, no charges, no fees.` `[observed]`. Below it, **the search bar overlaps the gradient's lower edge**: a white card with **3 fields — `Location`, `Event dates`, `Event size`** with leading line icons, divided by hairlines, and a **circular blue `#0E6DE2` search button (48px)** on the right `[observed, pixel]`.
- Image treatment on the listing page: not a hero photo but a **2-column spotlight module** — left column has a small uppercase, letter-spaced eyebrow `CVENT SPOTLIGHT` above a 3-line bold heading, body copy, and a **blue `#006AE1` `Learn more ›` button**; right column is a single large photograph (`~950×575`, aspect ≈1.65) of a hotel atrium `[observed, pixel]`.
- Home page below the hero: a **logo wall on a dark green band (`#17201C`)**, logo tiles `220×90` (aspect 2.444) `[observed, pixel]`.

### Listing card anatomy

**Not inspectable.** No Cvent venue/listing DOM dump survives `[reported]`, and the single listing screenshot is taken at the top of the page where no venue card is in frame `[observed]`. The only Cvent "cards" captured are **customer logo tiles** (220×90, aspect 2.444, no radius, no border, no shadow) `[observed]`. See _Could not inspect_.

### Filters

- **Not inspectable on the listing page** (no dump) `[reported]`.
- On the home page there are **no discovery filters at all** — `typeRoles.filter-label` returns only the lead-capture form's field labels (`FIRST NAME *`, `LAST NAME *`, `WORK EMAIL *` at **12px/400 lh16.8, white**) `[observed]`. The "filter" selector matched a demo-request form, which is itself informative: **Cvent's homepage is a B2B lead-gen funnel**, not a discovery surface.
- The listing page's three search fields (`Location`, `Event dates`, `Event size`) are the filter entry point `[observed]`; no applied-filter chips or counts are visible in the frame.

### Price / capacity / rating

- **None on the home page** `[observed]` (`typeRoles.price` empty; no rating or capacity role exists).
- Social proof is a **logo wall plus three stat strings** — `20% year-over-year attendance growth`, `51% more pipeline from a flagship event`, `300K+ unique RFPs sourced via Cvent annually`, each at **14px/400 lh19.6** `[observed]`. Attributions are brand names set on the same line (`… Alkami`, `… 6sense`), not review counts. **No star ratings, no review counts, no fabricated averages** — the closest thing to a rating-free social-proof treatment in this audit `[observed]`.
- The listing hero's promise is stated as **`No commission, no charges, no fees.`** — an explicit pricing-model statement occupying the prime subheadline slot `[observed]`.

### Colour and surfaces

- **Two different action colours depending on property:**
  - cvent.com (corporate): **`#01EF6C` (electric green)** for `REQUEST DEMO` and `EXPLORE THE PLATFORM` `[observed, pixel]`.
  - cvent.com/venues (marketplace): **`#0E6DE2` (blue)** for the circular search submit and **`#006AE1`** for `Learn more` `[observed, pixel]`.
- Surfaces: white page; **`#17201C` (very dark green-black)** for the logo band and text; **gradient `#2D50B0 → #50318C`** only on the listing hero `[observed, pixel]`.
- **Shadow policy: exactly one shadow on the whole listing page — under the hero search card**, which is what makes it read as floating over the gradient `[observed]`.
- **Border radius is barely used**: `REQUEST DEMO` is `2px`, nav links `0px`, and the search card is the only softly rounded object `[observed]`. The surface language is squared-off and enterprise, in contrast with every other site in this set.

### Type hierarchy (real numbers)

| Role                              | Size | Weight | Line-height | Transform  | Colour                 |
| --------------------------------- | ---- | ------ | ----------- | ---------- | ---------------------- |
| H1 (hero, visually-hidden as 1×1) | 64px | 400    | 70.4px      | uppercase  | `#FFFFFF`              |
| Section H2                        | 48px | 400    | 52.8px      | uppercase  | `#FFFFFF` / `#17201C`  |
| Card/section heading (alt)        | 48px | 400    | 52.8px      | uppercase  | —                      |
| Nav link                          | 16px | 400    | 22.4px      | Title Case | `#17201C`              |
| CTA `REQUEST DEMO`                | 14px | 400    | 15.4px      | uppercase  | `#17201C` on `#01EF6C` |
| Utility link `FIND EVENT VENUES`  | 12px | 400    | 16.8px      | uppercase  | `#17201C`              |
| Body / stat line                  | 14px | 400    | 19.6px      | sentence   | `#17201C`              |
| Form label                        | 12px | 400    | 16.8px      | uppercase  | `#FFFFFF`              |

**Every heading is uppercase at weight 400.** The apparent "boldness" of Cvent's headlines comes entirely from the typeface (`Suisse Intl`, proprietary) and the caps, not from weight `[observed]`. Body colour is `rgb(23,32,28) = #17201C` — a green-tinted near-black, not neutral grey `[observed]`.
**Accessibility defect worth noting:** the real `H1` is a **1×1px visually-hidden element** — the visible `EXPECT MORE FROM YOUR EVENTS™` is not a heading in the document outline `[observed]`. Do not copy.

### Responsive

- **Not inspectable.** `cvent-mobile.log.txt` records a screenshot timeout at 30s and `rc=9` `[reported]`. No mobile screenshot, no mobile dump, no Wayback fallback in the evidence set. See _Could not inspect_.

### Motion

- **The only explicit transition captured in the entire seven-site evidence set is Cvent's CTA: `transition: color 0.2s, background-color 0.2s, border-color 0.2s`** at `border-radius: 2px` `[observed]`. No transform, no shadow, no scale — a pure colour-fade state change at 200ms.
- Card and content probe (`hover`) was not captured for Cvent; the header link transitions are the only motion data `[observed]`.

---

# 15. MICEbook — micebook.com

**Evidence:** `micebook-desktop.png`, `micebook-mobile.png`, `micebook-listing.png`, `micebook-{desktop,listing,mobile}.json`, matching `.log.txt`. All three loaded.
**Important correction:** `micebook-listing.json` is **not a listing grid** — its URL is `https://micebook.com/blog/2023/03/30/venues-and-events-ace-announce-rebrand/`, a **single blog article** `[observed]`. MICEbook has no vendor/venue discovery grid in this evidence set; it is an editorial community platform.

### Header / nav

- **One tier, 60px** (desktop), `position: relative`, **`background: rgba(0,0,0,0)` (fully transparent)**, `z-index: 999`, `box-shadow: none` `[observed]`. On mobile: **90px**, also transparent `[observed]`.
- Contents: `micebook.` wordmark (lowercase, with a full stop) + **5 lowercase labels — `community · events · articles · destinations · media kit`** + social icon row (`Instagram`, `LinkedIn`, `YouTube`) + a user/account glyph + a search glyph `[observed]`.
- **Every nav label is lowercase.** No capitalisation on the wordmark or any nav item — the entire brand voice is lowercase, which is a rare and cheap differentiator `[observed]`.
- **Primary CTA: none.** There is no filled button in the header at all — no sign-up, no demo request. The strongest header action is a plain text link `[observed]`.
- **The header is overlaid on the full-bleed hero image** and relies on the photograph's tone for contrast; the mobile variant sits on a **solid black** bar `[observed]`.
- **No search field in the header** — search is a glyph `[observed]`.
- **Not sticky on desktop** (`position: relative`) `[observed]`.

### Hero

- **An editorial magazine cover, not a marketplace hero.** Slides fill essentially the full viewport (image spans y≈8–695 of a 900px window) `[observed]`.
- **Search field count: 0** `[observed]`.
- The two things that make it distinctive:
  1. **Oversized slide numerals in the page margin** — a large `07` at the top-left and `08` at the top-right, white, outside the image area `[observed]`.
  2. **A vertically rotated, uppercase caption** (`POWER 30` on desktop; `DESTINATION` on mobile) set at ~40px, rotated 90°, running down the image `[observed]`.
- Copy block is bottom-left, **three stacked lines at small size**: an 8px-ish eyebrow (`Power 30`), a byline (`with micebook and event:decision`), a date/status line (`Entries Close 30 October 2026`), then an **outlined (not filled) `Enter Now` button** `[observed]`. The CTA is a thin 1px white outline on the photograph — the opposite of Eventbrite's filled CTA.
- Mobile hero: `03` numeral top-left, rotated `DESTINATION` caption, bottom-left `Destination of the Month` / `Khao Lak` eyebrow+title pair, outlined `Read Now` button `[observed]`.
- Image treatment: full-bleed editorial photography, **two-tone split** (a desaturated/blurred panel on the left third, the sharp photograph on the right two-thirds) `[observed]` — a collage effect, not a single image.

### Listing card anatomy

MICEbook has **no discovery card grid**. The nearest artefacts `[observed]`:

- **Editorial article rows** (in the `Latest Articles` rail): title at 16px/400 in two lines, then a **grey date** (`October 15, 2026`) beneath, with **1px hairline rules between rows** and no image, no border, no shadow `[observed, pixel]`.
- **Content cards** measured in the card candidates: image **755×503 → aspect 1.5 (3:2)** on desktop; **330×220 → aspect 1.5 (3:2)** on mobile — **the only reference in this set whose card aspect ratio is identical across breakpoints** `[observed]`.
- Card titles: `Monaco: one destination, endless possibilities` at **22px/400 lh26, white** (over image); list-level card titles at **14px/400 lh20, black** `[observed]`.
- Card headings are **weight 400 everywhere** — no bold card titles anywhere in the dump `[observed]`.
- **No radius, no border, no shadow** on any card ancestor `[observed]` — cards are defined purely by the image and the type beneath/over it.
- **Hover:** no hover probe captured. The card containers report `transition: all` with duration `0s` `[observed]`.

### Filters

- **No filters of any kind exist on the captured pages** — `filterContainers: []` on desktop and mobile home; the single entry on the article page is a cookie/consent or form control `[observed]`.
- Geometry confirms the absence: `desktopFilters`, `cardCandidates` and `filterContainers` are all empty or unrelated `[observed]`.
- Navigation to content is via the **5 lowercase category labels plus city/destination landing pages**, i.e. IA is taxonomy-based, not filter-based `[inferred]`.

### Price / capacity / rating

- **None.** No price role, no capacity, no rating, no review count on any MICEbook page `[observed, absent]`.
- Social proof is entirely **editorial and community-based**: an events programme (`Power 30`), a partner byline (`with micebook and event:decision`), a submissions deadline. Credibility comes from named partners and prestigious lists rather than numeric ratings `[observed]`.

### Colour and surfaces

- Action colour: **none.** There is no brand accent in the UI at all — CTAs are **transparent with a 1px white outline** `[observed]`. The only chromatic foreground found is the nav-link colour **`rgb(241,177,68) = #F1B144` (amber)**, used on one nav item (the active state) `[observed]`.
- Backgrounds: **`#000000` solid black bands** (the article-page band measured 300px tall appears solid black in the screenshot because its image failed to load, and the mobile header is solid black) `[observed, pixel]`; page white; body text `rgb(119,119,119) = #777777` `[observed]`.
- So the palette is **black, white, one amber accent** — and the amber is used once, on a nav item, not on a button.
- Shadow policy: none `[observed]`.

### Type hierarchy (real numbers)

| Role                    | Size | Weight | Line-height | Colour                |
| ----------------------- | ---- | ------ | ----------- | --------------------- |
| Card title (over image) | 22px | 400    | 26px        | `#FFFFFF`             |
| Section heading         | 30px | 400    | 33px        | `#FFFFFF`             |
| Section heading (alt)   | 23px | 400    | 26px        | `#000000`             |
| Nav link                | 16px | 400    | 24px        | `#F1B144` / `#FFFFFF` |
| Form label / body       | 16px | 400    | 24px        | `#FFFFFF` / `#777777` |
| Card title (list)       | 14px | 400    | 20px        | `#000000`             |

Body font `"Open Sans"` at 16px with body colour `#777777` `[observed]` — a mid-grey body text on white, which is a contrast risk (see below). Every heading on the site is **weight 400**; there is no bold type in the captured hierarchy at all `[observed]`.

### Responsive

- Header height **60px → 90px** and becomes **solid black** `[observed, pixel]`. This is the only site in the set where the mobile header gets _taller_.
- Nav list `['community','events','articles','destinations','media kit']` → **`[]`** (all five labels dropped) `[observed]` (dump `mobile.navAll`), leaving the wordmark and a hamburger.
- Page height 16526px (desktop) → 11513px (mobile) `[observed]` (dump `docHeight`) — content is significantly compressed rather than expanded, consistent with 2-column→1-column card reflow with a shorter card treatment.
- Card image 755×503 (desktop) → **330×220 (mobile)** — **aspect ratio preserved at exactly 1.5 across the breakpoint** `[observed]`.
- Hero retains the full-bleed treatment, the margin numeral (`03`) and the rotated caption `[observed]`.
- A mobile nav element carries **`transition: 0.3s`** `[observed]` (dump `nav-link` with `transition: 0.3s`) — the mobile menu animates on open/close.

### Motion

- **Mobile nav: `transition: 0.3s`** `[observed]` — the only declared transition on the site, on the mobile menu.
- Hero is a **carousel with explicit slide indexing** (`07`/`08` numerals, `03` on mobile), so slide transitions animate but durations were not captured `[observed, duration absent]`.
- All probed content containers: `transition: all`, duration `0s` `[observed]`.

---

# Cross-site comparison table

| Reference      | Observed pattern                                                                                                                                                                                                           | Why it works                                                                                                                                                                                                                 | Adaptation for our product                                                                                                                                                                                                         | Target component                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Eventbrite** | Search lives **in the header**, not the hero; the hero becomes a pure promotional image card (1272×393, 3.24:1) [observed]                                                                                                 | Removes the page's biggest source of layout duplication. Search is available on every page type without a hero, so the hero is free to sell rather than to function                                                          | Keep search in the second header tier (we already have a two-tier header). On category/guide pages, drop the hero search entirely and let the header search carry it, so the hero can be a single editorial or vendor-feature card | `Header` tier-2 search slot; `CategoryHero`                       |
| **Eventbrite** | Price occupies the **same metadata slot as the venue name**, with three explicit states: `Free`, `From $397.00`, `Check ticket price on event` [observed]                                                                  | The slot is fixed, so the price always lands in the same position for scanning, and the honest fallback prevents a blank gap on listings without pricing                                                                     | Adopt the fixed slot with a three-state renderer: `From ₹X per plate`, `Price on enquiry`, and `From ₹X` — never render the slot empty. `Price on enquiry` must be a styled text state, not a link                                 | `VendorCard` meta row → `PriceSlot`                               |
| **Eventbrite** | Card image radius 4px inside a card container radius 16px; 2:1 image; **no shadow anywhere** [observed]                                                                                                                    | Two radii on one component give hover/tap a surface to fill without adding elevation. Keeps a dense 4-up grid visually quiet                                                                                                 | Use 4px on the image and 16px on the interactive surface, with the surface fill as the entire hover state. No `box-shadow` on cards                                                                                                | `VendorCard` (Mantine `Paper`, `radius={16}`; `Image radius={4}`) |
| **Tagvenue**   | Price chip **over the image, bottom-right**, two lines (`from £200` at 10px/400 + `£200` at 16px/600) on `rgba(0,0,0,0.7)` with `radius: 3px`, padding `6px 8px`, inset 12px [observed]                                    | A price plate on photography is readable against any image and makes price the first scan target without competing for a text row. The two-line treatment carries the unit (`minimum spend / per session`) without a tooltip | Copy exactly: a two-line price chip, `radius: 3px`, `rgba(0,0,0,0.7)`, inset 12px, line 1 = basis (`per session` / `per plate`), line 2 = value. Use an opaque `#1A1A1A` at 70% so our pink palette stays untouched                | `VendorCard` → `PriceChip`                                        |
| **Tagvenue**   | Card is a **1px `#DEDFE3` border with `border-radius: 8px` and `box-shadow: none`**; image radius 0 and clipped by the card's top corners [observed]                                                                       | A border defines the card without elevation, so a dense 2-up grid of 500px-tall cards never looks like it is floating. Border colour is neutral enough to disappear at a glance                                              | Card = `1px solid #E5E2E6` + `radius 8px`, image fills the top with `overflow: hidden` on the card. Ban `box-shadow` on cards for the whole product                                                                                | `VendorCard` (`styles.card`, CSS Module)                          |
| **Tagvenue**   | Filter rail: **7 accordion groups with progressive disclosure** (`limit-4`, `limit-8`, `limit-no` → `+ Show more`), 14px/400 checkbox rows at 32px height, group headings 16px/700 [observed]                              | Solves the "40 filters but only 8 matter" problem without a modal. The rail stays stable while options expand in place, so the user never loses their position                                                               | Left rail, 7 groups max, 4 options visible per group, `+ Show more` expanding in place. Group heading 16px/700, option rows 14px/400 with `padding: 4px 0`. **No counts on options**                                               | `FilterRail`, `FilterGroup` (Mantine `Accordion` + `Checkbox`)    |
| **Tagvenue**   | **At mobile, the entire filter rail collapses to one 42px `Filter results` button** [observed]                                                                                                                             | The highest-value responsive decision in this audit: nothing is lost, everything moves behind one full-width trigger that names its own action                                                                               | Below 768px, hide the rail and render a sticky `Filter results` button (42px, full width) that opens a full-screen filter sheet. Keep the same filter components inside it                                                         | `FilterRail` + `MobileFilterSheet`; sticky `FilterButton`         |
| **Tagvenue**   | Card image aspect **changes 1.5 → 1.79 between desktop and mobile** [observed]                                                                                                                                             | Shorter images on mobile keep more card text above the fold in a single-column scroll, which is exactly where the decision happens                                                                                           | Set `aspect-ratio: 3/2` desktop and `aspect-ratio: 16/9` below 768px on `VendorCard` media. One CSS declaration, measurable scroll-depth gain                                                                                      | `VendorCard` media wrapper                                        |
| **Peerspace**  | **Every heading is `font-weight: 400`** — 88px/400 lh96 ls −1.76px for the H1, 56px/400, 32px/400, 20px/400 [observed]                                                                                                     | Hierarchy comes from scale + negative tracking instead of weight, so the page reads as editorial rather than as a dashboard. With a single font family this is the cheapest way to buy visual range                          | With Manrope only, use `font-weight: 400` for 40px+ display type with tracking `-0.02em` to `-0.03em`, and reserve `600/700` for ≤20px UI and card titles. Give our pink to the CTA and let the display type be neutral            | Global type scale (`styles/typography.module.css`)                |
| **Peerspace**  | Hero photograph is **documentary and captioned as inventory**: `Meeting — Splendid loft` / `PARIS, FR` set small on the hero band [observed]                                                                               | The hero simultaneously demonstrates the product and teaches the user what the inventory looks like, without a single marketing adjective                                                                                    | Caption hero imagery with real vendor context in the eyebrow slot: `Reception — Lakeside Lawns` / `Pune`. Never use a generic stock caption. Only ever with real vendor data                                                       | `Hero` caption/eyebrow component                                  |
| **Peerspace**  | Price chip `92×24`, `bg #121212`, `radius: 2px`, `padding: 0 4px`, 16px/400 white, inset 8px bottom-right of image [observed]                                                                                              | Near-square corners on a dark chip make it read as a data label rather than a badge — appropriate for a factual price                                                                                                        | Provide a 2px-radius dark price chip variant, 16px/400, inset 8px, for grid cards where the tagvenue-style two-line chip is too tall                                                                                               | `PriceChip` variant `compact`                                     |
| **The Knot**   | Two-tier header with a **deliberate colour split between the two account actions**: `Log in` solid black pill, `Sign up` solid magenta `#FF44CB` pill, side by side [observed]                                             | Brand colour marks the acquisition action; black marks the return action. Users learn the difference in one glance and the palette is not diluted                                                                            | Keep our magenta exclusively for the primary acquisition CTA (`List your venue` / `Enquire`) and render `Log in` as a black or outline pill. Never two magenta buttons in the header                                               | `Header` tier-1 action cluster                                    |
| **The Knot**   | Display leading ratio of exactly **1.0** with −2% tracking: H1 60px/60px desktop and 40px/40px mobile [observed]                                                                                                           | Tight leading keeps a two-line headline from becoming a block, and shrinking the ratio unchanged means mobile headlines keep their desktop density                                                                           | For display headings ≥40px set `line-height: 1` and `letter-spacing: -0.02em`. For everything ≤20px keep 1.4–1.5. Do not let the ratio drift across breakpoints                                                                    | Global type scale; `SectionHeading`                               |
| **The Knot**   | Tool cards: `border-radius: 16px` on the image wrapper, `overflow: hidden`, `box-shadow: none`, `display: flex; gap: 16px`, caption as one arrow-led line (`Checklist → Keep every detail organized by month.`) [observed] | A single arrow-led sentence replaces a title + description + button. It is one line of type, one affordance, and it scans instantly                                                                                          | For our "how it works" / guide tiles use one arrow-led caption string per card at 16px/400 lh22 with the 16px radius image above it. No button inside the card                                                                     | `GuideCard`, `HowItWorks`                                         |
| **Zola**       | **Horizontal list rows rather than a tile grid**: 332×222 image (1.5:1, `radius: 16px`) left, a 584px text column right, one vendor per row, hairline rules between rows [observed]                                        | Gives each vendor 584px to state capacity, inclusions and a one-line description — impossible in a 300px tile. Right for considered, high-intent comparison                                                                  | Offer a list/grid toggle on our vendor results. Implement the list view with the same `VendorCard` data, image 1.5:1 `radius 16px`, 24px gap, text column flexible, `1px` hairline `border-bottom` per row                         | `VendorResults` view toggle; `VendorCard variant="row"`           |
| **Zola**       | Filter rail is a set of **nine fully-collapsed accordion toggles** (only the group labels render); above the results sit `1000+ Wedding Venues` and a `Sort: Distance` pill on `#F3F3F3` [observed]                        | Fully collapsed rails keep the results column visually dominant. Stating the result count and the sort explicitly (not "Relevance") sets expectations and reduces futile clicking                                            | Collapse our rail to group labels only by default; show `<N> vendors` above the results and an explicit sort pill (`Nearest`, `Price`, `Capacity`) on a neutral `#F5F3F6` surface. Never default to a vague "Relevance"            | `FilterRail`, `ResultsHeader`, `SortPill`                         |
| **Zola**       | Nested quote surface: `background: #F3F3F3`, no border, no shadow, distinguished from the row purely by fill [observed]                                                                                                    | Proves a callout can be separated from its parent using one neutral fill and zero elevation — meaning we do not need a shadow rule to build inset content                                                                    | Use a single neutral inset surface (`#F7F5F8`) with `radius: 8px` for any nested panel (enquiry prompt, price band, vendor note). No border, no shadow                                                                             | `InsetPanel` primitive                                            |
| **Cvent**      | The **only explicit transition in the whole seven-site set**: `transition: color 0.2s, background-color 0.2s, border-color 0.2s` at `border-radius: 2px` on the primary CTA [observed]                                     | 200ms on colour properties only is imperceptible as motion but removes the "instant flip" harshness of a state change — and it costs nothing in layout or paint                                                              | Standardise one motion token: `--motion-state: 200ms ease` applied to `color`, `background-color` and `border-color` only. No transform, no shadow, no scale on any control                                                        | Design token `--motion-state`; `Button`                           |
| **Cvent**      | Social proof as **named stat strings in body text** — `20% year-over-year attendance growth` / `51% more pipeline` / `300K+ unique RFPs`, each 14px/400 lh19.6 with the brand name on the same line [observed]             | Credibility without a rating system. The claim and its source sit in one line of body type, so nothing is implied that cannot be attributed                                                                                  | Where we must show outcomes (e.g. "avg. response time"), render them as one-line body text at 14px/400 with a **named, real source**. Never as a star row, never as an unreferenced number                                         | `StatLine`; content guidelines                                    |
| **Cvent**      | Mixed case convention as a tier signal: **Title Case 16px for main nav**, **ALL CAPS 12–14px for utility actions**, all at weight 400 [observed]                                                                           | Case alone separates "where am I going" from "what do I do" — no weight change, no colour change, no divider needed                                                                                                          | We already have two header tiers. Differentiate tier 2 by case rather than by weight: Title Case for browse destinations, and reserve caps+tracking for utility actions only                                                       | `Header` tier rules                                               |
| **MICEbook**   | **Every nav label and the wordmark are lowercase**; five plain labels, no filled button in the header at all [observed]                                                                                                    | A lowercase bar reads as editorial rather than corporate and removes the visual weight of capitalised nav — useful when the header must not compete with photography                                                         | Do not lowercase the wordmark, but consider sentence-case nav labels. Keep **zero filled buttons in the header** if we ever move the primary CTA into a page body — a header with no fill lets the hero carry the action           | `Header` label casing; header CTA policy                          |
| **MICEbook**   | **Card aspect ratio preserved at exactly 1.5 across breakpoints** (755×503 desktop → 330×220 mobile) [observed]                                                                                                            | Photographs keep their intended composition at every size, so the same asset never needs a second crop and the grid rhythm stays predictable                                                                                 | Where the image is the message (vendor gallery, destination guide), pin `aspect-ratio: 3/2` at every breakpoint and use `object-fit: cover`. Reserve aspect changes for the _listing card only_                                    | `GalleryImage`; `VendorCard` media                                |
| **MICEbook**   | Small **vertical (rotated 90°) uppercase caption** running down the hero image (`POWER 30`, `DESTINATION`), with an oversized slide numeral in the page margin (`03`/`07`/`08`) [observed]                                 | Produces a magazine-cover feel from type alone, with no extra imagery — a strong identity for near-zero asset cost                                                                                                           | Not for the homepage. Use a vertical rotated label on **featured-vendor/destination guide heroes only**, maximum one per page, at ~40px uppercase with wide tracking                                                               | `GuideHero` accent label                                          |

---

# What NOT to copy

1. **Cart, checkout and order surfaces.** Zola ships a header `Shopping cart` link (`/cart`, 44×44) and a `Track order` / `Start a return` / `Return policy` footer cluster `[observed]`; Eventbrite ships a ticketing path with `Find my tickets` in the primary nav `[observed]`. We have no cart, no booking and no payments. **No cart icon, no "add to cart", no order-status affordance anywhere.**
2. **Ticket inventory and scarcity mechanics.** Eventbrite's `Sales end soon`, `Almost full` and `Promoted` chips, plus `from$100/hr`-style availability framing `[observed]` are inventory-pressure devices for a transactional funnel. **Do not port sales-deadline or scarcity chips.** A neutral factual state (`Accepts enquiries` / `Booking for 2026`) is fine; manufactured urgency is not.
3. **Ratings, star rows and review counts of any kind.** Zola: star glyphs + `5.0` + `Ratings include Zola and Google reviews`, plus a quoted review with a name and an age (`Bradley P., 10 months ago`) inside a dedicated `#F3F3F3` surface `[observed]`. Peerspace: `★ 5.0 (122)` `[observed]`. Eventbrite: `5k followers` `[observed]`. Tagvenue: `(317)` after the venue name plus a truncated reviewer quote `[observed]`. **All forbidden by our brief and by the fabricated-ratings constraint.** Anything resembling an average, a count, an attribution or a percentile must not be built — including placeholders that look like ratings in an empty state.
4. **Sponsored / paid-placement disclosure as a feature.** Zola renders `How do we sort results, including Sponsored Ads and personalized results?` with an info glyph as a first-class UI element, and defaults the sort to `Distance` `[observed]`. Copying the _disclosure_ implies we operate a paid-placement ranking. **Do not build the disclosure component unless we actually sell placement.**
5. **Region-locked and geo-forced content.** Peerspace's nav is a country selector (`Deutschland | United Kingdom | United States | Canada | Australia | España | France`) `[observed]` and its search pre-fills a city (`San Francisco, CA, US`) `[observed]`. Tagvenue's mobile menu is a hard-coded city list (London, Manchester, Birmingham, Leeds, Edinburgh, Liverpool, Glasgow, Bristol, Nottingham, Brighton, Newcastle, Cardiff) plus a worldwide set `[observed]`. **Do not ship a hard-coded geographic list or a country switcher.** Locations must come from data.
6. **Programmatic all-cities SEO rails.** Tagvenue's homepage renders 11 city H2s of near-identical copy (`Popular venues for hire in London`, `Top event venues available in Manchester`, … each 1148×53) `[observed]` — templated doorway content. Do not replicate the pattern; build one location hub per city with genuinely distinct content or `noindex` it.
7. **B2B lead-capture as the primary page mode.** Cvent's homepage primary CTA is `REQUEST DEMO`, its only `filter-label` matches are `FIRST NAME *` / `WORK EMAIL *` in an 8-field demo form `[observed]`. **Do not put a lead form in the hero or above the results.** Our lead generation happens on the vendor enquiry, not on a gated demo.
8. **Video-by-default with no consideration for cost.** The Knot and Cvent both ship full-bleed autoplaying video heroes with a pause control `[observed]`. Pause controls are mandatory if we autoplay, and autoplay is expensive on mobile data. **Do not add a video hero.**
9. **The accessibility defects:** Cvent hides its real `H1` as a **1×1px** element while the visible headline is not a heading `[observed]`; MICEbook sets **body text at `rgb(119,119,119)` on white** (≈4.0:1, below AA for body copy) `[observed]`; Peerspace promotes a **card distance string to `H3`**, so the document outline is a list of "18.6 miles from Abingdon, MD" `[observed]`. **Copy none of these.** One `H1` per page, ≥4.5:1 for body text, and card titles as the heading level.
10. **Proprietary webfonts.** Every site here ships a proprietary face — `Founders Grotesk R` (Eventbrite), `Inter` (Tagvenue, licensed), `ABC Social` (Peerspace), `ods-font-secondary` (The Knot), `Circular` (Zola), `Suisse Intl` (Cvent), `Open Sans` (MICEbook) `[observed]`. **We have Manrope only.** Where a reference relies on a wide grotesque for all-caps heads (Cvent), or a serif display for the hero (Zola), Manrope will not reproduce it — substitute tracking and weight rather than adding a second family.
11. **Shadows.** Not one of the seven sites uses a card shadow: Peerspace, Zola, The Knot and MICEbook report `box-shadow: none` on every card ancestor; Tagvenue uses a 1px border; Eventbrite uses a radius-only container `[observed]`. **Do not introduce `box-shadow` to separate cards.** Use borders, fills and hairlines. The single exception worth keeping is one shadow under an overlapping hero search card — and only if it genuinely overlaps.
12. **Reveal-on-scroll / card lift / image zoom.** Not one probed card in seven sites changed `transform`, `box-shadow` or ran a non-zero transition on hover `[observed]`. Do not invent hover elevation as a default; the pattern is not in the reference set and it fights the flat surface language these sites share.

---

# Could not inspect

Named explicitly, with the reason, so nothing below is claimed anywhere above.

1. **Peerspace live site — all page types.** `peerspace-desktop.png`, `peerspace-listing.png` and `peerspace-mobile.png` are all nginx `502 Bad Gateway` pages (`STATUS 403` → `TITLE 502 Bad Gateway`) `[reported]`+`[observed]`. Everything reported for Peerspace comes from the two **Wayback Machine** captures (`web.archive.org/web/20251005215616/https://www.peerspace.com/` and `…/20250717215136/…/venues/abingdon--md/rooftop-venue`) and from three probe files. I did not see the live site.
2. **Peerspace mobile — any layout.** No mobile Wayback capture, no mobile dump (the only mobile JSON is the 502 page). Mobile column count, header collapse, hero behaviour and filter pattern for Peerspace are **unknown**.
3. **Peerspace filter UI.** `filterContainers` is `[]` on both Wayback captures. Filtering is only visible as URL query parameters (`?a=event&location=abingdon--md&space_type=rooftop`). I could not see the filter control, applied-filter chips, or any count.
4. **Peerspace venue-profile page.** The Wayback listing capture is a venue-_type_ landing page (`/venues/abingdon--md/rooftop-venue`) plus a thumbnail grid. No individual vendor profile page was captured, so pricing blocks, gallery layout and enquiry form on a profile are **uninspected**.
5. **The Knot listing page and mobile page — visually.** Both `theknot-listing.png` and `theknot-mobile.png` are **PerimeterX "Verification Required"** interstitials (slide-to-secure widget, bot-detection explanation, `ID: befb811c-…` / `ID: 883bf38a-…`) `[observed]`. I saw the block page, not the site.
6. **The Knot vendor cards, filters, price and responsive layout.** `theknot-listing.json` and `theknot-mobile.json` contain real DOM values (`docHeight`, `header`, `typeRoles`, one `H1`) captured before the interstitial, but no card candidates, no filter containers and no nav link text. **Card anatomy, filter UI, price display, rating display and mobile layout for The Knot are unknown.** The nav labels I listed for The Knot come from the desktop dump's `header.text`, and the `navAll` entries are **footer SEO links**, not the header nav.
7. **The Knot hover states and motion.** No hover probe was captured for The Knot at all. Any motion claim for The Knot would be invention.
8. **Cvent listing page — DOM.** `cvent-listing.log.txt` records `STAGE pre-extract 96349 ms` followed by `WATCHDOG_TIMEOUT_MS 105000` and `rc=9` `[reported]`. There is **no `cvent-listing.json`**. I have one screenshot of the top of `/venues` and nothing else.
9. **Cvent venue cards, filters, price and capacity.** Not visible in the single listing screenshot (the frame shows a search bar and a spotlight module) and not present in any dump. **Cvent's listing card anatomy is entirely unmeasured.**
10. **Cvent mobile — everything.** `cvent-mobile.log.txt` records `SCREENSHOT_ERROR TimeoutError: page.screenshot: Timeout 30000ms exceeded`, `rc=9` `[reported]`. **No Cvent mobile screenshot, no mobile dump, no responsive evidence of any kind.**
11. **Eventbrite mobile grid and filters.** The `eventbrite-mobile.png` screenshot is **~55% covered by a cookie-consent sheet** (`Accept all` / `Reject all` / `More choices`) `[observed]`. Mobile column count, mobile filter entry point and the mobile hero's lower half could not be read. The mobile dump confirms header height, nav items and type sizes only.
12. **Eventbrite card title typography.** `typeRoles["card-title"]` is empty on both the desktop and listing dumps, so the exact `font-size`/`font-weight` of an event card title is **not captured**; my ≈16px/600 is `[inferred]` from the screenshot and labelled as such.
13. **Eventbrite applied-filter chips and removal.** Not present in the dumps and not visible in the listing screenshot. How Eventbrite surfaces and removes an applied filter is **unknown**.
14. **Tagvenue applied-filter chips and removal; sort control; result count.** The rail's seven groups and their option labels are fully captured, but no applied-state chip, no sort control and no result count appear in the dump or in the two screenshots. Any claim about them would be invention.
15. **Tagvenue `Browse spaces` dropdown / mega-menu contents.** The button exists (a `BUTTON` with a 144×36 hit area) but the panel was never opened in any capture. Panel layout, column count and contents are **unknown**. The same applies to Zola's three dropdowns (`Wedding venues`, `Vendors`, `Destination weddings`), Eventbrite's `Help Center ▾`, Cvent's five dropdowns and Peerspace's `Browse Spaces ▾` — **not one mega-menu panel exists in this evidence set.**
16. **MICEbook as a discovery marketplace.** `micebook-listing.json` is a **single blog article** (`/blog/2023/03/30/venues-and-events-ace-announce-rebrand/`), not a listing grid. `filterContainers` is empty on all three MICEbook pages. MICEbook has **no vendor card grid, no filters and no price/capacity/rating display** in this evidence set, so it contributes layout and identity patterns only — not marketplace patterns.
17. **MICEbook desktop nav dropdowns, search and account states.** Transparent overlay header over the hero; no dropdown or search overlay was opened. The `user` and search glyphs are visible but their destinations are **uninspected**.
18. **Zola mobile listing page and mobile filters.** `zola-mobile.json` is the **homepage**, not the listing — `filterContainers: []`, no venue cards. Zola's mobile filter pattern (sheet vs rail vs button) is **unknown**.
19. **Zola applied-filter chips and removal.** Not in the dump; not visible in the listing screenshot at rest. **Unknown.**
20. **Zola hero H1 computed typography on desktop.** The serif display face used for the desktop hero was not captured in `typeRoles.h1` for the desktop dump; only the mobile `32px/500/36px` value exists. The desktop hero's exact size, weight and family are **unmeasured** — I described it from the screenshot as `[observed]`/`[inferred]` only.
21. **The `cvent-desktop.png` uppercase display type.** Cvent's computed `letterSpacing` reads `"normal"` while the type appears widely tracked. That is a function of the proprietary `Suisse Intl` typeface, not a CSS property — I cannot reproduce the effect by copying a value, so no tracking figure is given.
22. **Colour values for elements covered by text or antialiasing.** All hex values above were sampled at points chosen to avoid glyph edges, but a sample taken over a gradient (the Cvent listing hero) varies by position; the three samples given (`#2D50B0` / `#433C99` / `#50318C`) bound the gradient rather than define it. No CSS gradient stops were captured in any dump.
