# Reference audit A — references 1–8 (India-first wedding & event marketplaces)

Owner: subagent "references 1–8". Scope: Weddingz.in, WedMeGood, WeddingWire India, BookEventz,
WeddingBazaar, ShaadiSaga, VenueLook, PartyBookr.

## How this was produced, and what the evidence actually is

**Evidence base.** All claims below are tagged:

- `[observed]` — I looked at the screenshot myself, or read the value out of a raw DOM/computed-style dump.
- `[reported]` — secondary source, or a value the running page reported about itself (e.g. a "1473 Venues" string).
- `[inferred]` — my reading/interpretation, not a measurement.

**Important integrity note about the evidence set.** The brief said the raw dumps for these 8 sites
already existed. They did not. On 2026-10-16 the `docs/research/raw/` directory contained
`<site>-desktop.json` / `.log.txt` pairs for **only** `eventbrite, tagvenue, peerspace, theknot, zola,
cvent, micebook` — that is, **references 9–15**. A `grep` for `weddingz|wedmegood|weddingwire|bookeventz|weddingbazaar|shaadisaga|venuelook|partybookr`
across `docs/research/raw/` returned **zero files**. References 1–8 had **screenshots only**.

Rather than invent numbers, I regenerated the missing structural/computed-style dumps for refs 1–8 by
pointing the previous agent's existing, unmodified harness (`_capture.mjs`, driven by `_sites.json`) at
these 8 sites, using the same chromium build and the same 1440×900 / 390×844 viewports. New files are
written to `docs/research/raw/<site>-{desktop,listing,mobile}.{json,log.txt}`. Every numeric typography,
radius and shadow value below is read from those dumps, so it is `[observed]` at the level of _computed
style in a real render_ — not a guess from a JPEG.

Two caveats that apply site-wide:

1. **Both harnesses send a desktop Chrome user-agent even at a 390 px viewport.** Sites that do
   UA-based device detection therefore render their _desktop_ layout at 390 px. This is visible in the
   Weddingz mobile screenshot (desktop nav row clipped at the right edge) — for such sites I cannot
   assess the real mobile design and I say so. Sites that use pure CSS media queries do show a genuine
   mobile layout.
2. **The re-capture rewrote screenshots in place.** I took a pristine copy of all 129 pre-existing PNGs
   before the sweep reached sites 2–8 and read those originals; where a fresh capture produced better
   evidence (e.g. a listing page that previously 404'd) I say which file I looked at.

### Outcome at a glance

| #   | Site              | Homepage                                                             | Listing / results page                    | Mobile layout                          | Blocked?               |
| --- | ----------------- | -------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------- | ---------------------- |
| 1   | Weddingz.in       | `[observed]` real                                                    | `[observed]` real, 1473 results           | `[observed]` genuine mobile on listing | No                     |
| 2   | WedMeGood         | `[observed]` **redirected to a Real Wedding page**, not the homepage | `[observed]` **404 page** — URL was wrong | `[observed]` real mobile home          | Partially              |
| 3   | WeddingWire India | `[observed]` real                                                    | `[observed]` real                         | `[observed]` real mobile               | No                     |
| 4   | BookEventz        | `[observed]` real                                                    | `[observed]` real                         | `[observed]` real mobile               | No                     |
| 5   | WeddingBazaar     | `[observed]` real                                                    | `[observed]` real                         | `[observed]` real mobile               | No                     |
| 6   | ShaadiSaga        | **blocked**                                                          | **blocked**                               | **blocked**                            | **Yes — bot wall**     |
| 7   | VenueLook         | `[observed]` real                                                    | `[observed]` real                         | `[observed]` real mobile               | No                     |
| 8   | PartyBookr        | `[observed]` real (tiny/landing)                                     | n/a — no listing exists                   | `[observed]` real                      | No listing page exists |

---

## 1. Weddingz.in — `weddingz.in`

Evidence: `shots/weddingz-desktop.png`, `-listing.png`, `-mobile.png`, `-listing-mobile.png`,
`-desktop-hover.png`; dumps `raw/weddingz-desktop.json`, `raw/weddingz-listing.json`.

### Header / nav

- **Two tiers, and the tiers change meaning between home and listing.** `[observed]`
- Home: tier 1 and tier 2 sit **transparent on top of the hero** with white text and no border or shadow.
  Tier 1 = logo `Weddingz.in` + a city `<select>` immediately to the right of the logo + `List Your Business`
  and a circular avatar icon on the right. Tier 2 = `Venues · Vendors · Blog · Real Weddings · Photos ·
Testimonials · Why Weddingz`, with a house icon before _Venues_ and a phone icon + `Call` on the right.
  Nav is **7 items** here; `header` is `position: relative`, height ~93 px, `z-index: 3`,
  `background: rgba(0,0,0,0)`, `box-shadow: none` → **not sticky, no elevation** `[observed]` (dump).
- Listing: the header becomes an **opaque near-black band carrying the search form** — a 5-segment
  control (city/locality text, "Near Me" pill, Locality, Event Date, Guests, Budget) plus a solid
  pink **Search** button; the 8-item nav strip (`Venues▾ Services▾ Blogs▾ Real Weddings▾ Photos▾ Deals
Testimonial Why Weddingz▾`) then sits **below** the search bar on white with caret dropdowns.
  So the listing header is a _search header_, not a _nav header_ `[observed]`.
- Primary CTA: home = the city `<select>` (city choice _is_ the conversion); listing = pink `Search`.
  A persistent dark pill, `Plan your Destination Wedding. Click here.`, floats bottom-right `[observed]`.
- Nav item metrics: `font: 600 14px Lato`, `line-height: 18px`, white, `padding: 8px 12px`,
  `text-transform: capitalize` `[observed]`. `List Your Business` is a small ghost button:
  `600 12px`, `border-radius: 2px`, `border: 1px solid transparent`, `padding: 4px 10px`,
  `transition: 0.15s ease-in-out` `[observed]`.

### Hero

- Full-bleed photograph, **1440×720** (half the 1440×900 viewport), real couple photo, no gradient scrim
  visible over the middle — the H1 sits directly on the photo `[observed]`.
- H1 is **one sentence over two lines, centred, sentence-cased**: "Plan Your Wedding With / India's
  Largest Wedding Co." — `36px / 500`, `line-height: 45px`, `letter-spacing: 0.1px`, white,
  `text-transform: capitalize`, `margin-bottom: 30px` `[observed]` (dump). Note the weight is **500, not 700**.
- **Search contains exactly ONE field**: a white `Select City` dropdown, ~440×40 px, 4 px radius. There
  is **no** date, guest-count, budget or keyword field, and **no visible submit button** `[observed]`.
  This is a deliberate one-decision hero.
- Below the hero, on white: a promo line "Hassle Free Planning & Booking at Our Guaranteed Best Prices."
  at `500 22px`, `line-height: 24.2px`, `rgb(55,55,55)` `[observed]`; then a trust row with three
  claims separated by small coloured dots (10,000+ Events Organized till Date · Present in 25+ Cities ·
  Over 20,000+ Wedding Venues & Vendors) `[observed]`.

### Card anatomy

- Two different card systems. Home shows **city tiles** (image 255×213 box, `radius: 4px`,
  `object-fit: fill`, natural 300×250 → **ratio 1.2 / 6:5**), each tile `275×323`, with the city name
  as an `H3` at `600 18px Lato`, `line-height: 30.06px`, `rgb(112,111,109)` `[observed]` (dump).
- Listing cards are **horizontal, image-left**, one per row, on a white card separated by a hairline:
  media column **365×263 (ratio 1.39)**, `border-radius: 4px`, natural 640×359, `object-fit: fill`;
  under the main image a 4-up thumbnail strip at **88×52 (1.69)** and a `+6 View All` overlay on the last
  thumb; a `W2 Managed` white badge top-left; white circular prev/next arrows at the image edges `[observed]`.
- Text column order `[observed]` (screenshot) with measured roles `[observed]` (dump):
  1. Title — "Lagoona Emerald Serviced by Weddingz", `700 20px Inter`, `lh 26px`, `ls 0.35px`, `rgb(33,33,33)`
  2. Address/subtitle — `... Wazirpur, ...`, ~13 px grey
  3. `50 Pax Packages Available`
  4. Pill row: `125-200 Guests` and a phone pill `+91-8048071681`
  5. Description, 2-line clamped, `500 14px Inter`, `lh 20px`, `ls 0.2px`, `rgb(33,33,33)`
  6. `Read more` — pink text link
  7. Tag pills: `Banquet Halls`, `Birthday Party Halls`, `Party Halls`
  8. Bottom row: green veg mark + `Vegetarian` · **price** `₹1100/Plate` · right-aligned outlined icon
     button + solid pink `See Prices`
- **The price is co-equal with the title at 20px/700 and pure black** — `₹1100` is `700 20px Inter`,
  `rgb(0,0,0)`, while `/Plate` is deliberately demoted to `500 14px`, `rgb(199,199,199)` `[observed]` (dump).
  It is the strongest ink on the card.
- Corner radius: **4 px, applied to images, not to the card container** — card containers report
  `border-radius: 0px` and `box-shadow: none` `[observed]` (dump). Card separation comes from a thin
  border on white over a very light grey page, not from elevation.
- **Hover: nothing happens.** `-desktop-hover.png` is byte-near-identical to `-desktop.png`
  (716 748 vs 716 752 bytes) and the hover probe reports `transform: none`, `box-shadow: none`,
  `transition-duration: 0s` before _and_ after `[observed]`. Interactivity on a card is the image
  carousel arrows and the two buttons only.

### Filters

- **Left rail, 300 px wide, sticky-looking, with an explicit "Applied Filters" block on top.**
  `[observed]`: `Applied Filters (1)` + pink `Clear`, then a removable pill `Banquet Halls ✕`.
  Every section header repeats the pattern `Section (count)` + pink `Clear` and a hairline divider
  (`Locality (0) Clear`, `Venue Budget … Clear`).
- Control types: a `Search Locality` text box per facet + checkbox lists with **right-aligned result
  counts** (`Dwarka 125`, `Rohini 106`, `Shahdara 67`, `Chattarpur 67`, `Connaught Place 62`), a
  `+ Show More` disclosure, and for budget a row of **outlined pills** (`Less than 1 Lakh`, `1-2 Lakh`) `[observed]`.
- Count and structure `[observed]` (dump): the rail container `venueList__filter-row` is 300 px wide and
  3771 px tall, carrying **4 `Clear` buttons, 1 facet search input and 3 `+ Show More` buttons** →
  4 filter facets. The results bar reports **"Banquet Halls in Delhi (1473 Venues)"** `[reported]`.
- Removal is **per-pill `✕` and per-section `Clear`**, plus a global `Clear` in Applied Filters `[observed]`.
- Responsive: the rail classes are literally `oyo-cell--hide-tablet oyo-cell--hide-phone` → the rail is
  **hidden below desktop**, and mobile exposes a `Filters (2)` button instead `[observed]` (dump + mobile shot).

### Price / capacity / reviews

- Price: `₹1100/Plate` — rupee symbol and amount at 20px/700 near-black, unit demoted to grey 14px,
  `margin-left: 20px`. **The price is the scan anchor**, tied with the title for largest text and beat
  by nothing for contrast (pure black vs `rgb(33,33,33)`) `[observed]`.
- Capacity is not a number-only field: it is a **pill** `125-200 Guests`, i.e. a range badge, placed
  directly under the address `[observed]`.
- Reviews: a solid **teal/green** badge top-right of the card: `★4.6/5 | 11` — rating and review count
  in one pill. Only some cards have it `[observed]`.
- A `50 Pax Packages Available` line sits between address and pills — inventory, not capacity `[observed]`.

### Colour and surfaces

- Action colour on home nav/links: **`rgb(255, 53, 59)` = `#FF353B`** (a red), used for the logo accent
  and small nav links `[observed]` (dump). On the listing page the primary button is **pink/magenta**
  (`Search`, `See Prices`) with a matching pink `Read more` link `[observed]` (screenshot).
  So Weddingz runs **two accents** — red on brand/nav, pink on commerce/action. For our single-accent
  pink palette this is a simplification we should _not_ copy.
- Page background: white body (`rgb(255,255,255)`) with a **very light grey** behind the results grid
  `[observed]`. Body text `rgb(112,111,109)` (`#706F6D`), headings `rgb(72,72,72)` / `rgb(33,33,33)` `[observed]`.
- **Shadow policy: essentially none.** Header shadow `none`, card container shadow `none`, city tile
  shadow `none`; depth is done with borders and background tint `[observed]` (dumps).
- Neutral coverage is high (~90% of the listing page is white/grey/black); pink appears only on the
  primary button, links, and the active-filter affordances.

### Type hierarchy

Exactly three families are declared (`Lato`, `Open Sans`, `Inter`) which is two too many `[observed]`.
Measured roles `[observed]`:

| Role                   | Value                                            | Note                                     |
| ---------------------- | ------------------------------------------------ | ---------------------------------------- |
| Display (hero H1)      | `500 36px/45px`, ls 0.1px, white                 | weight 500; capitalised                  |
| Section heading        | `600 23px/28.75px`, `rgb(72,72,72)`              | e.g. "Browse Wedding Venues and Vendors" |
| Page H1 (listing)      | `700 20px/26px`, ls 0.35px, black                |                                          |
| Card title             | `700 20px/26px`, ls 0.35px, `rgb(33,33,33)`      | identical size to the listing H1         |
| Metadata / description | `500 14px/20px`, ls 0.2px, `rgb(33,33,33)`       |                                          |
| Price                  | `700 20px/26px` black, unit `500 14px` `#C7C7C7` |                                          |

Notable: body base is **12 px** `[observed]`, and there is **no size step between page H1 and card
title** — hierarchy there is carried by colour and position, not scale.

### Responsive

- Genuine mobile layout on the **listing** page `[observed]`: dark sticky-ish header collapses to
  hamburger + logo + search icon + phone icon; a back-arrow bar carries the H1 ("Banquet Halls in Delhi");
  the 5-segment search becomes a **2×2 grid of four compact dark filter pills** (Locality, Event Date,
  Guests, Budget) plus a 5th `Filters (2)` control with a sliders icon; the left rail disappears;
  cards become **vertical** with a full-bleed image, `VIRTUAL TOUR` badge, peeking thumbnails;
  the two CTAs become a 50/50 pair (`Venue Tour` outlined, `See Price` solid); a circular green
  WhatsApp float button is added `[observed]`.
- The **home** mobile screenshot is unusable: it renders the desktop layout at 390 px with the nav row
  and hero copy clipped off the right edge `[observed]`.

### Motion

- Only detectable transition: `0.15s ease-in-out` on the `List Your Business` ghost button `[observed]` (dump).
- Card hover: **no transition, no transform, no shadow** (`transition-duration: 0s` before and after) `[observed]`.
- The listing image carousel uses instant arrow clicks; no duration is declared on the card itself `[observed]`.

### What to take / leave

Take: the one-field hero, the pill-shaped capacity range, the 4 px image radius with zero elevation,
the `Applied Filters (n)` + per-pill `✕` removal pattern, section-level counts on facets, and the
demoted price unit. Leave: the two-accent red+pink system, three font families, the 12 px body base,
and the amber fake-urgency band (see "what NOT to copy").

---

## 2. WedMeGood — `wedmegood.com`

Evidence: `shots/wedmegood-desktop.png` (a **fresh capture that landed on the real homepage**;
the pre-existing file was a _Real Wedding_ detail page, so I re-captured), `shots/wedmegood-listing.png`
(**re-captured** — the original was a 404), `-listing-mobile.png`, `-mobile.png`;
dumps `raw/wedmegood-{desktop,listing,mobile,mlisting}.{json,log.txt}`.

> Correction worth recording: the original evidence used `wedmegood.com/vendors/delhi/wedding-venues/`,
> which is a 404. The working URL shape is `/vendors/<city>/wedding-venues/all/<category>/`, and the
> Delhi slug is **`delhi-ncr`**, not `delhi`. I captured
> `/vendors/delhi-ncr/wedding-venues/all/banquet-hall/` — HTTP 200, title "20 Best Banquet Halls in Delhi Ncr with Price".

### Header / nav

- **Two tiers, both pink** `[observed]`. Tier 1 is a deep magenta strip (`#C2185B`-range): left
  "India's Favourite Wedding Planning Platform", centre a **white filled `<select>`** ("All Cities" on
  home, "Delhi NCR" on the listing), right `Write A Review` and `Download App` with icons, white ~14px.
  Tier 2 is a brighter hot pink: logo wordmark + knot mark, then **7 nav items** — `Venues, Vendors,
Photos, Real Weddings, Blog, E-Invites, Genie` — then an outlined circular search button and a
  **`Log In` pill whose background is a darker pink than the bar** `[observed]`.
- Header metrics `[observed]` (dump): total height **90 px**, `position: static` (**not sticky**),
  `background: transparent` (the pink comes from inner elements), `z-index: 9`, no shadow.
- Nav labels measure `400 16px`, `line-height: 26px`, white; the utility-strip labels `400 14px` `[observed]`.
- **No dropdown carets anywhere in the nav** — unlike Weddingz, WedMeGood's nav is flat links `[observed]`.
  That is feasible precisely because it has 7 short labels and a separate full-width filter bar.

### Hero

- Full-bleed photo, 1440 wide × ~520 tall, with a **dark scrim concentrated at the bottom-centre** so the
  centred white copy reads `[observed]`.
- H1 is a **four-word emotional promise, not a category**: "Your Wedding, Your Way" — `600 40px`,
  white, centred, `margin: 0` `[observed]` (dump). Weight is **600** (not 800), so it reads warm.
- Sub-line: "Find the best wedding vendors with thousands of trusted reviews" — `400 22px`,
  white, centred, `margin-top: 10px` `[observed]`. The sub is doing the SEO/value work; the H1 is doing none.
- **Search sits inside the hero as a 3-segment white bar**: `Select vendor type` ▾ | `Select city` ▾ |
  solid pink **`Get Started`** — i.e. **2 fields + CTA**, and the CTA verb is _Get Started_, not _Search_ `[observed]`.
- Below the search, still inside the hero: `Popular Searches:` followed by **plain pipe-separated text
  links** (Wedding Photographers in India | Bridal Makeup Artists in India | Wedding Cards in India |
  Wedding Venues in India) wrapping onto two lines — deliberately not pills `[observed]`.
- Image treatment: a credited stock photo with a **visible "Photo Credits : Shutterstock"** line in the
  hero corner `[observed]`, and a faint oversized logo watermark on the left. The credit line is evidence
  the imagery is licensed, which is directly relevant to our own imagery policy.

### Card anatomy

Two card families.

1. **Home "Popular Venue Searches" rows** — image left (~180×90, radius ~4 px) + title (~17 px/600 near-black)
   - a **pink pipe-separated city link line** ("Mumbai | Bangalore | Pune | More"), three visible at a time
     with a **circular white next-arrow button** at the right edge → a horizontal carousel `[observed]`.
2. **Listing vendor cards** — a 3-up grid, gap ~28 px, card container **400×385** `[observed]` (dump + shot).
   - Image: **380×214 → ratio 1.776 (≈16:9)**, radius ~4 px, `alt="vendor-pic"` on every card
     (an accessibility defect worth noting) `[observed]`.
   - Overlays: a small **amber/orange crown badge top-left** (rank/award) and a **dark translucent circular
     media indicator bottom-right** `[observed]`.
   - **Exact metadata order** `[observed]` (dump, from the hover probe on card 1 — the full card text):
     1. `Madhavgarh Palace` — title, ~17 px/700 near-black
     2. `★ 5.0 (19 reviews)` — **pink star + bold score + gray review count, right-aligned on the title row**
     3. `📍 Gurgaon, Gurgaon` — location, 14 px/400, `rgb(144,144,144)`, **truncated with an ellipsis**
     4. `🏛 Heritage Palace Hotel` — property type, same 14 px gray
     5. price as a **2-column mini-table**: headers `Veg` / `Non veg`, values `₹ 3,000 per plate` /
        `₹ 3,250 per plate` — amount ~16 px/700 near-black, `per plate` small gray
     6. attribute pills: `100-2500 pax`, `75 Rooms`, `+4 more` — small light-tinted pills, ~12 px
   - Radius/border/shadow: **no resting border or shadow**; page background is `rgb(251,251,251)` with
     white cards, so separation comes from the tint difference `[observed]`.
   - **Hover is the best-measured motion in this audit**: card `transition: 0.3s ease` (all properties);
     before = `box-shadow: none`, `background: rgba(0,0,0,0)`; after = **`box-shadow: rgba(0,0,0,0.05) 0px 0px 15px 0px`
     and `background: rgb(255,255,255)`** — a 5 % black 15 px ambient glow, **no translate, no scale, no border change** `[observed]` (dump).

### Filters

- **A full-width horizontal filter bar directly under the header — not a sidebar.** Container class
  `unfixed-filter`, 1440×50 `[observed]` (dump).
- **8 controls, text-only styling** (a label + a caret, no pill, no border), spread evenly across the
  full width: `Locality▾`, `No. of Guests▾`, `Room Count▾`, `Price per plate (Rs)▾`, `Rental Cost▾`,
  `Venue Type▾`, `Space▾`, `Rating▾` `[observed]`. The **active filter renders in pink while the rest
  stay dark** — `Venue Type` is pink in the capture `[observed]`.
- Applied filters are surfaced **twice**: as a **removable lavender pill** (`Banquet Halls ⊗`) and a
  **`Clear all`** text action on the same row `[observed]`; a `Showing 2361 results as per your search
criteria` line sits under the H1 `[reported]`.
- Second applied-state affordance: a `Destination Wedding Pricing` label with an **iOS-style toggle** at
  the right of the breadcrumb row `[observed]`.
- Within the bar the wrapper is a full-bleed white strip with a hairline under it; individual filter cells
  measure 111–195 px wide, 50 px tall `[observed]` (dump). Filter cells themselves carry
  `border-radius: 30px` for the chip variant `[observed]` — i.e. the mobile/chip form is fully rounded.
- A **`Need Help? WMG Genie can help out!`** inline assist chip sits between the H1 and the grid `[observed]`.

### Price / capacity / reviews

- Price is **per-plate and split by food preference in a 2×2 mini-table**: `Veg ₹3,000 per plate` /
  `Non veg ₹3,250 per plate`. The amount is ~16 px/700 near-black; the qualifier and the unit are small
  gray `[observed]`. This is the most information-dense price treatment of the eight sites and the best
  match for Indian venue economics.
- Capacity is a **range pill**: `100-2500 pax`, sitting next to a `75 Rooms` pill and a `+4 more`
  overflow pill `[observed]`.
- Reviews: **`★ 5.0 (19 reviews)` immediately right of the vendor name**, on the same line — the score is
  bold and the count is gray `[observed]`. Colour-wise the star is **pink**, so the rating reads as part
  of the brand system rather than as a third-party badge.
- **Visual scan anchor: the name + pink rating line.** Title and rating share the top row and are the
  highest-contrast elements; price is the second anchor (bold near-black amounts in the mini-table).

### Colour and surfaces

- **A single-hue pink/magenta system used at two intensities** (deep magenta utility strip + hot pink nav)
  plus pink for links, the star, the active filter, and the CTA `[observed]`. This is the cleanest
  single-family palette of the eight.
- Body background `rgb(251,251,251)` (`#FBFBFB`), body text `rgb(74,74,74)`, muted text
  `rgb(144,144,144)` `[observed]` (dump). Pure white is reserved for cards.
- Shadow policy: **flat at rest, one soft ambient shadow on hover only** `[observed]` (dump).
- Neutral coverage is very high; pink appears only on brand chrome, links, the rating star, the CTA and
  the active filter.

### Type hierarchy

**One family** (`WedmegoodFont`, a custom sans) — the only site of the eight that achieves a distinctive
look with a single family `[observed]`. Measured roles `[observed]` (dump):

| Role                      | Value                                              |
| ------------------------- | -------------------------------------------------- |
| Display (hero H1)         | `600 40px/26px`, white                             |
| Hero sub-line             | `400 22px/26px`, white                             |
| Page H1 (listing)         | `600 22px/26px`, `rgb(74,74,74)`                   |
| SEO/FAQ section heading   | `600 18px`, `rgb(74,74,74)`, `margin-bottom: 10px` |
| Card title                | ~`700 17px`, near-black                            |
| Metadata (location, type) | `400 14px/26px`, `rgb(144,144,144)`                |
| Price                     | amount ~`700 16px`; unit/qualifier `400 14px/26px` |
| Filter label (chip form)  | `600 14px/30px`, `border-radius: 30px`             |

Notable and useful: the **listing H1 is only 22 px** — WedMeGood runs a _small_ type scale on commerce
pages and lets weight, pink and layout carry hierarchy. The H1 and the card title are nearly the same size,
which is the opposite of a "big hero, small card" instinct.

### Responsive

- **Genuine mobile layout** `[observed]`: an app-install banner is prepended
  (`India's #1 wedding planning app` / `2 million+ installs` + pink `Install` pill); the header collapses to
  **hamburger + centred logo + `All Cities ▾` + account icon**; the nav disappears entirely.
- The hero becomes a **bottom-anchored** composition: H1 `Your Wedding, Your Way` left-aligned over the
  photo with the sub-line and a **"Find Vendors" search bar whose left cap is a solid pink rounded square
  and whose right cap is a pink chevron** `[observed]`. The 2-field desktop search is replaced by a single
  entry point.
- "Popular Venue Searches" keeps its image-left row layout, city links wrapping to two lines `[observed]`.
- A **fixed 5-tab bottom bar** appears (`Home` pink/active, `Venues`, `Vendors`, `Photos`, `Blogs`) — note
  `Real Weddings`, `E-Invites` and `Genie` are **dropped** from mobile `[observed]`.
- A floating circular gradient avatar FAB plus a chat widget sit bottom-right `[observed]`.

### Motion

- **Card hover: `0.3s ease`, animating background to white + `0 0 15px rgba(0,0,0,0.05)`; no transform** `[observed]` (dump).
- Form controls: `transition: color …` on nav/form labels `[observed]`.
- Carousels: circular arrow buttons advance the "Popular Venue Searches" row `[observed]` (no duration captured).

---

## 3. WeddingWire India — `weddingwire.in`

Evidence: `shots/weddingwire-desktop.png`, `-listing.png`, `-deep.png`, `-tile.png`, `-mobile.png`,
`-listing-mobile.png`; dumps `raw/weddingwire-{desktop,listing,mobile}.{json,log.txt}`.

### Header / nav

- **Two tiers, and the difference between them is purely semantic** `[observed]`: a thin utility strip
  carrying only `🧳 ARE YOU A VENDOR?` (uppercase, letter-spaced, right-aligned) above a main white row
  with the logo, nav, and auth links.
- Nav = **7 items**, short and category-flat: `Planning Tools, Wedding Venues, Wedding Vendors, Brides,
Grooms, Blogs, Community`. Note `Brides` and `Grooms` are _audience_ segments sitting beside _content_
  segments — an unusual but cheap way to double the entry points `[observed]`.
- Right side: `Log In` and `Free sign up` in the action red `[observed]`. Primary CTA on home is really the
  search bar; the purchase-side CTA is `Free sign up`.
- Nav metrics: `600 16px ProximaNova`, `padding: 0 12px`, and **`transition: color 0.15s`** — i.e. nav hover
  is a **150 ms colour-only** change `[observed]` (dump). Nav label colour is `rgb(34,34,34)`, not red;
  red is reserved for the logo, links, and CTAs.
- The header is **sticky**: it is still pinned at the top in the scrolled `-deep.png` / `-tile.png`
  captures while the breadcrumb and grid scroll beneath it `[observed]`.

### Hero

- **An asymmetric split with a distinctive geometric mask**: left ~58 % white with all the copy, right ~42 %
  a full-bleed photograph whose **left edge is cut by a large circular arc**, and the same arc motif is
  reused in the mobile hero as a **concave curve along the photo's bottom edge** `[observed]`. This is the
  single most recognisable visual device in the set.
- H1 "Everything you need to plan your event" — **Merriweather serif, ~40 px/700**, dark, two lines,
  left-aligned; the serif does the "editorial trust" work `[observed]`.
- Sub: "Search over 80,000 local professionals with reviews, pricing, and more." — `16px` sans, and it
  leads with a **numeric proof point (80,000)** `[reported]` (page's own claim).
- **Search sits in the hero: 2 fields + button** in one white bar with a hairline divider —
  `🔍 Search vendor category or name` | `in` `Location` | a solid **red `Find`** button `[observed]`.
- On the listing page the same bar becomes **prefilled and shorter**: `Wedding Venues` | `Delhi NCR` |
  a **circular red icon-only submit button** (magnifier), not a labelled button `[observed]`.
- A pale-pink rounded strip under the search advertises the app (`Take your wedding planning on the go` +
  white outlined `Get the app`) `[observed]`.
- Image treatment: credited photography with a small white **"Pixmint Studios"** credit inside the hero `[observed]`.

### Card anatomy

- Vendor cards are **horizontal, image-left, borderless rows separated by hairlines**, not a boxed grid `[observed]`.
- Image: ~292×196 → **ratio ≈1.49 (3:2)**, and the corners look **square, not rounded** `[observed]`.
  Overlays stack four affordances on one image: an amber **`TOP`** badge or a red **`PREMIUM`** badge
  top-left, a **white circular heart** (shortlist) top-right, a **circular play button** bottom-left
  (video), and **5 white pagination dots** bottom-centre (carousel) `[observed]`.
- **Exact metadata order** `[observed]`:
  1. Title `Hotel Surya Grand, Rajouri Garden` — **sans** ~22 px/700 dark (the serif is used for headings only)
  2. `★ 4.4 (22) · Rajouri Garden - Subhash Nagar, West Delhi` — **rating first, location second, same line**
  3. Description, 3-line clamped, ~15 px gray
  4. Attribute row with icons: `🍽 From ₹1,800` · `👥 50 to 500` · `🏷 1 promotion -10%` (the `-10%` in red)
  5. Right-aligned solid red **`Request pricing`** button (~210×44)
  6. Below the CTA, a trust line: `⚡ Responds within 24 hours` in small gray with a yellow bolt
- Cards **without** a rating simply omit row 2 and start the metadata at the location (`The Classic Affairs`,
  `Sector 57, Gurgaon, Gurgaon`) — so the rating slot is optional, not a placeholder `[observed]`.
- Shadow/radius: the CTA button has ~4 px radius; the cards themselves are separated by hairlines with no
  card shadow `[observed]`.
- The listing page is a **content hub before it is a grid**: above the results sit breadcrumb → H1 →
  a `Build your team 0/14` teal pill → an SEO paragraph → then `140 RESULTS` + a **List / Images / Map
  segmented view toggle** (List active as a white raised pill) `[observed]`, `[reported]` for the counts.

### Filters

- **Left sidebar (~300 px)**, not a top bar `[observed]`.
- It opens with an **app-promo card** that has a `✕` dismiss (phone illustration + `Discovering vendors is
easier on the app` + full-width outlined `Get the app`) — the sidebar's most prominent element is an ad,
  which pushes the actual filters below the fold `[observed]`.
- Control types: **collapsible section headers with chevrons** (`Wedding Venues`, `Special filters`) over a
  vertical list of **square checkboxes** — `Banquet Halls, Hotels, Marriage Garden, Kalyana Mandapams,
Wedding Resorts, Farmhouses` — and **no result counts on the options** `[observed]`.
- A **toggle switch** is used for `Deals` under a `Special filters` group `[observed]`.
- Applied-filter surfacing was not visible in the captured state (nothing was applied); the view toggle and
  `140 RESULTS` counter are the only state readouts I could see `[observed]`. I therefore cannot report how
  WeddingWire removes an applied filter.

### Price / capacity / reviews

- **Price is deliberately de-emphasised**: `From ₹1,800` measures **`400 14px`, `rgb(34,34,34)`** — the same
  size and weight as body metadata, inside the icon attribute row `[observed]` (dump). It is _not_ the anchor.
- Capacity is `50 to 500` — a **range with a people icon**, sitting in the same attribute row as price `[observed]`.
- **Reviews are the visual scan anchor**: a gold star + `4.4` in bold + `(22)` in gray, placed as the **first
  metadata line directly under the title** `[observed]`. The `-tile.png` also shows a `★ 4.4` star rendered
  in the gold/amber accent, i.e. a deliberately non-brand colour so the rating reads as third-party.
- A promotion is rendered inline as `1 promotion -10%` with the discount in red — a monetisation signal
  living in the metadata row `[observed]`.
- `Responds within 24 hours` is a **responsiveness promise** rather than a review — a useful non-review trust
  signal for a marketplace that cannot host reviews `[inferred]`.

### Colour and surfaces

- Action colour is **red** (the `Find` button, `Request pricing`, `Log In`/`Free sign up`, the `PREMIUM`
  badge), not pink; brand pink appears in the logo mark and some link accents `[observed]`.
- Body text `rgb(34,34,34)` (`#222`), background pure white `rgb(255,255,255)`, base font size **16 px** `[observed]` (dump).
- Accents: amber/gold for stars and the `TOP` badge, teal/mint for the `Build your team` pill, pale pink for
  the app strip `[observed]`. That is a **four-accent system**, wider than our fixed pink palette allows —
  it needs pruning, not copying.
- Shadow policy: soft, low, and used mainly on floating pills/buttons (the view-toggle pill, the app strip)
  rather than on result cards `[observed]`.

### Type hierarchy

**Two families, cleanly split**: `Merriweather` (serif) for display/headings and `ProximaNova` (sans) for
everything else `[observed]`. Measured roles `[observed]` (dump):

| Role              | Value                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Display (home H1) | Merriweather ~`700 40px`                                               |
| Page H1 (listing) | Merriweather `700 30px/42px`, `#222`                                   |
| Section heading   | Merriweather `700 24px/30px`, `margin-bottom: 24px`                    |
| Feature heading   | Merriweather `700 26.08px/40px` (up to `700 40px/50px` for big blocks) |
| Card title        | ProximaNova ~`700 22px`, dark                                          |
| Metadata / body   | ProximaNova `400 16px/24px`, `#222`                                    |
| Emphasis metadata | ProximaNova `600 16px/24px`                                            |
| Price             | ProximaNova **`400 14px/21px`** `#222`                                 |
| Nav link          | ProximaNova `600 16px/24px`, `padding: 0 12px`                         |

The **serif-for-headings / sans-for-everything-else** split is the most transferable typographic idea here,
but it is unavailable to us under a one-family (Manrope) constraint — the equivalent move is to use Manrope
weight + letter-spacing contrast instead.

### Responsive

- **Header:** collapses to `hamburger + centred logo + account icon`, ~80 px tall, on white `[observed]`.
- **Hero:** the arc mask becomes a **wave along the photo's bottom edge**; H1 is centred and wraps to two
  lines; the sub-line centres; and the 2-field search is replaced by **a single full-width red
  `🔍 Search vendors` button (~56 px tall)** — the fields are behind the button `[observed]`.
- **Listing mobile:** the search keeps **two bare fields in one outlined container with no visible submit
  button**; the sidebar disappears entirely (no `Filters` affordance is visible in the capture — a likely
  gap) `[observed]`.
- City carousel becomes a horizontally scrolling row of **circular** city thumbnails whose third item is
  clipped at the right edge — the clipping _is_ the scroll affordance `[observed]`.
- Content sections stack; "Enjoy planning your wedding" cards become a horizontal carousel with the next
  card peeking `[observed]`.

### Motion

- `transition: color 0.15s` on nav links — the only quantified transition I could extract `[observed]` (dump).
- Carousels (city circles, plan cards) use discrete arrow/scroll advances; the vendor card carries an image
  carousel (5 dots) whose autoplay/transition duration was not captured `[observed]`.

---

## 4. BookEventz — `bookeventz.com`

Evidence: `shots/bookeventz-desktop.png`, `-listing.png`, `-tile.png`, `-mobile.png`;
dumps `raw/bookeventz-{desktop,listing,mobile}.{json,log.txt}`.
Note: `shots/bookeventz-deep.png` is **byte-identical to the harness's blank error page (5 851 bytes)** — that
capture failed and carries no information.

### Header / nav

- **Two tiers with completely different jobs** `[observed]`:
  - Tier 1 (white): logo `BookEventz` (multi-colour star mark + dark wordmark), then a **white `Mumbai ▾`
    select**, a **green WhatsApp pill `+91 99675 81110`** (green icon + green text), a vertical divider, and
    `LOGIN` with an amber person icon. So tier 1 is _location + phone + account_.
  - Tier 2 (**dark purple/indigo band**): nav `Venues ▾ Vendors ▾ Blog Invites ▾ Ideas ▾ CorporateEventz`
    (5 items, white ~15 px) with **carets on 4 of them**, and `List With Us` right-aligned.
- Primary CTA: on the listing page the purple band becomes a **sticky search header** — a white
  `Search for venue, locality` input + a `Location` input + a **pink/magenta `Search` button** `[observed]`.
  So BookEventz runs **purple chrome + pink action**, a two-hue system.
- On the home page the header is dark and the nav is uppercase; on the listing it is purple/lower-case —
  the two captures show visibly different header treatments, suggesting either an A/B test or a
  device/geo variant `[inferred]`.

### Hero

- **The hero is a flat lavender panel, not a photograph** `[observed]` — this is the only site of the eight
  whose primary hero is illustration/colour rather than imagery. Left column on `#E9DFF7`-range lavender:
  - H1 `Best Banquet Halls In Mumbai, with Price, Photos & Reviews` — **`400 52px/60px`, deep purple
    `rgb(74,38,110)`**, left-aligned, three lines `[observed]` (dump). Note weight **400** at 52 px, and the
    H1 is used as the **SEO keyword string plus trust words** ("Price, Photos & Reviews").
  - Immediately below (below the fold in the home capture): the same H1 pattern at **`400`/`57px`** on the
    homepage variant.
  - A **green-outlined CTA pill with a green lightning bolt**: `Enquire now & Get Upto 30% Off ⚡` — purple
    text, 2 px green border, ~560×52 `[observed]`. Green is a third accent used _only_ for this offer.
  - A three-up stat strip split by vertical hairlines: `13 Years / Of Trust`, `25000+ / Vendors`,
    `8 Lacs+ / Happy Customers` — numbers ~26 px/700 purple, labels ~15 px muted `[observed]`. The mixed
    units (Years, 25000+, 8 Lacs+) are an internal inconsistency worth avoiding.
- Right side: a **white card (radius ~8 px, soft shadow) titled `Select Occasion`** containing a
  **3×2 grid of bordered occasion tiles** (illustration + label): `Wedding, Engagement, Corporate Event,
Birthday Party, Cocktail Party, Get Together`, then a full-width `More Occasion ▾` select `[observed]`.
  **The hero's primary action is a category picker, not a text search** — a strong fit for a
  lead-generation marketplace where the first question is "what kind of event".
- Image treatment: none on the hero; the site relies on **flat illustrations** inside the tiles. Those
  illustrations are custom artwork, which is a cheaper and more legally safe route than licensed photography `[inferred]`.

### Card anatomy

- A **3-up grid** of vertical cards on white `[observed]` (from `-tile.png`, partly obscured by an
  interstitial modal, so ratios below come from the dump).
- Image: **338×220 → ratio 1.536 (≈3:2)**, radius ~8 px (a second, narrower card variant measures
  **300×170 → 1.765**) `[observed]` (dump).
- Overlays: a **purple pill badge** top-left (`BookEventz Managed` / `₹0 Advance`) and a **white circular
  heart** top-right `[observed]`.
- **Card contents, as far as the blurred capture and dump allow** `[observed]`:
  1. Title, left — e.g. `Hotel Golden Grands`, `The Peninsula Grand`, `Fairfield by Marriott`
  2. A **2-column metadata grid**: left column `Triple Sharing` over `₹ 1000 + Taxes`; right column
     `100-1000 pax` over a green **`5.0★`** score with a small green circle badge
  3. A green **`Available`** pill under the rating
  4. A full-width **outlined pink `Check Availability`** button (pink border + pink text)
- Measured type `[observed]` (dump): **card title `700 18px/23.4px`, `rgb(17,24,39)`**; **price
  `₹ 700` at `700 16px` with the unit `/ Person` at `300 16px`**; the combined
  `₹ 700 / Person Very Good 5 reviews 3.8` string at `400 14px/20px`. So **the title (18 px) outranks the
  price (16 px)**, and the price amount is _bolder_ but _smaller_ than the title.
- The card surface is white with a light border; the page background stays white, so the border does the
  separating work `[observed]`.
- **Hover: none.** The hover probe reports `transition: all`, `transition-duration: 0s`, `transform: none`,
  `box-shadow: none` `[observed]` (dump).

### Filters

- **A tall left sidebar, 346 px wide × 4 074 px** (`desktop-filter-section`) `[observed]` (dump), plus a
  right-side search field (`Search by venue name`, 450×48) in a `filters-and-search-section` block `[observed]`.
- Controls detected in the sidebar `[observed]` (dump): `Book a Free Call` button, then accordion sections
  each ending in **`Clear` + `Apply`** buttons — i.e. **filters are applied per-section, not live**.
  Section labels are `Area`, `No. of People`, `Budget Per Person`, `Occasion` (from the `-tile.png`
  capture), each rendered as a bordered row with a caret `[observed]`.
- Filter labels measure **`500 16px/24px`, `rgb(51,51,51)`** `[observed]`.
- A `Confused how to start? Get expert advice with a quick call` card with three ticked reassurance lines
  (`Book all your…`, `No obligation to buy`, `Trusted venue…`) and a pink **`Book a Free Call`** button sits
  at the very top of the sidebar, above the filters `[observed]` — lead capture is placed ahead of filtering.
- Above the grid there is a secondary outlined pill row (`Venue Type`, `No. of People`) plus a toggle and a
  `Sort By` control `[observed]`.
- Applied-filter surfacing and removal: **not visible** in either capture; the `Clear`/`Apply` pair per
  section is the only removal affordance I actually saw `[observed]`.

### Price / capacity / reviews

- Price is written **with qualifiers inline**: `₹ 1000 + Taxes`, `₹ 700 / Person`, and a sharing basis
  (`Triple Sharing`) in the adjacent column `[observed]`. The **amount is bold (700) while the unit is light
  (300)** at the same 16 px — a neat way to make the number pop without making the row loud.
- Capacity is `100-1000 pax`, in the same 2-column metadata grid as price, **never on a line of its own** `[observed]`.
- Reviews: a **green `5.0★` score** with a small green circular badge, plus a word-graded variant
  (`Very Good 5 reviews 3.8`) elsewhere on the page `[reported]`. The numeric score is coloured **green** to
  signal "good", independent of brand colour `[observed]`.
- Availability is a **first-class badge**: a green `Available` pill, and every card ends in
  `Check Availability` — availability, not price, is the card's terminal affordance `[observed]`.
- Visual scan anchor: **the title, then the green availability/rating signals**. Price is present but
  deliberately not dominant.

### Colour and surfaces

- Action pink/magenta (`Search`, `Check Availability`, `Book a Free Call`, `Apply`), chrome **deep purple
  `#4A266E`**, success **green** (WhatsApp pill, availability pill, rating badge, the 30 %-off CTA border),
  hero **lavender**, and a **multi-colour logo mark** `[observed]`. That is four accent hues — the widest
  palette in the set and the one least compatible with our fixed pink/magenta system `[inferred]`.
- Body text `rgb(51,51,51)` `#333`, secondary text `rgb(103,103,103)`, background white `[observed]` (dump).
  Note that **section headings are `rgb(103,103,103)` gray at 45 px** — large _and_ muted, an unusual pairing.
- Shadow policy: soft shadow on the hero occasion card and on floating widgets; result cards rely on borders `[observed]`.

### Type hierarchy

**One primary family (`Metropolis`)** with a stray `Proxima Nova` declaration on one heading `[observed]`.
Measured roles `[observed]` (dump):

| Role                | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Display (home H1)   | `500 57px/60px`, white                                     |
| Page H1 (listing)   | `400 52px/60px`, `rgb(74,38,110)`                          |
| Section heading     | `500 45px/49.5px`, **`rgb(103,103,103)`**                  |
| Sub-section heading | `400 43px/49.45px`, purple                                 |
| Card title          | `700 18px/23.4px`, `rgb(17,24,39)`                         |
| Filter label        | `500 16px/24px`, `#333`                                    |
| Price amount        | `700 16px`, unit `300 16px`                                |
| Body/meta           | `400 14px`, tertiary `400 13px/18.85px` `rgb(103,103,103)` |

The **very large (43–57 px) headings**, including 45 px _gray_ section headings, are far outside what a
discovery grid needs; the useful extraction is the **18 px/700 title vs 16 px/300-unit price** pairing.

### Responsive

- The mobile capture caught a **full-screen `Select City` overlay** (light lavender, centred title + `✕`),
  so I could **not** observe the BookEventz mobile page layout itself `[observed]`. What the overlay does show:
  - Cities are presented as a **wrapped tag cloud of plain text links**, grouped under
    `📍 Destination Weddings & MICE Events` and `🇮🇳 India` (flag icon) `[observed]` — no A–Z index, no search.
  - Real data defects are visible: `Gwallor` is a misspelling of Gwalior, and `Mussoorie - Mussoorie` is a
    duplicated label `[observed]`. For a marketplace these are the kind of thing that erodes trust.
- From the dump, the sidebar is explicitly `desktop-filter-section` and there is a parallel
  `filters-and-search-section-mobile` container, so **the sidebar is desktop-only and mobile gets a
  search + filter sheet instead** `[observed]`.

### Motion

- Card hover: `transition: all` with `duration: 0s` → **no motion** `[observed]` (dump).
- A **`Box` interstitial modal** appears on scroll ("Need updates about new venues and ideas for your
  event." + `NO THANKS` / pink `YES`), which blocks the grid until dismissed `[observed]`. That is an
  interruption pattern, not a motion pattern, and it is on the do-not-copy list.

---

## 5. WeddingBazaar — `weddingbazaar.com`

Evidence: `shots/weddingbazaar-desktop.png`, `-listing.png`, `-listing-mobile.png`, `-mobile.png`;
dumps `raw/weddingbazaar-{desktop,listing,mobile}.{json,log.txt}`.
This is the **most directly transferable reference** of the eight for our exact product shape
(vendor discovery + lead gen, no cart), so it gets the most detail.

### Header / nav

- **A single, clean white tier** — the only site of the eight with no second band `[observed]`. Content:
  - A logo lockup: a pink rounded-square `WB` monogram + the `weddingbazaar` wordmark in dark + a tiny pink
    subline `from Matrimony.com group`. Using the parent brand as a one-line credibility cue is cheap and
    effective `[inferred]`.
  - Right nav, **5 items only**: `Vendors ▾`, `Blog`, `Search 🔍`, `Login`, a vertical divider, and
    `Are you a vendor?` `[observed]`. Two of those five are _audience switches_ (Login, Are you a vendor?).
- **On the listing page the header becomes location-aware**: two inline selects — `📍 Delhi ▾` and
  `📍 Ashok Vihar ▾` — sit immediately after the logo, before the nav `[observed]`. The location is promoted
  into the chrome rather than staying in a filter.
- Header height ~72 px on white; the header sits on its own white plane with the content below it also
  starting white, so the hero photo provides the only colour break `[observed]`.
- Primary CTA: the hero's `Find vendors →` button; secondarily `Check availability` / `View contact` on cards.

### Hero

- **A full-bleed photograph covering essentially the entire first viewport** (~830 px of 900) with **no dark
  scrim** `[observed]`. Legibility is achieved by making the headline itself high-contrast against a busy
  image: the H1 is `India's Largest **Wedding Planning** Platform` where **"Wedding Planning" is rendered in
  brand pink and the rest in white** — a two-colour split inside one sentence `[observed]`. This is the single
  best copy treatment in the set: the branded phrase is the coloured one.
- H1 ~52 px/700, left-aligned at x=228; sub-line `Hire best vendors such as photographers, makeup artists,
Mandap, Caterers and so on.` in white ~20 px, listing vendor categories as plain nouns `[observed]`.
- **Search is a floating white card that overlaps the bottom edge of the hero** (~976×100, radius ~8–12 px),
  containing `Search For Vendors ▾` | `Wedding city ▾` | a solid pink **`Find vendors →`** button `[observed]`.
  So: **2 fields + CTA, with a directional arrow in the CTA** — a small, good detail.
- A persistent **pink vertical `Need help?` tab** is pinned to the right edge of the viewport `[observed]`.
- Image treatment: a single, tightly art-directed hero photo (red/maroon decor matched to the pink palette)
  rather than a carousel; no visible credit line in the capture `[observed]`. The absence of a credit is a
  licensing risk worth flagging.

### Card anatomy

- **A 3-up grid on a light grey page background with white cards**, gap ~30 px `[observed]`.
- Image: **330×201 → ratio 1.64 (≈5:3)**, radius ~8 px (image follows the card's top corners);
  alt text is descriptive and includes the category (`"Surat Garden Wedding Venues"`) — notably better
  alt hygiene than either WedMeGood or Weddingz `[observed]`.
- Overlays, both **bottom-anchored** `[observed]`:
  - bottom-left: a dark translucent pill with a picture icon and a **media count** — `🖼 5`, `🖼 10+`, `🖼 15+`
  - bottom-right: a white pill `☆ Shortlist` (outline star + label) — a save affordance placed _on the image_
- **Exact metadata order** `[observed]` (screenshot ordered by x/y, plus the dump's full card text):
  1. Title, left — `The Anand Vilas by…` (**ellipsis-truncated**, ~17 px/700 near-black) and underneath it
     the location `Ashok Vihar, Delhi` (~13 px gray)
  2. **Price, right-aligned and top-aligned to the title** — `₹2,000 - 2,200` at ~17 px/700 near-black with
     `/ Per Plate` beneath it at ~12 px gray. So **price and title share the card's top line** and are the
     same size and weight — the price is a _co-anchor_, not a footer.
  3. `★ 4.5` (gold star + dark bold score) followed immediately by the gray words `No reviews yet`
  4. **Attribute pills with icons**, wrapping: `🚗 10 Car parking`, `250 Car parking`,
     `🏢 500 Hall capacity`
  5. A **dual full-width CTA pair**: `Check availability` (white, thin grey border, dark text) and
     `View contact` (white with **pink border and pink text**) — side by side, ~44 px tall
- Measured type `[observed]` (dump): card title `600 16px` pure black (`text-transform: none`);
  location `400 12px/18px`, letter-spacing 0.11 px, pure black; the media-count badge `500 10px` white;
  the `Shortlist` label `400 10px/15px`.
- Corner radius ~8 px; **cards carry a resting shadow `rgba(0,0,0,0.12) 0px 6px 20px 0px`** — measured as the
  _before_ value of the hover probe, i.e. WeddingBazaar is the one site of the eight with a **visible
  resting elevation** on result cards `[observed]` (dump). Card box measures 350×430.
- Hover behaviour: the probe captured the resting shadow; the after-state shadow was identical in the
  extracted fields, and the card's `transition` on form controls is `color 0.2s` — so **card hover is
  effectively a no-op** and the elevation is static `[observed]`.

### Filters

- **A horizontal, wrapping row of fully rounded white pill dropdowns directly under the header** —
  not a sidebar `[observed]`.
- Controls, in order: `Capacity ▾`, `Budget - Per Day ▾`, `Budget - Per Plate ▾`, `Food Type ▾`,
  `Ratings ▾`, then a right-aligned **`⇄ Filters` button**; a second row holds
  `Venue Amenities ▾`, `Catering Policies ▾`, and a bare **`Shortlisted`** pill (no caret, a toggle) `[observed]`.
  So **8 filter pills + 1 master Filters button + 1 toggle**.
- Each pill is ~48 px tall, white, thin grey border, **`border-radius: 999px` (fully rounded)**, with a caret `[observed]`.
- Directly beneath sits a real usability note: **`* Please select only one Budget type`** in ~12 px grey —
  an explicit constraint hint that prevents a dead-end interaction `[observed]`.
- Measured container: an MUI stack, class `QuickFilter_filterBar__GV_Qx`, **990×96 px** at x=164 — i.e. the
  bar is a fixed-width centred block and 96 px tall because it wraps to two rows `[observed]` (dump).
  The site is built on **Material UI** (`MuiStack-root`) `[observed]`.
- Applied-filter removal: not visible in the captured state; `Shortlisted` plus the `Clear`-style controls
  were the only state affordances present. I cannot report the chip-removal pattern for WeddingBazaar `[observed]`.
- A `Wedding Venues In Ashok-Vihar (9)` H1 with the count in parentheses, a pink breadcrumb chain
  (`Home / Wedding Venues / Wedding Venues In Delhi / Wedding Venues In Ashok Vihar`) and a one-line SEO
  description directly under the H1 `[observed]`, `[reported]` for the count.

### Price / capacity / reviews

- Price: `₹2,000 - 2,200` / `Per Plate` — **a range, not a "from" price**, right-aligned in the card's top
  row at the same size/weight as the title. This is the strongest price treatment of the eight for a
  marketplace that cannot quote a single number `[observed]`.
- Capacity appears as an **attribute pill only when it exists** (`500 Hall capacity`), next to
  `250 Car parking` — attribute pills are optional per card, and the row simply wraps into whitespace when
  there are fewer `[observed]`.
- **Reviews: `★ 4.5` sits next to the literal words `No reviews yet`** — a genuine contradiction in the live
  product (an aggregate score displayed with zero reviews) `[observed]`. It is exactly the failure mode our
  no-fabricated-ratings rule exists to prevent, and the reason we should ship no star widget at all.
- **Visual scan anchor: the title/price top row**, reinforced by the gold star. The dual CTA pair is the
  visual floor of the card.

### Colour and surfaces

- **One accent: pink/magenta**, used for the monogram, the subline, the hero's coloured phrase, the
  breadcrumb links, the `Find vendors` button, the `View contact` border/text and the star accent —
  with gold for the rating star `[observed]`. This is the palette most compatible with our fixed
  pink/magenta system.
- Page background: **light grey (`#F5F5F5`-range) behind the grid**, white header/hero-copy areas and white
  cards `[observed]`; body text is **pure black `rgb(0,0,0)`**, base font **16 px** `[observed]` (dump).
- Shadow policy: a **consistent soft card shadow `0 6px 20px rgba(0,0,0,0.12)`** applied to result cards at
  rest — the only such policy among the eight `[observed]` (dump).
- Neutral coverage is high; pink is confined to brand, links, CTAs and the star.

### Type hierarchy

**One family: `Poppins`** (variants `PoppinsLight`, `PoppinsRegular`), base 16 px `[observed]` (dump):

| Role               | Value                                               |
| ------------------ | --------------------------------------------------- |
| Display (hero H1)  | ~`700 52px`, mixed white + pink                     |
| Page H1 (listing)  | `700 24px` pure black, `text-transform: capitalize` |
| Card title         | `600 16px` pure black                               |
| Location           | `400 12px/18px`, letter-spacing 0.11px              |
| Price              | ~`700 17px` + unit ~`12px` grey                     |
| Form/filter labels | `800 14px/20.125px` (extra-bold)                    |
| Media-count badge  | `500 10px` white                                    |
| Shortlist label    | `400 10px/15px`                                     |

The scale is **tight and small**: the listing H1 (24 px) is barely larger than the card title (16 px), and the
heavy lifting is done by weight (600–800) plus black/pink colour. That is a very useful lesson under a
one-family constraint.

### Responsive

- **Listing mobile** `[observed]`: the header keeps `hamburger + centred logo + account icon`; the
  **two location selects disappear** from the header; the breadcrumb and H1 remain; the wrapping row of
  filter pills collapses (not visible above the fold in the capture); the **card grid becomes a single
  column** with the same internal card anatomy (image with media count + `Shortlist`, title + price row,
  rating line, attribute pills, dual CTA) `[observed]`.
- **Home mobile**: not independently assessed beyond the shared header treatment `[observed]`.

### Motion

- `transition: color 0.2s` (with a cubic-bezier) on form/filter labels `[observed]` (dump).
- Card hover: no measured change in shadow/transform; resting shadow persists `[observed]`.

---

## 6. ShaadiSaga — `shaadisaga.com` — **BLOCKED, no usable evidence**

Evidence: `shots/shaadisaga-desktop.png`, `-listing.png`, `-mobile.png`,
`-desktop-error.png`, `-listing-error.png`, `-listing-mobile-error.png`. No usable dump exists.

**Verdict: the site blocked automated access. I could not inspect any part of its design.**
I am reporting this rather than inferring anything, and the rows for ShaadiSaga are intentionally sparse.

What I actually saw:

- `shaadisaga-desktop.png`, `shaadisaga-listing.png` and `shaadisaga-mobile.png` are **not the site** — all
  three are Akamai's bare edge error page, rendered in default Times/`<h1>` browser styling `[observed]`:
  - `/` → `Access Denied` / `You don't have permission to access "/" on this server.` /
    `Reference #18.1567d117.1792090643.23794728` / `https://errors.edgesuite.net/18.1567d117.1792090643.23794728`
  - `/delhi/wedding-venues` → the same page with `"/delhi/wedding-venues"` and a different reference id
  - the 390 px capture → the same `Access Denied` text at mobile width
    `errors.edgesuite.net` is Akamai's edge-error host, so this is a **WAF/edge-server block**, not a design.
- All four `-error.png` files are **completely blank white images** — they are the harness's failure
  placeholder, not the site. `shaadisaga-desktop-error.png` and `shaadisaga-listing-error.png` are 1440×900
  and **byte-identical (md5 `0c49fe93b1cfaf43d4dcb21e02ff5dfa`) to the harness's own `_probe.png`**;
  `shaadisaga-mobile-error.png` and `shaadisaga-listing-mobile-error.png` are 390×844 and identical to each
  other (md5 `f95c356b1d2933b207b1b74ca16085aa`).
- Independently confirmed outside the browser: DNS resolves (`shaadisaga.com → 118.214.135.36`) but
  `curl https://www.shaadisaga.com/` fails with `curl failed to verify the legitimacy of the server / could
not establish a secure connection`, returning HTTP `000` for both `/` and `/delhi/wedding-venues`.
  So the block is at the network/TLS edge and is **not** a user-agent-only soft block `[observed]`.

Because the block is server-side, none of the eight required aspects (header, hero, card, filters,
price/capacity/reviews, colour, type, responsive, motion) could be observed. Every row for ShaadiSaga in the
tables below says so explicitly rather than guessing.

---

## 7. VenueLook — `venuelook.com`

Evidence: `shots/venuelook-desktop.png` (homepage, partly obscured by a modal),
`-desktop-hover.png`, `-mobile.png`; listing captured at `shots/venuelook-listing.png` +
`-listing-mobile.png` and dumps `raw/venuelook-{desktop,listing,mlisting}.{json,log.txt}`.

> Two access caveats, both honest limitations:
>
> 1. `venuelook.com/wedding-venues-in-delhi` and `venuelook.com/delhi/banquet-halls` both return **HTTP 200**
>    with the correct venue-listing `<title>` ("Top 30 Best Banquet Halls in Delhi…"), but the page actually
>    rendered to a headless browser is the **partner-acquisition page** ("Make More, Worry Less" / "Why List
>    With Us?"). The listing DOM contains **zero venue-card signals** — I grepped the dump for
>    `per plate|per person|pax|capacity|seats|guests|starting price|venue-card|listing-card` and got **no
>    matches**, and there are **no filter containers**. So I could not observe VenueLook's result cards or filters.
> 2. `venuelook.com/venues/delhi` returns **HTTP 200 with a "The requested URL was not found on this
>    server" page** (a cartoon "CAN'T FIND ?!" illustration, `Reach Us At: 8470-804-805`, and a link to
>    `/search`). A textbook soft-404 — a reminder that status codes alone cannot validate a capture.
>    The mobile listing capture rendered **without its stylesheet** (bare "List" text, an empty outlined box,
>    unstyled `4.6 (0 reviews)` text), so it too is unusable for card anatomy.

### Header / nav

- **A single compact dark tier** (near-black/charcoal, ~52 px) — the densest header of the eight `[observed]`.
  Contents: logo `Venue`(red)`look`(dark) with a green check-flag mark; then **5 uppercase nav items**
  (`VENUES, VENDORS, E-INVITATIONS, BLOG, EVENT PLANNING`) at ~13 px/600, letter-spaced, white; then
  **two CTAs**: an outlined `LIST YOUR BUSINESS` and a solid **red `GET FREE QUOTES`**, plus a circular
  avatar icon `[observed]`.
- The **primary CTA is a lead-capture verb (GET FREE QUOTES), not a browse verb** — the clearest expression
  of the lead-gen business model in the set `[inferred]`.
- Directly beneath the header sits a **full-width red phone strip**: `📞 +91-8470804805` centred `[observed]`.
- Then a **white city tab row**: `Delhi` (active, with a **red underline indicator**), `Noida, Gurgaon,
Mumbai, Bangalore, Ghaziabad, Greater Noida, Pune` — ~15 px/600 dark, spread across the width `[observed]`.
- Under the tabs, two columns of **teal/blue category links** (`Wedding venues in Delhi`,
  `Bachelor Party venues in…`, `First Birthday Party venues`, `Sangeet Ceremony venues` |
  `Wedding Resorts in Delhi`, `Restaurants in Delhi`, `Bars and Pubs in Delhi`, `Party Halls in Delhi`) `[observed]`.
- No sticky behaviour could be confirmed (only one scroll position per page was captured) `[observed]`.
- Nav/header metrics `[observed]` (dump): body `ProximaNova`, 16 px base, `rgb(33,37,41)` (`#212529`,
  Bootstrap's default dark) on white.

### Hero

- Full-bleed photograph on the right with the copy column on the left over a light scrim; on mobile the
  composition flips to a **centred, bottom-weighted** hero `[observed]`.
- H1 `Discover & Book the Perfect Venue with Expert Event Planning` — **`500 30px/36px`, white** `[observed]` (dump).
  Weight 500 at only 30 px is a notably restrained display setting.
- A booking widget sits in the hero: a **pink/red progress bar**, a `Type to search` input with a magnifier,
  and a **vertical list of occasion rows** (small illustration + label + chevron `>`):
  `Wedding Reception`, `Wedding Anniversary`, `Wedding`, `Walkin Interview` `[observed]`.
  This is a **quiz-style progressive widget** rather than a flat search form — the closest any of the eight
  gets to a conversational intake `[inferred]`.
- Mobile hero CTA uses the **coloured-cap pattern**: a red square holding a calendar icon followed by a white
  panel reading `Plan My Event` in red `[observed]` — the same device WedMeGood uses for its mobile search.
- A modal intercepts the page on load: `Get Upto 30% Discount on venues and vendors` + `Select Your Occasion`
  with a `✕` — it hides the hero and the widget in the desktop capture `[observed]`.

### Card anatomy

- **Could not be observed.** The listing page served to the harness contains no venue cards, and the homepage
  venue cards sat behind the discount modal in the desktop capture `[observed]`.
- The only card-level facts I can stand behind come from the homepage **type-role dump** `[observed]`:
  a venue card exposes a **`Veg` / `₹899` / `Non-Veg` price trio, all at `600 14px/21px`, `rgb(68,68,68)`** —
  i.e. a compact two-line per-plate price, smaller and lighter than anything Weddingz, WedMeGood or
  WeddingBazaar use. Card container measured 301×370, and the hover probe reported
  `transition-duration: 0s`, `transform: none`, `box-shadow: none` → **no card hover motion** `[observed]`.
- Homepage section headings are `How it Works?`, `Browse Vendors & Venues`, `Vendors By Category` —
  **`600 26px/31.2px`, `rgb(33,37,41)`** `[observed]`.
- The **"Why List With Us?" partner page** (which is what renders on listing URLs) does show cards worth
  noting even though they are not venue cards: four white stat cards with a thin border and soft shadow,
  overlapping the hero bottom — `35,000+ / Venues`, `15,000+ / Vendors`, `6.5 Lac+ / Happy Users`,
  `90+ / Cities`, numbers **`900 23px/34.5px`** `[observed]` (dump). Weight **900** for stat numbers is the
  heaviest weight found anywhere in this audit.
- Section-heading treatment on that page: a **pale pink band (`#FBEAEA`-range) containing a centred
  `Why List With Us?`** at `700 28px/33.6px` `[observed]`, and the red display line `Make More, Worry Less`
  at **`700 30px/36px`, `rgb(236,35,30)`** `[observed]` (dump).

### Filters

- **Could not be observed** — no filter containers exist in the listing DOM `[observed]`.
- From the homepage city tabs, the _filtering metaphor_ is geographic tabs + category links rather than
  facets `[inferred]`.

### Price / capacity / reviews

- Price: the `Veg` / `₹899` / `Non-Veg` trio at **14 px/600** `[observed]` (dump). Notably `Non-Veg` carries
  no price of its own in the captured roles, so the trio may be inconsistent in the live product.
- Capacity: **not observed.** Reviews: an unstyled `4.6 (0 reviews)` string appeared in the broken mobile
  render — a **score displayed against zero reviews**, the same contradiction WeddingBazaar ships `[observed]`.
- Visual scan anchor: **not determinable** from the evidence I could obtain.

### Colour and surfaces

- **Red is the single action colour**: `rgb(236,35,30)` for the display line, the `GET FREE QUOTES` button,
  the phone strip, the active city underline, the booking-widget progress bar and the `Next` button `[observed]`.
  Secondary teal/blue for category links, green for the WhatsApp float, pale pink for section bands `[observed]`.
- Body `rgb(33,37,41)` on white; footer is a **dark near-black multi-column block** `[observed]`.
- Shadow policy: soft shadows on the stat cards and floating widgets; the rest is flat `[observed]`.

### Type hierarchy

**One family: `ProximaNova`** — the same family WeddingWire India uses, which is expected since both are
WeddingWire-family properties `[observed]`. Measured roles `[observed]` (dump):

| Role                    | Value                              |
| ----------------------- | ---------------------------------- |
| Display (hero H1, home) | `500 30px/36px`, white             |
| Display (partner page)  | `700 30px/36px`, `rgb(236,35,30)`  |
| Section heading         | `600 26px/31.2px`, `rgb(33,37,41)` |
| Sub-section heading     | `700 28px/33.6px`                  |
| Stat number             | `900 23px/34.5px`                  |
| Price trio              | `600 14px/21px`, `rgb(68,68,68)`   |
| Meta / date             | `500 14px/20px`, white             |

The scale is **conservative for display (30 px) but extremely heavy for numbers (900)** — the inverse of
BookEventz, which is huge in display and light in numbers.

### Responsive

- **Genuine mobile layout on the homepage** `[observed]`: the header becomes `hamburger + centred logo +
two red circular icon buttons (location pin, phone)` on a dark bar with a **thin red rule** beneath it.
- Hero: photo with dark scrim, centred white H1 wrapping to three lines, then the **red-cap + white
  `Plan My Event`** CTA `[observed]`.
- A **horizontally scrolling occasion row** (illustrated `Wedding`, `Birthday`, `Engagement`) with
  **circular outlined prev/next arrow buttons at the viewport edges** `[observed]`.
- A dark band `Plan My Event, Get Started` holds **two white pill cards**: `👑 Luxury Wedding Venues` and
  `🏢 Corporate Party Venues` `[observed]`.
- A **fixed dark bottom tab bar** with 5 items: `Home` (red, active), `Venue`, `Vendors`, `E-Invites`,
  and **`Whatsapp`** (green WhatsApp icon) — a messenger tab in the primary navigation `[observed]`.
- Green WhatsApp float button plus a red `❓ Help` pill and a red scroll-to-top button on desktop `[observed]`.

### Motion

- Card hover: **none** (`transition-duration: 0s`, no transform, no shadow) `[observed]` (dump).
- The hero booking widget advances via a `Next` button with a **red progress bar** — a stepper, implying a
  multi-step transition whose timing was not captured `[observed]`.
- The discount modal appears on load, which is an interruption rather than a transition `[observed]`.

---

## 8. PartyBookr — `partybookr.com` — **domain is dead; no design evidence exists**

Evidence: `shots/partybookr-desktop.png`, `-desktop-full.png` (byte-identical to `-desktop.png`, both 50 950
bytes), `-mobile.png`; dump `raw/partybookr-desktop.{json,log.txt}` and `raw/partybookr-mobile.log.txt`.

**Verdict: this reference no longer exists as a product.** There is no site to audit, so no design rows can be
produced. Reporting this clearly is the correct outcome — inventing patterns from a parked page would be worse
than reporting a gap.

What I actually observed:

- The rendered page is a **GoDaddy domain-parking page** `[observed]`: a GoDaddy logo with a
  `Trustpilot 4.4 out of 5 Excellent` widget in the header; a bordered box reading
  **`partybookr.com` / `is parked free, courtesy of GoDaddy.com.`** with a black `Get This Domain` button;
  two pale-blue search tiles labelled `party` and `book`; the text **`Content is blocked`**; then
  `Copyright © 1999-2026 GoDaddy, LLC` and a third-party-advertiser disclaimer.
- The **raw HTTP response is a 114-byte JavaScript redirect**: `window.onload=function(){window.location.href="/lander"}` —
  so `partybookr.com` forwards to a `/lander` parking page `[observed]`.
- The **DOM dump confirms total absence of product structure** `[observed]`: the `--- HEADINGS` section is
  **empty**, `NAV_ALL` is **empty**, `SEARCH_INPUTS` **empty**, `FILTER_CONTAINERS` **empty**, `CARDS`
  **empty**, `IMAGES` **empty**, `TYPE_ROLES` **empty**. The only body text is the GoDaddy park copy quoted above.
- Surfaces: body `rgb(29,42,51)` (GoDaddy's dark blue-grey), `font-family: Arial, serif` `[observed]` (dump) —
  i.e. not a brand design system at all.
- My own link-probe found **no listing URL to try**; the brief's note that PartyBookr had no listing page is
  consistent with there being no site `[observed]`.

Only transferable lesson, and it is a negative one: because PartyBookr let its domain lapse, the URL now
serves unrelated advertising. If we ever retire or rename a public URL, it must **301 to the most relevant
surviving page** — VenueLook's 404, whatever its other problems, at least shows a support phone number and a
link to a valid listing (`https://www.venuelook.com/search`) `[observed]`. PartyBookr shows a sales pitch for
the domain itself.

---

# Final table — observed pattern → why it works → adaptation → target component

3–6 rows per reference. Everything in the "Observed pattern" column is `[observed]` unless marked otherwise.

| Reference                | Observed pattern                                                                                                                                                                                                                    | Why it works                                                                                                 | Adaptation for our product                                                                                                                                                                 | Target component                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| **1. Weddingz.in**       | Hero search is **exactly one field** — a white `Select City` dropdown (~440×40, 4 px radius), no date/guest/budget, no visible submit                                                                                               | Collapses the first decision to a single tap; every extra field costs completion on the highest-traffic page | Hero asks only _city_ (required) + _what are you planning_ (optional). No date, guests or budget in the hero                                                                               | `HeroSearchBar`                       |
|                          | **Capacity as a range pill** — `125-200 Guests` rendered as a full-radius pill directly under the address                                                                                                                           | Answers the single most common venue question inline, without opening the vendor                             | Show capacity as a range pill on the card, only when known                                                                                                                                 | `VendorCard` meta pills               |
|                          | **Price is the largest ink on the card** — `₹1100` at `700 20px` pure black, unit `/Plate` demoted to `500 14px` `#C7C7C7`                                                                                                          | The commercial number is scannable instantly while the unit stays quiet                                      | Price range as Manrope 700 18 px near-black, "per plate" at 12 px muted                                                                                                                    | `VendorCard` price block              |
|                          | **`Applied Filters (1)` + per-pill `✕` + per-section `Clear`**                                                                                                                                                                      | Users can always see _and_ undo state; nothing is hidden behind a reload                                     | Filter summary: `Applied (n)` + removable chips + per-facet Clear                                                                                                                          | `AppliedFilterBar`                    |
|                          | Facet options carry **right-aligned result counts** (`Dwarka 125`, `Rohini 106`, …)                                                                                                                                                 | Sets expectations before the click; prevents zero-result dead ends                                           | Show counts on facet options where data supports it; otherwise omit the column entirely                                                                                                    | `FilterFacetList`                     |
|                          | Filter rail classes are literally `--hide-tablet` / `--hide-phone`; mobile exposes `Filters (2)`                                                                                                                                    | Responsive collapse was **designed**, not accidental                                                         | Hide the rail below `lg`; expose a `Filters (n)` button opening a Mantine `Drawer`                                                                                                         | `FilterPanel` / `MobileFilterDrawer`  |
| **2. WedMeGood**         | **Card hover = `0.3s ease` to `background: white` + `box-shadow: 0 0 15px rgba(0,0,0,0.05)`**, no translate/scale                                                                                                                   | Signals interactivity without moving content, so nothing reflows or jitters                                  | `transition: box-shadow 300ms ease, background-color 300ms ease`; hover adds `0 0 15px rgba(0,0,0,0.06)`                                                                                   | `VendorCard.module.css`               |
|                          | **Full-width horizontal filter bar** with **8 text-only controls** (`Locality▾`, `No. of Guests▾`, `Price per plate▾`…), active one in pink                                                                                         | Keeps the full page width for cards instead of surrendering a 300 px column to filters                       | Top filter bar: text + chevron controls, active control in brand pink, overflow into a Drawer                                                                                              | `FilterBar`                           |
|                          | **Name and rating share one row**, rating right-aligned: `Madhavgarh Palace` ⟷ `★ 5.0 (19 reviews)`                                                                                                                                 | Puts the two strongest signals on a single scan line                                                         | Title row = name left, **price right** (we have no rating); reserve the right slot, never leave it ragged                                                                                  | `VendorCard` header row               |
|                          | **Veg / Non-veg price as a 2×2 mini-table** — amounts `700 16px` near-black, qualifiers small grey                                                                                                                                  | Matches real Indian per-plate economics without a misleading single "from" price                             | Price block: `Veg ₹X` / `Non-veg ₹Y`, amounts Manrope 700 16 px, labels 11 px muted                                                                                                        | `VendorPriceTable`                    |
|                          | **Attribute pills** `100-2500 pax`, `75 Rooms`, `+4 more` in a wrapping row                                                                                                                                                         | Progressive disclosure: two facts now, the rest on request                                                   | Capacity + top-2 amenities as pills, plus a `+N more` pill                                                                                                                                 | `VendorCard` attribute pills          |
|                          | **One font family** (`WedmegoodFont`) carries the entire identity; listing H1 is only `600 22px`                                                                                                                                    | Proves a single family and a _small_ scale can still look branded — exactly our constraint                   | Build hierarchy from Manrope weights 400/500/700 + tight size steps; do not inflate the H1                                                                                                 | Type tokens                           |
| **3. WeddingWire India** | **Serif for display/headings, sans for cards and body** — H1 `Merriweather 700 30px/42px`, card title/nav/body `ProximaNova`                                                                                                        | Editorial authority where trust is built; maximum scanability where data is read                             | Manrope-only equivalent: weight contrast (700 display → 600 card title → 400 meta) + negative tracking on display                                                                          | Type tokens                           |
|                          | **Metadata ordered by decision weight**: rating first (`★ 4.4 (22)`), then location, then an icon attribute row with `From ₹1,800` · `50 to 500`                                                                                    | The order matches how couples actually compare venues                                                        | Metadata row order: capacity → locality → price; **no rating slot at all**                                                                                                                 | `VendorCard` meta row                 |
|                          | **`⚡ Responds within 24 hours`** — a responsiveness promise rendered as a small trust line under the CTA                                                                                                                           | Builds trust from behaviour we control rather than from reviews we do not have                               | Vendor trust line: "Responds within 24h" / "Verified vendor" from real lead-response data                                                                                                  | `VendorCard` trust line               |
|                          | Image carries a **media/photo-count badge** and a **heart shortlist overlay**; carousel dots indicate more images                                                                                                                   | Communicates depth and enables saving without leaving the grid                                               | Photo-count badge on the media; shortlist heart as an overlay action                                                                                                                       | `VendorCardMedia`                     |
|                          | **List / Images / Map segmented toggle** with the active option as a raised white pill                                                                                                                                              | Gives users control over result presentation at near-zero cost                                               | Grid/List segmented control with a raised active pill (Map deferred)                                                                                                                       | `ResultsToolbar`                      |
|                          | Nav hover is **`transition: color 0.15s` only**, and the header stays pinned while the grid scrolls                                                                                                                                 | Minimal, fast feedback; search and nav remain reachable                                                      | 150 ms colour-only hover on nav links; keep the two-tier header sticky on listing routes                                                                                                   | `SiteHeader`                          |
| **4. BookEventz**        | Hero's primary action is a **3×2 occasion-picker card** (`Wedding`, `Engagement`, `Corporate Event`, `Birthday Party`, `Cocktail Party`, `Get Together`) with illustrations — not a text search                                     | Asks the one question that actually segments supply, and is tappable on mobile                               | Hero right-hand card: "What are you planning?" with 6–8 event-type tiles with icons                                                                                                        | `HeroOccasionPicker`                  |
|                          | **Price amount `700` + unit `300` at the same 16 px** (`₹ 700` bold / `/ Person` light), title `700 18px`                                                                                                                           | Makes the number pop without making the row loud; title still outranks price                                 | Same-size, mixed-weight price: amount Manrope 700, unit Manrope 400 muted                                                                                                                  | `VendorPrice`                         |
|                          | **Green `Available` pill** plus a card-terminal **`Check Availability`** outlined-pink CTA                                                                                                                                          | Availability, not price, is the real conversion step for venues                                              | Terminal CTA = "Check availability" → enquiry form; never "Book now"                                                                                                                       | `VendorCardActions` / `EnquiryButton` |
|                          | Filters apply **per section with explicit `Clear` + `Apply`**, not live                                                                                                                                                             | Batched application is cheaper to reason about and avoids re-query churn                                     | Drawer with per-section Clear and a single Apply (Mantine `Drawer` + `Button`)                                                                                                             | `FilterDrawer`                        |
|                          | **Lead-capture card at the top of the sidebar**, above filters: `Confused how to start? Get expert advice with a quick call` + ticked reassurances + `Book a Free Call`                                                             | Monetises intent at the precise moment of highest confusion                                                  | Sidebar slot above facets: "Not sure where to start? Talk to an expert" + CTA                                                                                                              | `LeadAssistCard`                      |
|                          | City picker is a **wrapped tag cloud with no search**; contains `Gwallor` and `Mussoorie - Mussoorie`                                                                                                                               | Fast to scan, but unusable at scale and error-prone                                                          | City picker with type-ahead search + state grouping; validate city data at ingest                                                                                                          | `CityPicker`                          |
| **5. WeddingBazaar**     | **Price range top-right, same size and weight as the title**: `₹2,000 - 2,200` / `Per Plate` beside `The Anand Vilas by…`                                                                                                           | Price and identity share the first scan line — no "contact for price", no hunting                            | Card header row: name left, price range right, both Manrope 700 ~17 px                                                                                                                     | `VendorCard` header                   |
|                          | **Dual CTA pair of equal width**: `Check availability` (neutral outline) + `View contact` (pink border + pink text)                                                                                                                 | Two distinct intents, two visual weights, one predictable row                                                | `Enquire` (solid pink) + `View contact` (outlined pink), 50/50, 44 px tall                                                                                                                 | `VendorCardActions`                   |
|                          | **Wrapping row of 8 fully-rounded filter pills** (`border-radius: 999px`) + a master `⇄ Filters` button; container measured **990×96**                                                                                              | Filters stay visible and tappable without consuming a column; wrapping handles the count gracefully          | Pill filter row (radius 999) that wraps, with overflow routed to a Drawer. Pair it with an inline constraint hint under mutually-exclusive groups (`* Please select only one Budget type`) | `FilterPillBar` + `FilterHelperText`  |
|                          | **Attribute pills render only when data exists** — `500 Hall capacity` present on one card, absent on another, and the row simply wraps into whitespace                                                                             | Never shows empty placeholders or invites fabricated values                                                  | Conditionally render capacity/amenity pills; omit the row entirely when empty                                                                                                              | `VendorCard` attribute pills          |
|                          | **Resting card shadow `0 6px 20px rgba(0,0,0,0.12)`** on a light-grey page background, radius ~8 px                                                                                                                                 | Cards lift off the neutral background without needing borders, so the grid reads as objects                  | Card shadow token `0 6px 20px rgba(0,0,0,0.08–0.12)` over a `neutral-50` page background                                                                                                   | `VendorCard` container                |
|                          | **Location selects promoted into the header** on listing pages (`📍Delhi ▾`, `📍Ashok Vihar ▾` right after the logo); listing H1 only `700 24px`                                                                                    | City/locality stay visible and changeable without scrolling or opening filters                               | Put city + locality in the built two-tier header on listing routes                                                                                                                         | `SiteHeader` location row             |
| **6. ShaadiSaga**        | **Could not observe any pattern** — every capture is Akamai's `Access Denied` edge page (`errors.edgesuite.net`), the `-error.png` files are the harness's blank placeholder, and `curl` fails TLS negotiation with HTTP `000`      | Evidence of a hard WAF block, not of a design                                                                | **Do not model anything on this reference.** Excluded from the adaptation set                                                                                                              | n/a                                   |
| **7. VenueLook**         | **Compact dark header with a clear primary/secondary CTA pair**: solid red `GET FREE QUOTES` + outlined `LIST YOUR BUSINESS`                                                                                                        | Two CTAs, two weights, no ambiguity about which is primary                                                   | Two-tier header actions: solid pink primary CTA + outlined secondary                                                                                                                       | `SiteHeader` actions                  |
|                          | **Full-width phone strip directly under the header** (`📞 +91-8470804805`), and two more phone numbers in the footer/404                                                                                                            | Phone-first conversion for an Indian audience; the fastest channel to a lead                                 | Optional contact strip / "Call us" affordance in the header if we support voice                                                                                                            | `HeaderContactBar`                    |
|                          | **City tabs with a red underline indicator** for the active city (`Delhi` active; Noida → Pune)                                                                                                                                     | Tab switching beats a dropdown for the top handful of cities, and shows the options                          | City tab row (top 8 cities) + "More cities" overflow on listing pages                                                                                                                      | `CityTabs`                            |
|                          | **Four white bordered stat cards overlapping the hero bottom** — `35,000+ Venues`, `15,000+ Vendors`, `6.5 Lac+ Users`, `90+ Cities`; numbers `900 23px`                                                                            | Proof points become a distinct visual object rather than a line of text                                      | `StatsBand` with 4 cards; **only verified counts**, sourced and dated                                                                                                                      | `StatsBand`                           |
|                          | **Compact `Veg` / `₹899` / `Non-Veg` price trio at `600 14px/21px`**                                                                                                                                                                | A smaller, quieter per-plate price for dense grids                                                           | Compact price variant for dense/list layouts                                                                                                                                               | `VendorPrice` compact                 |
|                          | **Mobile bottom tab bar includes a WhatsApp tab** (Home red/active, Venue, Vendors, E-Invites, Whatsapp)                                                                                                                            | Meets users in the channel they already use for vendor enquiries                                             | Mobile bottom nav with Home / Vendors / Enquire / **WhatsApp**                                                                                                                             | `MobileBottomNav`                     |
| **8. PartyBookr**        | The domain is a **GoDaddy parked page** reached via a 114-byte JS redirect to `/lander`: `partybookr.com is parked free` + `Get This Domain` + `Content is blocked`; the dump has **no headings, nav, cards, images or type roles** | The reference no longer exists — there is nothing to learn from it                                           | **Remove PartyBookr from the reference set**; do not spend a slot on it                                                                                                                    | n/a                                   |
|                          | **Domain lapse serves ads at the old URL**                                                                                                                                                                                          | _(anti-pattern)_ users and inbound links land on a competitor's sales pitch                                  | 301 retired URLs to the closest surviving page; ship a useful 404 with onward links and support contact                                                                                    | `not-found` / redirects               |

---

# What NOT to copy

Concrete, all `[observed]` unless noted:

1. **Fabricated scarcity and fake urgency.** Weddingz's mobile listing carries an amber band reading
   `18 Bookings done in the last few days!` / `23 Customers liked, visited & looking forward to book the Venue`.
   We have no booking data and no such telemetry; producing these numbers would be fabrication. Same class:
   Weddingz's `Plan your Destination Wedding. Click here.` toast and its `DISCOUNTS UPTO 30%` / `HAVE US CALL
YOU FOR UPTO 30% DISCOUNT` footer blocks.
2. **Discount-led interstitials and promises we do not control.** VenueLook opens a modal on load
   (`Get Upto 30% Discount on venues and vendors`); BookEventz runs `Enquire now & Get Upto 30% Off ⚡` and
   carries a `₹0 Advance` badge. We cannot guarantee a third-party vendor's discount, so we must not advertise one.
3. **Any rating or review widget.** WeddingWire shows `★ 4.4 (22)`; WedMeGood shows `★ 5.0 (19 reviews)`;
   BookEventz shows a green `5.0★` plus the word grade `Very Good`; WeddingBazaar shows `★ 4.5` **directly
   beside the words `No reviews yet`**, and VenueLook's broken render shows `4.6 (0 reviews)`.
   The last two prove that even the incumbents ship self-contradicting rating data. Our brief forbids
   fabricated ratings, so the right move is **no star widget at all** — substitute verified badges,
   `Responds within 24h`, and real listing freshness.
4. **Unlicensed or scrape-dependent imagery.** WedMeGood's hero states `Photo Credits : Shutterstock` and a
   blog hero states `Photo Credits : Shutterdown`; WeddingWire's hero carries `Pixmint Studios` — both
   credited, i.e. licensed stock. WeddingBazaar's hero shows **no credit at all**, which is a licensing risk.
   We must use owned or properly licensed imagery with attribution, and never scrape vendor photos.
5. **Cart, checkout, payments, or booking language.** Weddingz's `How it Works` ends at `Book Venue` and
   `Book Vendors`; WeddingWire's homepage promises `Make a secure, hassle-free booking`; BookEventz uses
   `Available` badges and `Check Availability` in a way that implies reservation. Our product is
   discovery + lead generation only.
6. **SEO link-farm footers.** Weddingz's footer enumerates 55+ cities × 5 venue types and × 4 vendor types,
   then repeats the same city blocks in an accordion — thousands of links, duplicated content, unbounded
   maintenance. (Contrast: WeddingBazaar and WedMeGood keep footers to a few grouped columns.)
7. **More than one font family.** Weddingz declares `Lato, Open Sans, Inter`; BookEventz declares
   `Metropolis` plus a stray `Proxima Nova`; WeddingBazaar mixes `Poppins`/`PoppinsLight`/`PoppinsRegular`.
   We are Manrope-only — hierarchy must come from weight, size, tracking and colour.
8. **Multi-hue accent systems.** WeddingWire runs red + pink + amber/gold + teal; BookEventz runs purple +
   pink + green + lavender + a multi-colour logo. Our palette is fixed pink/magenta; every non-action state
   must be a neutral tint.
9. **Content-blocking modals.** BookEventz's `Need updates about new venues and ideas for your event.`
   interrupts the result grid; VenueLook's discount modal covers the hero. No blocking interstitials —
   at most one dismissible inline banner.
10. **Ellipsis truncation in identity and location fields.** WedMeGood renders `Gurgaon, Gurg...` and
    `Chattarpur, Delhi ...`; WeddingBazaar renders `The Anand Vilas by…`. In a lead-gen marketplace the user
    must be able to identify the vendor and its locality — wrap or clamp at 2 lines with a deliberate
    line-clamp, never a mid-word ellipsis on a single line.
11. **Meaningless image alt text.** WedMeGood ships `alt="vendor-pic"` on every card image and Weddingz ships
    `alt=""`. This is an accessibility and SEO failure; alt text should carry vendor name + category + city.
12. **Unvalidated user-visible data.** BookEventz's city picker contains `Gwallor` (Gwalior) and
    `Mussoorie - Mussoorie`; VenueLook's footer contains `Find A Venue | Vendor` and `List A Venue | Vendor`.
    Validate city and label data at ingest and lint copy in CI.
13. **Cart-abandonment / pre-checked marketing opt-ins and app-install banners before content.**
    WedMeGood prepends an `Install` banner above the header on mobile before any vendor content is visible.
14. **Auto-rotating hero carousels and any autoplay.** WeddingWire's cards autoplay image carousels (5 pagination
    dots) and WedMeGood rotates city rows; both fight reduced-motion preferences and add no discovery value.

---

# Could not inspect

Named explicitly, with the reason. Nothing in this report is inferred from a filename.

**Entirely inaccessible**

- **ShaadiSaga (`shaadisaga.com`) — blocked.** All three page types returned Akamai's bare
  `Access Denied` edge page (`errors.edgesuite.net` reference ids); the three `-error.png` files are blank
  white and md5-identical to the harness's own `_probe.png`; DNS resolves to `118.214.135.36` but
  `curl` fails TLS verification and returns HTTP `000`. Consequently **none** of the eight aspects are
  reported for this site. No screenshot of the real site exists in the evidence at all.
- **PartyBookr (`partybookr.com`) — the product no longer exists.** The domain is parked by GoDaddy via a
  114-byte JS redirect to `/lander`. The DOM dump contains no headings, nav, cards, images, inputs or type
  roles. There is no home page, no listing page, no vendor detail page and no mobile layout to audit.

**Partially inaccessible**

- **VenueLook — result cards and filter UI not observable.** Both `/wedding-venues-in-delhi` and
  `/delhi/banquet-halls` return HTTP 200 with a listing `<title>` but render the _partner-acquisition_ page
  (`Make More, Worry Less` / `Why List With Us?`) to the harness; the DOM contains zero venue-card signals
  (grep for `per plate|pax|capacity|guests|venue-card|listing-card` — no matches) and zero filter containers.
  `/venues/delhi` is a soft-404 (HTTP 200, "URL not found"). The mobile listing capture rendered without CSS.
  I therefore report **no** card anatomy, filter model, or price/capacity scan-anchor for the listing; the
  VenueLook section is built from the homepage, the mobile homepage, the DOM type-role dump, and the partner page.
  Additionally, the homepage hero, booking widget and any homepage venue cards were **behind the
  `Get Upto 30% Discount` modal** in the desktop capture.
- **BookEventz — mobile page layout not observable.** The mobile screenshot is the full-screen `Select City`
  overlay, not the underlying page, so I cannot describe BookEventz's mobile home or mobile grid. Its card
  images were also partially obscured by the `Need updates about new venues` modal in `-tile.png`, and
  `bookeventz-deep.png` is byte-identical to the harness's blank error page (5 851 bytes), so that capture
  carries no evidence.
- **WedMeGood — original evidence was invalid, now corrected.** The pre-existing `wedmegood-desktop.png` was a
  _Real Wedding_ detail page (not the homepage) and `wedmegood-listing.png` was a **404** for a wrong URL
  (`/vendors/delhi/wedding-venues/`); the correct shape is `/vendors/delhi-ncr/wedding-venues/all/banquet-hall/`.
  I re-captured both. Still **not observed** for WedMeGood: the contents of the filter dropdown menus
  (only the closed bar was captured), applied-filter removal beyond the visible pill `✕` / `Clear all`,
  and carousel transition timings.
- **WeddingWire India — filter interaction not observed.** No filters were applied in the captured state, so
  I cannot report how WeddingWire surfaces or removes an applied filter. Also not captured: card hover motion,
  image-carousel transition duration, and the mobile listing's filter entry point (none visible above the fold).
- **WeddingBazaar — filter removal and hover after-state not observed.** No filter was applied in the capture,
  so the applied-chip pattern is unverified. The hover probe's after-state shadow matched the resting shadow,
  so I cannot state a hover change beyond "no measurable change". Home-page mobile was not assessed beyond the
  shared header treatment.
- **Weddingz.in — real mobile homepage not observable.** At 390 px the site served its **desktop layout**
  (the nav row and hero copy are clipped off the right edge), because the harness sends a desktop Chrome
  user-agent. The genuine mobile design is only visible on the **listing** page. Also not observed: the
  contents of the nav dropdown menus, and any result count beyond the reported `1473 Venues`.

**Cross-cutting gaps (apply to all eight)**

- **No dark-mode evidence** for any reference; every capture is light only.
- **No focus/keyboard-state captures** — I cannot report focus-ring treatments or tab order.
- **No `prefers-reduced-motion` behaviour** was probed, so reduced-motion support is unknown everywhere.
- **No measured performance data** (LCP/CLS/INP, transfer sizes, image formats). The only timings available are
  the harness's own stage timings, which measure a headless cold load and are not comparable to real UX.
- **Colour values are computed-style sRGB values**, not design tokens; where a site uses gradients, opacity or
  images, the sampled colour may differ from the intended brand token.
- **All screenshots are 1440×900 or 390×844 at device scale factor 1** — no 2×/retina rendering, so hairline
  borders and sub-pixel radii may not read accurately.
- **Dropdown, modal and hover _contents_ are largely unobserved** because the capture harness only recorded
  closed/resting states (the exceptions are the BookEventz city overlay, the VenueLook discount modal and the
  BookEventz newsletter modal, which happened to be open).

---

## Provenance and reproducibility note

The structural/computed-style dumps for references 1–8 under `docs/research/raw/` are **new files produced
during this audit** (they did not exist beforehand — see the integrity note at the top). They were generated by
the previous agent's existing, unmodified harness `_capture.mjs` reading `_sites.json`. To reproduce, the only
config changes made were:

- **eight additive entries** for `weddingz, wedmegood, weddingwire, bookeventz, weddingbazaar, shaadisaga,
venuelook, partybookr` with their `url` and `listing` fields (no existing entry was altered in substance), and
- **two corrected listing URLs**: `wedmegood.listing` → `/vendors/delhi-ncr/wedding-venues/all/banquet-hall/`
  (the original 404'd) and `venuelook.listing` → `/delhi/banquet-halls` (the original rendered the partner page).

No new capture script was authored; no script was left behind. The pre-existing 129 screenshots were backed up
before the sweep overwrote them, and screenshots were read from that pristine copy except where a re-capture
produced strictly better evidence (WedMeGood home and listing, VenueLook listing), which is stated in each section.
