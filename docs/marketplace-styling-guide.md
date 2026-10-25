# Marketplace Styling Guide

**Derived from Amazon, Flipkart and Myntra — applied to Live Envt**

Status: **guidance for engineers** · Audience: anyone writing a component in
`src/components/**` or `src/app/**` · Companion to [`docs/design-system.md`](./design-system.md),
which documents what is _already implemented_. This file documents the _structural rules_ the
implementation should follow, and the reasoning behind them.

Stack assumptions: Next.js App Router, Mantine 9, CSS Modules, design tokens in
`src/theme/tokens.ts`. Light and dark themes are both first-class.

> **Revision note (ink & vermilion).** This guide was researched for a single-sans, cool-slate
> system. The shipped product now uses **two faces** — Bodoni Moda for display type and Jost for UI
> text — and a warm **ink & vermilion** palette on a `stone` neutral ramp. The research below is kept
> for its reasoning; the exact hex values and the "one font family" rule are superseded by
> `docs/design-system.md` §2–§3, which describes what is actually implemented.

---

## 0. How to read this, and how confident each claim is

The user asked for a guide based on Amazon, Flipkart and Myntra. Those three were not built from a
published design system, so almost nothing about them is _officially documented_. This guide
therefore separates two kinds of statement, and you should treat them differently:

| Marker         | Meaning                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[observed]** | A structural pattern that is plainly visible on the live sites and widely described. High confidence.                                                                     |
| **[reported]** | A specific value (usually a hex) taken from third-party reverse-engineering or brand-palette aggregators, not from the company. Medium confidence — treat as approximate. |
| **[approx]**   | The author is reasoning from a source that may be stale or AI-generated. Low confidence. Verify before treating as fact.                                                  |
| **[ours]**     | A decision made for Live Envt. Not a claim about anyone else's site. This is the part you should actually implement.                                                      |

**Sources used**

- Amazon design tokens, reverse-engineered by a third party:
  [superloopy `amazon.md`](https://github.com/beefiker/superloopy/blob/main/skills/superloopy-frontend/references/design/amazon.md) — **[approx]**,
  community reverse-engineering, agrees with the author's own recollection of the site.
- Amazon button colour rationale and hex values:
  [Ecom Giant Insider, "Decoding Amazon's Button Color Palette"](https://ecomgiantinsider.club/uncategorized/amazon-button-color-palette/) — **[reported]**;
  the _rationale_ in that article (warm CTA on a neutral wall so it does not compete with links) is
  the part worth transferring, and it matches Amazon's observable behaviour.
- Myntra brand palette (magenta `#F41CB2`, orange `#FF912E`, dark orange `#F25511`, maroon `#9F163C`):
  [BrandColorCode — Myntra](https://www.brandcolorcode.com/myntra) — **[reported]**. These are
  _logo_ colours, not necessarily UI colours.
- Flipkart brand palette (blue `#1F74BA`, yellow `#F8D706`, orange `#F09120`):
  [BrandColorCode — Flipkart](https://www.brandcolorcode.com/flipkart) — **[reported]**. Note the
  discrepancy below.
- Myntra's own seller image guidelines, which specify a **3:4 aspect ratio, 1080×1440**:
  [Fynd/Myntra image guidelines](https://documentation.fynd.com/commerce/docs/openapi/listings-management/myntra/image-guidelines-myntra) —
  **[observed]**, this one is authoritative and first-party.
- Flipkart Assured as a quality/speed badge:
  [Adgully announcement](https://archive.adgully.com/flipkart-launches-india--s-first-quality-speed-badge--flipkart-assured-68264.html)
  — **[observed]**.
- Live Envt's implemented tokens: [`docs/design-system.md`](./design-system.md) and
  `src/theme/tokens.ts` — **[ours]**.

**Things this guide will not tell you.** It will not give you a confident hex for Flipkart's UI
blue, or a confident answer for Myntra's current type family. The author could not verify those, and
inventing them would be worse than admitting it. Where a colour is needed, this guide specifies it
**by role**, which is what you should be coding against anyway.

---

## 1. Information density and card anatomy

### 1.1 What the three sites actually put on a card

All three are **grid-of-tiles** marketplaces: a filter rail on the left, a sort bar on top, and a
repeating tile. Their tiles differ in a way that is worth understanding, because the difference is
the whole argument for what Live Envt should do. **[observed]**

|                            | **Amazon**                                                                                                                                                              | **Flipkart**                                                                                    | **Myntra**                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Image ratio                | Square-ish, ~1:1, white background, product fills the frame                                                                                                             | Square-ish, ~1:1, white background                                                              | **Portrait 3:4** — first-party confirmed                            |
| Brand / maker line         | Not separated; often the first words of the title                                                                                                                       | Not separated; often the first words of the title                                               | **Its own line, small, bold, uppercase, above the title**           |
| Title                      | Long, ~2 lines, clamped, 14px-ish, often ALL-CAPS prefix                                                                                                                | ~2 lines, 12–14px, clamped                                                                      | 1–2 lines, small, muted grey, below the brand                       |
| Rating                     | Amber star row + review count in brackets, directly under the title                                                                                                     | **A filled green rounded chip: star glyph + number**, review count in grey beneath              | Small rounded chip with star + number and a `(1.2k)`-style count    |
| Price                      | The loudest thing on the tile. Large (≈28px per reverse-engineering), with a smaller superscript for the decimal fraction, and a separate strikethrough MRP + "Save ₹X" | Discounted price bold, strikethrough MRP, **discount % in green**, then "Special price" framing | Discounted price bold, strikethrough MRP, **"(40% OFF)" in orange** |
| Trust badge over the image | "Best Seller", "Amazon's Choice"                                                                                                                                        | "Flipkart Assured"                                                                              | Rare; mostly brand-authorised badges                                |
| Logistics / offer copy     | Delivery date, "FREE delivery", Prime                                                                                                                                   | "Free Delivery", "Bank Offer"                                                                   | Delivery on the PDP, not the tile                                   |
| Action on the tile         | None; the tile is a link                                                                                                                                                | None; the tile is a link                                                                        | None; the tile is a link, plus a wishlist heart                     |
| Tile chrome                | Border or plain, tightly packed                                                                                                                                         | White tile, tightly packed                                                                      | **Borderless, white, with visibly larger gutters**                  |

The single most important observation for this project: **the "Action on the tile" row is empty on
all three sites.** Amazon, Flipkart and Myntra do not put an "Add to cart" button on a browse tile —
the tile is entirely a _link_, and the transaction lives on the product page. Their density comes
from the fact that the tile only has to _inform and route_, never _convert_. **[observed]**

### 1.2 The structural diff, in one line each

- **Amazon** — the tile is a **specification sheet**. Maximum text rows, smallest type, price is the
  anchor, badges are awarded by an algorithm and the user is expected to know the domain. This is
  the densest and the least forgiving of the three. **[observed]**
- **Flipkart** — the tile is a **buy decision shortcut**. One green chip answers "is this any good"
  and one number answers "is this cheap", in two visual tokens. This is the highest
  scan-speed-to-pixel ratio of the three, and the best model for a marketplace that must be scanned
  fast on a mid-range Android phone. **[observed]**
- **Myntra** — the tile is a **shelf card**. Brand-first hierarchy, portrait media, no borders, wide
  gutters. It is dense in _count_ (many tiles) but each tile breathes. It is the only one of the
  three that reads as editorial rather than utilitarian. **[observed]**

### 1.3 What is cart-oriented and must therefore be replaced

You cannot copy a cart card. Concretely, the elements below exist because Amazon/Flipkart/Myntra sell
discrete physical units, and each one has to be re-pointed at a _service_ or deleted.

| Their element                         | Why it exists                        | Live Envt replacement                                                                                                                        |
| ------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| SKU / variant swatches (size, colour) | One listing = many purchasable units | **Deleted.** A vendor is one entity. Category-specific packages ("Veg / Non-veg / Jain") belong on the profile, not the tile.                |
| Stock / "In stock" / "Only 2 left"    | Inventory depletion                  | **Deleted.** Services have capacity and dates, not stock. If availability is shown at all it must come from a real calendar.                 |
| Add to cart / Buy now                 | Fulfils a unit purchase              | **"Enquire"** (primary, opens the enquiry form pre-filled with the listing) and **"Shortlist"** (secondary icon toggle).                     |
| Delivery date / "FREE delivery"       | Logistics promise                    | **"Responds within ~4h"** or **"Serves 12 cities in NCR"** — but only when measured from real data (see §2.4).                               |
| Strikethrough MRP + discount %        | Price anchoring against a list price | **Deleted.** A service has no MRP. A fake strikethrough on a wedding vendor is both meaningless and a misrepresentation.                     |
| "Bank Offer"/"Special price" banners  | Payment-partner promotions           | **Deleted.**                                                                                                                                 |
| Star rating + review count            | Social proof from transactions       | **Deleted as a visual pattern.** See §2 — no fabricated ratings.                                                                             |
| Prime / Assured programme badge       | A logistics membership programme     | **"Verified"** — only when a real `Verification` record exists and is not expired.                                                           |
| Wishlist heart                        | Save for a later purchase decision   | **Shortlist** — legitimate here, and the toggle is a 32px icon at the top-right of the media well.                                           |
| Ad / sponsored tile inset in the grid | Monetisation                         | **Deleted unless labelled.** If sponsored placement ever ships, the label is a visible `Sponsored` chip in the tile, not a footnote. See §9. |

### 1.4 The scan anchor — the concept the card is built around

Before the anatomy, the principle, because the rest of this document depends on it.

On Amazon and Flipkart, a tile has **one dominant visual value** and everything else is
subordinate to it. On Amazon that value is the price. On Flipkart it is the green rating chip and
then the price. The eye lands on that value, decides "yes/no, cheaper/better than the last tile",
and moves on. Every other element on the tile — title, delivery, offers — is _supporting evidence_
that the user only reads after the anchor has passed. **[observed]**

Live Envt has neither ratings (forbidden — fabricated ratings) nor always-available prices. §2
specifies what replaces the anchor. The rule for now:

> **Anchor invariant.** Every listing tile reserves the same fixed-height row for its single
> strongest **verifiable** fact, in the largest and heaviest type in the tile body. Cards in one
> grid must align that row on a common baseline.

This alignment is what Amazon's grid achieves and what makes a page of 24 tiles feel like a table
rather than a collage. It is not decoration; it is the mechanism by which a dense page stays
scannable.

### 1.5 Card anatomy spec — `ServiceListingCard` (grid tile)

Applies to the public browse grid (`/vendors`), category pages, city pages, and "similar vendors"
rails. Width range 280–340px, 3–4 per row at `lg` and above, 2 at `sm`, 1 below `sm`.

```
┌──────────────────────────────────────────────┐
│                                              │  ← media well, aspect-ratio 3/2
│   [badge]                        [♡ 32×32]   │     full-bleed, object-fit: cover
│                                              │     radius: top = card radius
├──────────────────────────────────────────────┤
│  Banquet hall name                           │  ← title, 17px/700/1.3, clamp 2
│  Banquet Hall · Koregaon Park                │  ← meta 1, 13px/550 muted, 1 line
│  Up to 600 guests                            │  ← meta 2, 13px/550 muted, 1 line
│                                              │  ← 16px
│  ₹1,200 onward    per plate                  │  ← ANCHOR, 18px/750 ink + 13px/550 muted
│  ──────────────────────────────────────────  │  ← 1px hairline
│  [        View vendor       ]                │  ← 40px action, full width
└──────────────────────────────────────────────┘
```

**Exact boxes, in order.** Vertical rhythm is the point of this table — do not improvise gaps.

| #   | Element                                            | Box / ratio                                                                                                           | Type token                                                                                     | Colour role                                                             | Gap _below_          |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------- |
| 1   | Media well                                         | `aspect-ratio: 3 / 2`; `width: 100%`; `object-fit: cover`; the ratio is owned by `AspectImage`, pages must not set it | —                                                                                              | `--app-surface-muted` as the loading fill                               | 0 (bleeds into body) |
| 1a  | Badge slot (overlay, top-left, inset `12px`)       | max **one** badge; height `22px`; `--app-radius-pill`                                                                 | caption, 12px/650                                                                              | tone of the badge                                                       | —                    |
| 1b  | Shortlist toggle (overlay, top-right, inset `8px`) | `32×32px` hit area, 18px glyph                                                                                        | —                                                                                              | `--app-ink` on `--app-surface-raised`                                   | —                    |
| 2   | Body padding                                       | `12px` on browse surfaces, `16px` on editorial surfaces (`--app-card-padding`)                                        | —                                                                                              | —                                                                       | —                    |
| 3   | Title                                              | **reserve exactly 2 lines** using `min-height: calc(2 * 1.3 * 17px)`; `-webkit-line-clamp: 2`                         | card-title, **17px / 700 / 1.3 / -0.01em**                                                     | `--app-ink`                                                             | `8px`                |
| 4   | Meta row 1                                         | single line, `text-overflow: ellipsis`, `min-height: 18px`                                                            | meta, **13px / 550 / 1.4**                                                                     | `--app-ink-muted`                                                       | `4px`                |
| 5   | Meta row 2                                         | single line, ellipsis, `min-height: 18px` — **always reserve it, even when empty**, so cards stay level               | meta, **13px / 550 / 1.4**                                                                     | `--app-ink-muted`                                                       | `16px`               |
| 6   | Anchor row                                         | `min-height: 26px`; number and unit on one baseline                                                                   | anchor, **18px / 750 / 1.2 / -0.01em**, `font-variant-numeric: tabular-nums`; unit is 13px/550 | `--app-ink` (or `--app-primary` when the anchor _is_ a published price) | `12px`               |
| 7   | Divider                                            | `1px solid var(--app-border)`; only present when there is a full-width action                                         | —                                                                                              | `--app-border`                                                          | `12px`               |
| 8   | Action                                             | `height: 40px`, `width: 100%`, `--app-radius-control`                                                                 | button, 14px/650                                                                               | secondary by default; see §1.7                                          | 0                    |

**Resulting tile height** at 300px wide: 200 media + 12 + 44 title + 4 + 18 + 4 + 18 + 16 + 26 + 12

- 1 + 12 + 40 + 12 ≈ **419px**. Keep new elements out of this box; if the tile grows past ~430px you
  have lost the density argument.

**Grid.** `repeat(auto-fill, minmax(min(280px, 100%), 1fr))`, `gap: 20px` column and row. 20px, not
24px and not 16px — 16px makes four tiles read as one mass, 24px wastes a full tile column at 1280px.
Myntra's larger gutters are a luxury of a two-column-ish shelf; a multi-category filterable grid
needs the tighter figure. **[ours]**

**One ratio per grid.** The image ratio is a property of the _grid context_, never of the listing.
Myntra's 3:4 portrait is correct for apparel on a body; a banquet hall, a mandap and a stage are
landscape subjects, and portrait media crops them badly. Use **3:2 landscape everywhere by default**
(with 4:5 portrait permitted only if an entire category grid opts in — e.g. a makeup-artist or
photographer portfolio grid — and never mixed within one grid). This is already enforced in the
repo by `AspectImage` owning the ratio. **[ours]**

### 1.6 Variants

Only three card layouts are permitted. Resist a fourth.

**A. Grid tile** — §1.5. Public browse, city pages, category pages, "similar vendors".

**B. Row tile** — for wide viewports, search results, and any "compare" surface. Amazon's list mode
is the model; it is genuinely more efficient above ~1100px because the eye scans a single left-aligned
column of images instead of zig-zagging. **[observed]**

```
┌────────────┬─────────────────────────────────────────────┬───────────────┐
│            │  Banquet hall name                          │  ₹1,200       │
│  240×160   │  Banquet Hall · Koregaon Park               │  per plate    │
│            │  Up to 600 guests · Serves Pune             │  [ Enquire ]  │
└────────────┴─────────────────────────────────────────────┴───────────────┘
```

Media `240×160` (same 3:2), body is a single column, and the **anchor sits in its own right-hand
column, top-aligned, on every row** — that is what makes a list of 20 vendors scannable in one
vertical sweep. Row height is fixed at `160px`; meta rows collapse to one line and overflow is
clamped, not wrapped.

**C. Dense row** — admin only. `64×48` thumbnail, 13px dense title, tabular columns, 44px row
height, no media radius beyond `--app-radius-1`. This is a table with a picture, not a card.

### 1.7 Category tiles

A separate, much simpler component, modelled on Flipkart's and Myntra's category strips.
**[observed]**

- Square or 4:3 media, **solid tinted or photographic background**, full-bleed.
- **One label**, 2–4 words, centred, 13px/650, high-contrast on the media (scrim if needed).
- **One optional count**, 12px/550 — and the count must be a real `COUNT(*)` of published listings.
  If the count is zero, hide the tile entirely rather than showing "0 vendors".
- No description, no CTA, no badge.
- Grid: 2 columns at `xs`, 3–4 at `sm`, 6–7 at `lg`; gap 12px (tighter than the listing grid — tiles
  are navigation, not decisions).
- Radius: `--app-radius-2` (8px). Category tiles are chrome; they get less radius than listing cards.

### 1.8 Filter sidebar

Modelled on all three, which are structurally almost identical. **[observed]**

```
Filters                                  [Clear all]
────────────────────────────────────────────────────
Category                                       (24)
  ☐ Banquet Halls                              (9)
  ☐ Photographers                              (6)
  … 6 shown, "Show 14 more"
City                                            (7)
Budget
  [ slider ]  ₹0 ────────────── ₹10,00,000
```

Rules:

1. **Counts in parentheses, muted, right-aligned** — the count is part of the scan. Amazon shows
   counts; a filter with no count forces a click to discover an empty result. Always show real counts.
2. **Collapse at 8 options** with a `Show N more` text button. Never scroll a filter group internally.
3. **Option rows are 32px tall**, 14px/450 label, checkbox or radio 16px, count 13px/550 muted.
   Hit target is the whole row, not the checkbox.
4. **Applied filters are chips above the results**, not just checked boxes in the rail. Each chip
   carries its label and a remove control with the accessible name `Remove filter: <label>`, and a
   `Clear all` sits at the end of the chip row. The rail's `Clear all` is only rendered when the rail
   has scroll-away content — never render two competing reset controls at the same scroll position.
5. **Group headers** are 13px/650 `--app-ink`, sticky within the rail when the group is long.
6. The rail is `260–280px` wide on desktop, does not scroll independently from the page below `md`,
   and becomes a `Drawer` (not a collapse) on mobile, with an applied-count badge on the trigger.

**Do not copy:** Amazon's rail is genuinely too long and too granular for a six-category services
marketplace. **[observed]** Six categories, four or five attributes each. If the rail needs a
"Show more filters" expansion, the taxonomy is wrong, not the UI.

### 1.9 Where density does _not_ apply

The enquiry form is not a browse surface. One column, `max-width: 560px`, 12px between a label and
its input, 20px between fields, 32px between the field group and the submit, `--app-radius-control`
on every control, and full-width submit on mobile. Amazon's checkout density is a _review_ density —
the user is checking a list, not making a choice — and it does not transfer to a form a user fills in
once while planning a wedding. **[ours]**

---

## 2. Price and rating treatment — building a scan anchor without either

### 2.1 Why price and rating are the anchors, mechanically

Both are **single-token, ordinal, comparable values**. A number the user can rank against the number
on the previous tile, in the same unit, in the same position. That is the entire mechanism: the eye
does not need to read, it needs to _sort_. Amazon's price (large, tabular, same position on every
tile) and Flipkart's green rating chip do the same job at different axes. **[observed]**

So the replacement cannot be "a nice-looking card". It has to be a **value that can be compared in
one glance across tiles**. Everything in this section follows from that constraint.

### 2.2 The anchor ladder (deterministic, per listing)

The anchor slot always renders the **first available** item in this list, in this order. Evaluation
happens server-side in one function so that a card is identical on every surface.

| Priority | Anchor                   | Source                                           | Renders as                                        | Tone                                                   |
| -------- | ------------------------ | ------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------ |
| 1        | **Published price**      | `priceMin` and/or `priceMax` from a real package | `₹1,200 onward` / `₹1,200 – ₹4,500` + unit suffix | `--app-ink`, number 18px/750, `tabular-nums`           |
| 2        | **Capacity** (venues)    | `capacityMin`/`capacityMax`                      | `Up to 600 guests`                                | `--app-ink`                                            |
| 3        | **Service area breadth** | real `ListingServiceArea` rows                   | `Serves 12 cities`                                | `--app-ink`                                            |
| 4        | **Experience**           | real non-null founding year                      | `12 years in business`                            | `--app-ink`                                            |
| 5        | **Response commitment**  | measured, n ≥ 10 (see §2.4)                      | `Usually replies in 4h`                           | `--app-positive-ink`                                   |
| 6        | **Listed recency**       | `publishedAt`                                    | `New on Live Envt`                                | `--app-ink-muted`, neutral — **never** a positive tone |
| 7        | **Fallback**             | —                                                | `Ask for details` over a dashed 1px rule          | `--app-ink-muted`                                      |

Position 7 is the honest floor and it must be _designed_, not blank: the repo's `PriceTag` already
renders a designed unknown state as muted text over a dashed rule, and `onRequestLabel` lets a caller
add a reason. Keep that. **Never render `₹0`, `0`, `Free`, or an empty box.**

The ladder is what gives the grid its comparable column: at any scroll position most tiles will be
showing priority 1 or 2, so the anchor row is _mostly_ apples-to-apples, and the exceptions are
visually obvious rather than silently incomparable.

### 2.3 "Price on request" is a first-class state, not an error

For a lead-generation marketplace, "price on request" is frequently the _correct_ business state —
many Indian venues and decorators do not publish rates. Treat it as a legitimate value:

- Label: `Price on request` (title case, sentence style — match the rest of the product).
- Type: 15px/650 `--app-ink-muted`, over a `1px dashed var(--app-border-strong)` rule on the leading
  edge, so it reads as a deliberate state rather than a missing value.
- Supporting microcopy in the meta rows, not in the anchor: e.g. `3 packages · from ₹850` if _any_
  package has a price — that keeps a number on the card without inventing one.
- Never phrase it as a negative (`Price not available`, `No pricing`) and never use `N/A` or `—`.

### 2.4 The trust row — the honest substitute for ratings

Where Flipkart spends one green chip on "is this good", Live Envt spends a compact row of **at most
three verifiable facts**. This is the direct answer to "no ratings allowed".

```
✓ Verified   ·   Replies in ~4h   ·   12 yrs
```

| Chip                                             | Rendered only when                                                                                | Tone     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------- |
| `Verified`                                       | a `Verification` record exists **and** `expiresAt` is null or in the future                       | positive |
| `Replies in ~Xh` / `Responds to X% of enquiries` | **n ≥ 10 enquiries** in the trailing 90 days, computed from real `Enquiry`/`EnquiryActivity` rows | positive |
| `X yrs`                                          | a non-null founding date                                                                          | neutral  |
| `Up to N guests`, `Serves N cities`              | real relation counts                                                                              | neutral  |
| `Featured`                                       | an actual editorial or paid placement flag                                                        | accent   |

Rules:

1. **Maximum three chips.** A fourth chip is a signal to move the fact into a meta row.
2. **The sample-size rule is not optional.** `Responds in 4h` computed from two enquiries in
   February is a fabricated claim wearing a number. Gate every derived metric behind `n ≥ 10`, and
   when the gate fails, render nothing at all — not "Not enough data".
3. **No count-up animation** on these numbers. Ever. A number that animates is a number that was
   chosen for effect.
4. **Prefer a distribution over a single figure** for anything that could mislead: `Booked by 3 of
the last 10 enquiries` is honest; `Popular` is not.

**The single best rating substitute available to this product is measured responsiveness.** It is
behavioural, it is generated by the platform itself, it is impossible for a vendor to fake by asking
friends, and it is the thing a couple actually wants to know before sending an enquiry ("will anyone
answer me?"). Treat it as the flagship trust signal, subject to the n ≥ 10 gate.

### 2.5 What must never be rendered as an anchor

- Star glyphs of any kind, including hollow or "coming soon" stars. A star shape is a promise of a
  rating; an empty star row reads as a zero rating and is worse than no rating.
- `Be the first to review`, `0 reviews`, `No reviews yet` on a tile.
- Any numeric social proof the platform does not literally compute: `1.2k couples viewed this`,
  `Trending`, `Popular`, `Top rated`, `#1 in Pune`.
- Discount framing: struck-through rates, `40% OFF`, `Save ₹X`, `Deal`.
- Urgency: `Only 2 dates left`, `3 people enquiring now`, `Offer ends in 04:12:33`.

These are covered again in §9 because they are the most likely thing to be copied by accident.

---

## 3. Colour hierarchy and roles

### 3.1 What the three sites do

|              | Wall / chrome                                                          | Surface                              | Ink                                                 | Action colour                                                                                                                                                       | Notes                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Amazon**   | White content on a dark slate-navy chrome (`#131921`-ish) **[approx]** | White, with light-grey section fills | Near-black `#0F1111`, _not_ pure black **[approx]** | **Warm yellow `#FFD814`** for primary buy, amber `#FFA41C` for Buy Now **[reported]**                                                                               | Links are a businesslike teal (`#007185`-ish) **[approx]**, deliberately _not_ the button colour; price uses a dark red for deal pricing **[approx]** |
| **Flipkart** | White, with a strong blue header bar                                   | White tiles                          | Near-black                                          | **Blue** — the header and CTAs share one blue; `#2874F0` is the widely circulated UI value, and the brand palette lists a deeper logo blue `#1F74BA` **[reported]** | Discount % in green, "Assured" badge, logo yellow/orange reserved for the mark and sale banners **[reported]**                                        |
| **Myntra**   | White, borderless                                                      | White, card-free                     | Dark grey ink                                       | **Magenta/pink**; the logo is an orange→magenta gradient, brand palette lists `#FF912E` → `#F41CB2` **[reported]**                                                  | Discount text in orange, structurally the same green/orange "good number" job Flipkart gives green **[observed]**                                     |

**Confidence note.** The Amazon yellow is corroborated by two independent reverse-engineering sources
and matches the site. The Flipkart blue is genuinely ambiguous: the logo blue (`#1F74BA`) and the UI
blue (`#2874F0`) are different values and aggregators report the logo one. Do not cite either as
Flipkart's UI colour with certainty. Myntra's `#FF3F6C`, which circulates as "Myntra pink", is
**unverified** — the only first-party-adjacent list found was the logo gradient above.

### 3.2 The transferable rule

Strip away the hexes and all three do exactly the same thing:

> **The wall is neutral. The brand colour is spent on the action. Nothing else competes.**

Amazon's own rationale is explicit in the teardown: if their buttons were blue they would compete
with links, so yellow is reserved for buying while blue is reserved for navigating.
[Ecom Giant Insider](https://ecomgiantinsider.club/uncategorized/amazon-button-color-palette/) **[reported]**

A marketplace needs **one dominant action colour** for a specific reason that a marketing site does
not have: on a browse page the user's question is _"which of these twenty things do I act on, and
what happens when I do?"_ — and there is exactly one answer to the second half. If the primary fill
also appears on the header, the badges, the links and the filter chips, then no pixel on the page
means "this is the action" any more. Multi-colour marketplaces fail at the exact moment the user
decides to convert, because the convert button is indistinguishable from the chrome.

Live Envt's primary is **plum**, and the accent is **brass**; the full ramps are in
`src/theme/tokens.ts` and §3.1 of [`docs/design-system.md`](./design-system.md). The role spec below
is what components code against. **[ours]**

### 3.3 Role specification

Nine roles. Every colour in the app is one of these; no component introduces a tenth.

| Role token                                               | What it is                                   | Where it is allowed                                                                                       | Where it is forbidden                                                |
| -------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `--app-surface`                                          | Page canvas / "wall"                         | `<body>`, page background, the gaps between cards                                                         | Behind text without a raised surface                                 |
| `--app-surface-raised`                                   | Card, panel, modal, tile                     | Listing cards, filter rail, modals, popovers                                                              | Full-page backgrounds                                                |
| `--app-surface-muted`                                    | Sunken / secondary fill                      | Table headers, image loading fill, disabled controls, filter group wells                                  | Any element that must look interactive                               |
| `--app-surface-hover`                                    | Hover fill for neutral rows                  | Table rows, menu items, filter options                                                                    | Buttons (they use the primary ramp)                                  |
| `--app-ink`                                              | Primary text                                 | Titles, anchors, body, labels, table cells                                                                | Large decorative areas; text below 4.5:1 on its surface              |
| `--app-ink-muted`                                        | Secondary text                               | Meta rows, captions, counts, units, helper text                                                           | The anchor row (it must out-rank the meta rows)                      |
| `--app-ink-subtle`                                       | Lowest-emphasis text                         | Placeholders, disabled labels, timestamps in admin                                                        | Anything a user must read to act                                     |
| `--app-primary` (×`-hover`, `-active`, `-subtle`, `-on`) | **The action colour**                        | Primary buttons, the single CTA per card/section, active nav indicator, focus ring, selected filter chips | Header background, body text, badges, decorative fills, status tones |
| `--app-accent`                                           | Identity accent, brass                       | Eyebrows, the focus ring, one identity detail, the `Featured` badge tone                                  | Any second thing that looks clickable                                |
| `--app-border` / `--app-border-strong`                   | Hairlines and control outlines               | Card borders, dividers, input outlines, table rules                                                       | Fills                                                                |
| `--app-positive` / `--app-positive-soft`                 | Success, verified, published, won            | Status badges, success alerts, verified chips                                                             | Primary actions                                                      |
| `--app-caution` / `--app-caution-soft`                   | Warning, unpublished, pending                | Status badges, warnings                                                                                   | Errors                                                               |
| `--app-critical` / `--app-critical-soft`                 | Error, destructive, lost, archived-by-policy | Validation, destructive buttons, error states                                                             | Anything non-destructive                                             |

All of the above except `--app-surface*` need a paired `-soft` (a low-chroma tinted fill) and a
`-text` (a tone that passes 4.5:1 on that soft fill). The repo's `StatusBadge` already implements
this as four custom properties per tone (`--tone`, `--tone-soft`, `--tone-soft-text`, `--tone-contrast`)
— keep that contract for every new tone.

### 3.4 Coverage budgets

Coverage is expressed as a share of the **painted chroma** on screen, because neutrals dominate by
area on any of these sites and a naive area budget is unenforceable. Check these against a
screenshot of a real browse page at 1440×900.

| Role group                                       | Budget                                   | Checkable rule                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface` + `surface-raised` + `surface-muted`   | **≥ 90% of painted area**                | If you desaturate the screenshot to greyscale, you should struggle to find the coloured pixels                                                                               |
| `ink` + `ink-muted` + `ink-subtle`               | ~6–9% of area, but 100% of the hierarchy | No text below 4.5:1 on its surface; muted text below 5:1 is a bug                                                                                                            |
| `primary` (as a fill)                            | **≤ 4%**                                 | At any scroll position there is **at most one primary-filled button per card and one per page section**. A second primary in the same viewport must be demoted to secondary. |
| `accent`                                         | **≤ 1.5%**                               | Accent is a _line_ or a _glyph_, never a fill larger than a badge                                                                                                            |
| `positive` / `caution` / `critical` (soft fills) | **≤ 3% combined**                        | At most two status pills visible in one viewport                                                                                                                             |
| Any single saturated fill                        | **≤ 8%** of the viewport                 | A filled element larger than 8% of the screen must be a neutral surface                                                                                                      |

Two more hard rules:

- **One primary per card.** The `Enquire` button is primary; `Shortlist` is a ghost icon; `View
vendor` is a secondary/outline button or the card link itself. Never two primaries in one tile.
- **Status colours are never the action colour.** A `New` lead badge must not use `--app-primary`.
  This is why §6 maps lead statuses onto accent and semantic tones, not onto primary.

### 3.5 Dark theme

Do not invert. The dark theme is designed per-role, and the repo already does this deliberately
(§3.4 of [`docs/design-system.md`](./design-system.md)). None of the three reference sites ship a
credible dark theme, so **there is no model to copy here — this part is entirely `[ours]`.** The
rules that matter:

1. **Elevation is carried by surface lightness in dark mode, not by shadow.** A near-black shadow on
   a near-black page is invisible. `surface` → `surface-raised` → `surface-muted` must be three
   distinguishable lightness steps; shadows are a secondary cue only (hence §5.3's darker alphas).
2. **Primary loses its "brightest thing" advantage.** In light mode the plum fill on a white wall is
   the loudest object. In dark mode everything is dark, so the primary must be re-picked for contrast,
   not reused. The repo uses the ramp's lighter steps for dark-mode fills.
3. **Never use a light-mode soft tint as a dark-mode fill.** A 4% plum tint on white is a soft
   background; the same tint on near-black is invisible. Soft tones get their own dark values.
4. **Images dominate a dark UI more than a light one.** Media wells need a visible border in dark
   mode; on a white page the image edge is implied by contrast, on a dark page it dissolves.
5. **Verify, do not eyeball.** Every text/background pair needs a measured contrast ratio; the repo
   keeps a measured table in §3.5 of [`design-system.md`](./design-system.md). Add rows for
   anything new.

---

## 4. Typography scale and hierarchy — one family

### 4.1 Why fewer weights is the internal logic, not a constraint

The instinct on being told "one font" is to reach for _more_ weights to fake the missing second
typeface. That is backwards for a marketplace, for three reasons:

1. **Weight only carries hierarchy if it is scarce.** A browse page renders roughly 400 text nodes in
   24 tiles. If five weights appear, the reader cannot learn "heavier = more important" — weight
   stops being a channel and becomes noise. Three weights (body, semibold, bold) is enough to build
   4–5 clear levels when combined with size and colour.
2. **Each weight is a rendering cost.** Manrope is variable so the file cost is one, but the browser
   still instantiates a distinct weight per composite layer; on a mid-range Android in India this
   shows up in the scroll. Keeping to a small set of weights that are already on screen lets the
   engine reuse glyph caches.
3. **Small sizes punish light weights.** A 300-weight 13px line on a bright sub-₹15,000 phone screen
   is genuinely hard to read. Dense marketplaces push type _smaller and heavier_, not smaller and
   lighter — that is exactly what Amazon does, and it is why their 14px body reads as legible at
   400 weight. **[observed]**

### 4.2 The scale

Values match the implemented tokens in `src/app/globals.css` **[ours]**; the `anchor` step is the one
addition this guide introduces.

| Token               | Size                                           | Line-height | Weight  | Letter-spacing | Colour role                                            | Used on                                                                                   |
| ------------------- | ---------------------------------------------- | ----------- | ------- | -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `--text-hero`       | `clamp(2.5rem, 2rem + 3.2vw, 4.75rem)`         | 1.04        | **600** | `0.01em`       | on-dark ramp                                           | Home hero only, uppercase. Never on a browse or admin surface.                            |
| `--text-display`    | `clamp(2.5rem, 1.6rem + 3.6vw, 4rem)`          | 1.05        | **800** | `-0.03em`      | `--app-ink`                                            | Reserved. The hero now uses `--text-hero`; sentence-case display copy may still use this. |
| `--text-h1`         | `clamp(2rem, 1.5rem + 2vw, 3rem)`              | 1.08        | **750** | `-0.025em`     | `--app-ink`                                            | Page title, one per page.                                                                 |
| `--text-h2`         | `clamp(1.5rem, 1.3rem + 0.9vw, 2.125rem)`      | 1.15        | **720** | `-0.02em`      | `--app-ink`                                            | Major section headings.                                                                   |
| `--text-h3`         | `clamp(1.1875rem, 1.1rem + 0.35vw, 1.4375rem)` | 1.22        | **700** | `-0.015em`     | `--app-ink`                                            | Subsections, vendor-profile block headings.                                               |
| **`--text-anchor`** | **`1.125rem` (18px)**                          | **1.2**     | **750** | **`-0.01em`**  | `--app-ink` (or `--app-primary` for a published price) | **The card anchor row.** Pair with `font-variant-numeric: tabular-nums`.                  |
| `--text-card-title` | `1.0625rem` (17px)                             | 1.3         | **700** | `-0.01em`      | `--app-ink`                                            | Listing titles, card headings. Clamp to 2 lines.                                          |
| `--text-body`       | `0.9375rem` (15px)                             | 1.6         | **450** | `0`            | `--app-ink`                                            | Prose, profile copy, form help.                                                           |
| `--text-secondary`  | `0.875rem` (14px)                              | 1.55        | **450** | `0`            | `--app-ink`                                            | Body copy inside dense regions, form inputs.                                              |
| `--text-button`     | `0.875rem` (14px)                              | 1           | **650** | `0`            | depends on variant                                     | All buttons. Weight 650, never 700 — a 700 button label competes with the card title.     |
| `--text-label`      | `0.8125rem` (13px)                             | 1.3         | **650** | `0`            | `--app-ink`                                            | Field labels, table headers, filter group headers, meta row 1 and 2.                      |
| `--text-caption`    | `0.75rem` (12px)                               | 1.4         | **550** | `+0.005em`     | `--app-ink-muted`                                      | Badges, counts, timestamps, units.                                                        |
| `--text-error`      | `0.75rem` (12px)                               | 1.4         | **600** | `+0.005em`     | `--app-critical`                                       | Inline validation only.                                                                   |
| `--text-dense`      | `0.8125rem` (13px)                             | 1.35        | **500** | `0`            | `--app-ink`                                            | Admin tables. `tabular-nums` on numeric columns. Never for prose.                         |

**Weights used: 450, 500, 550, 600, 650, 700, 720, 750, 800.**

**Weights deliberately _not_ used:**

| Weight              | Why not                                                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **200, 300**        | Illegible at the 12–14px that dominates a dense surface, and Manrope at 300 loses the open apertures that make it work at small sizes. There is no surface in this product that can afford them.                                  |
| **400**             | Skipped in favour of **450** for body copy. Manrope is a variable font, so 450 is a real interpolation, not faux-bold. A 450 body on a white card has marginally better presence at 13–15px than 400 without reading as emphasis. |
| **900**             | Outside Manrope's useful range (the axis tops out at 800). Requesting it gets you 800 with a synthetic step.                                                                                                                      |
| **Anything italic** | Italic is not a hierarchy channel here — it does not survive at 13px and it reads as "quoted" or "cancelled" (as in MRP strikethrough) rather than as emphasis. Use weight, size and colour.                                      |

That is **three perceptual levels per surface** by weight alone (450 body / 650 label / 700–750
heading), expanded to 5–6 by size and colour.

### 4.3 Letter-spacing rules

- **≥ 18px onward:** negative tracking, scaled by size (`-0.01em` at 18px → `-0.03em` at 64px).
  Large type set at zero tracking looks loose and amateurish in a geometric sans like Manrope.
- **13–17px:** `0`. Do not add tracking to body or titles; Manrope's default spacing is already
  generous and adding to a 17px title widens the card.
- **≤ 12px:** `+0.005em`. A hair of positive tracking at 12px recovers legibility on low-DPI screens.
- **Uppercase micro-labels only:** `+0.04em`. And see §4.4.

### 4.4 The uppercase rule

Amazon and Flipkart do **not** uppercase product titles. Myntra does uppercase **the brand line** —
but the brand line is the _shortest, most repeated token_ on the card, which is precisely what makes
uppercase work there. **[observed]**

> **Rule.** Uppercase is permitted only for tokens of **≤ 3 words** that repeat identically across
> many cards: badges (`VERIFIED`, `FEATURED`), table column headers, a category overline in admin, and
> short facet labels. Never for a vendor name, never for a listing title, never for body copy, never
> for a sentence.

Uppercase destroys word-shape, and word-shape is what makes a dense grid scannable by title. Trading
that for visual variety is a bad deal.

### 4.5 Micro-rules that make one family look deliberate

1. **`font-variant-numeric: tabular-nums` on every number that sits in a column or aligns across
   cards** — anchors, prices, capacities, counts, admin cells. Proportional digits make a grid of
   cards look ragged. This is non-negotiable on the anchor row.
2. **`text-wrap: balance` on `h1`–`h3` only.** On card titles use `-webkit-line-clamp` instead;
   balancing a clamped 2-line title produces a short second line that wastes the reserved height.
3. **`text-wrap: pretty` on prose paragraphs**, not on meta rows.
4. **Reserve, do not collapse.** Two-line titles and one-line meta rows must occupy a fixed box even
   when the content is shorter. Aligned anchors depend on it (§1.5).
5. **The unit is never part of the number token.** `₹1,200` is 18px/750; `per plate` is 13px/550
   muted, on the same baseline. Two sizes on one line is what makes a price row read as designed
   rather than typed. The repo's `PriceTag` already splits these.
6. **One `<h1>` per page.** The card title is a heading in outline terms only if the card is a
   section; in a grid of 24 it is a link inside a list item. Do not emit 24 `h3`s.

---

## 5. Spacing, radius and elevation

### 5.1 Spacing scale

**4px base.** A 4px base is what all three sites effectively use (Amazon's scale is quoted as
4/8/12/14/16/20/28 in reverse-engineering **[approx]**) and it is the only base that lets a 13px meta
row sit at 4px and 8px without the layout drifting.

| Token        | Value            | Typical use                                                                                       |
| ------------ | ---------------- | ------------------------------------------------------------------------------------------------- |
| `--space-1`  | `0.25rem` (4px)  | Between a meta label and its value; icon-to-text inside a chip                                    |
| `--space-2`  | `0.5rem` (8px)   | Between meta rows; between a title and its first meta row; inside button padding (block)          |
| `--space-3`  | `0.75rem` (12px) | **Card body padding (browse)**; card radius inset; between a label and its input                  |
| `--space-4`  | `1rem` (16px)    | **Card body padding (editorial)**; between the meta block and the anchor row; between form fields |
| `--space-5`  | `1.25rem` (20px) | **Listing grid gap** (row and column)                                                             |
| `--space-6`  | `1.5rem` (24px)  | Between a section heading and its content; panel padding                                          |
| `--space-8`  | `2rem` (32px)    | Dense-surface section gap (browse, admin, account)                                                |
| `--space-10` | `2.5rem` (40px)  | Editorial section gap at small viewports                                                          |
| `--space-12` | `3rem` (48px)    | Editorial section gap at `md`                                                                     |
| `--space-16` | `4rem` (64px)    | Marketing section gap                                                                             |
| `--space-20` | `5rem` (80px)    | Home hero vertical padding only                                                                   |

**Semantic aliases** — components should reach for these, not for the numeric steps, so that density
can be re-valued in one place:

| Token                | Light/browse value                     | Editorial value                       |
| -------------------- | -------------------------------------- | ------------------------------------- |
| `--app-card-padding` | `12px`                                 | `16px`                                |
| `--app-stack-gap`    | `16px`                                 | `16px`                                |
| `--app-section-gap`  | `32px`                                 | `clamp(2.5rem, 1.5rem + 3vw, 4.5rem)` |
| `--app-gutter`       | `clamp(1rem, 0.25rem + 2.5vw, 2.5rem)` | same                                  |

Mantine's `xs…xl` names stay available and map onto the numeric scale
(`xs`=8, `sm`=12, `md`=16, `lg`=24, `xl`=36) so Mantine components inherit the rhythm unchanged.
The numeric scale is canonical; the aliases are a compatibility layer.

**Rule of thumb for choosing a step.** Space _within_ a component is 4–12px; space _between_
components is 16–24px; space _between sections_ is 32px+ on dense surfaces and 48px+ on editorial
ones. If a gap is between two components but under 12px, the two components are actually one
component.

### 5.2 Radius

A marketplace uses **less radius on dense surfaces than a marketing page** for a specific reason:
radius is a "this is one discrete object" signal, and its cost scales with count. At 24 tiles, a
generous 16px radius turns the grid into a field of lozenges and the eye loses the rectangle edges
that make rows and columns legible. Marketing pages have 3 objects on screen, so generous radius is
free there. Amazon's structural cards stay at a small radius while only the pill-shaped search bar
and CTA go full-round — the pill is a _shape of a control_, not a shape of a container. **[approx]**

| Token                     | Value             | Applies to                                                                                                        | Why this level                                                                                |
| ------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `--app-radius-1`          | `0.25rem` (4px)   | Dense-surface internals: admin table thumbnails, small swatches, inline code wells, media wells inside a row tile | At 64×48px a 12px radius eats the image                                                       |
| `--app-radius-control`    | `0.5rem` (8px)    | **All controls**: inputs, selects, buttons, action icons, checkboxes (2px), chips that are not status             | Controls are handled, not looked at; 8px reads as tappable without being soft                 |
| `--app-radius-card-dense` | `0.75rem` (12px)  | **Listing cards and category tiles on browse surfaces, admin panels, tables**                                     | The dense-surface card radius. Enough to read as an object, tight enough to preserve the grid |
| `--app-radius-card`       | `0.875rem` (14px) | Vendor-profile panels, enquiry form surfaces, account panels, modals, drawers, **hero media**                     | The editorial card radius — the repo's current `--app-radius-card`                            |
| `--app-radius-pill`       | `999px`           | **Badges and status/filter chips only**                                                                           | The pill marks "this is a token, not a container"                                             |

Nothing else. Specifically: **no** radius on table rows, **no** radius on the page canvas, **no**
radius on dividers, and never a radius on an element that is also a surface sized to the viewport.

**Do not mix levels within one element.** A card at 12px must not contain a 14px panel; inner radius
is `outer − padding`, or the inner element is a control at 8px.

### 5.3 Elevation — three levels

Amazon separates with **1px borders and light fills, not shadows**; the whole surface is essentially
flat and only flyouts get a shadow. **[approx]** That is the correct default for a dense marketplace
and it is why level 0 below is "no shadow". Shadows are reserved for things that genuinely float
_above_ the document.

| Level  | Name           | Light                                                                        | Dark                                                                  | Used by                                                                                                    |
| ------ | -------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **E0** | Flat / resting | _no shadow_; `1px solid var(--app-border)`                                   | _no shadow_; `1px solid var(--app-border)`                            | **Default listing card**, filter rail, tables, category tiles, form surfaces. This is 95% of the app.      |
| **E1** | Raised         | `0 1px 2px rgba(29, 25, 23, 0.06), 0 2px 8px -3px rgba(29, 25, 23, 0.10)`    | `0 1px 2px rgba(0, 0, 0, 0.55), 0 2px 10px -3px rgba(0, 0, 0, 0.62)`  | Hovered/focused card, dropdown menu, popover, combobox list, sticky sub-nav, the sticky mobile enquiry bar |
| **E2** | Overlay        | `0 1px 2px rgba(29, 25, 23, 0.05), 0 10px 28px -14px rgba(29, 25, 23, 0.16)` | `0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 32px -16px rgba(0, 0, 0, 0.72)` | Modal, drawer, mobile filter sheet, date picker, notification toast                                        |
| **E3** | Top layer      | `0 28px 72px -18px rgba(29, 25, 23, 0.30)`                                   | `0 32px 80px -20px rgba(0, 0, 0, 0.80)`                               | Full-screen media lightbox, command palette, anything on top of an E2 layer                                |

Notes on the numbers:

- E2 dark reuses the repo's `--app-shadow-card` and E3 reuses `--app-shadow-overlay`; only E1 is new.
  Map the existing tokens as `--app-shadow-card` → E2, `--app-shadow-overlay` → E3.
- **Dark alphas are much higher (0.5–0.8 vs 0.05–0.30) on purpose.** A 5%-alpha black shadow on a
  near-black surface is literally invisible; the alpha has to carry the separation instead, and it
  still should be paired with a lighter `--app-surface-raised` (§3.5).
- **Never animate to a shadow level above E1 on a card.** A grid of 24 cards each animating a
  28px-blur shadow is the single fastest way to make a browse page feel cheap on a mid-range phone.
- **No shadow on the sticky header.** Use a 1px bottom border. A shadow under a header that overlaps
  scrolling cards reads as a rendering artefact.
- Elevation is not a substitute for hierarchy. Two sibling cards at different elevations imply one
  contains the other. That is almost never true in a listing grid.

---

## 6. Badges, trust signals and status

### 6.1 What the three sites do

| Pattern                                | Amazon                                           | Flipkart                              | Myntra                               | Confidence                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algorithmic award badge over the image | "Best Seller" (orange), "Amazon's Choice" (dark) | "Flipkart Assured"                    | Occasional brand-authorised badges   | **[observed]** for existence; colours **[approx]**                                                                                                   |
| Membership/programme badge             | "Prime"                                          | "Assured" / "Plus"                    | "Myntra Insider"                     | **[observed]** for Assured ([source](https://archive.adgully.com/flipkart-launches-india--s-first-quality-speed-badge--flipkart-assured-68264.html)) |
| Rating as a badge                      | Amber stars + count                              | **Green rounded chip, star + number** | Small chip, star + number + `(1.2k)` | **[observed]**                                                                                                                                       |
| Availability                           | "In Stock" green text                            | "Sold Out" / greyed tile              | Greyed tile                          | **[observed]**                                                                                                                                       |
| Discount                               | Red "Save ₹X", strikethrough MRP                 | Green `%` off                         | Orange `(40% OFF)`                   | **[observed]**                                                                                                                                       |
| Placement rule                         | Top-left of the image, one only                  | Top-left of the image                 | Over the image, sparingly            | **[observed]**                                                                                                                                       |

Two structural facts to carry over. First, **no site stacks more than one or two badges on a tile** —
the badge's whole value is that it is rare. Second, **every badge is a claim the platform can back**:
Amazon's Best Seller is a computed rank, Flipkart Assured is a fulfilment programme with published
criteria. Neither is decorative. **[observed]**

### 6.2 The rule for Live Envt

> **A badge may only render if the platform can produce the underlying record on demand.**

That is the whole policy. If a support engineer asks "why does this vendor say Verified?", the answer
must be a row in `Verification` with a check date and an expiry — not a boolean someone set in an
admin form during a demo. If a badge cannot survive that test, it is deleted, not softened.

### 6.3 Vocabulary and mapping

| Badge / status  | Tone     | Variant             | Icon           | Renders when                                                                                         | Never                                                                                                                |
| --------------- | -------- | ------------------- | -------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Verified`      | positive | soft                | check          | a `Verification` exists and is not expired                                                           | Render on a listing with no verification row, or with an expired one                                                 |
| `Featured`      | accent   | soft                | star _outline_ | an actual editorial or paid placement flag is set, **and** the placement is disclosed in the profile | Imply organic ranking; use a filled star (reads as a rating)                                                         |
| `New`           | neutral  | outline             | dot            | `publishedAt` is within 30 days **of the listing going live**                                        | Render for a re-publish or an edit                                                                                   |
| `Draft`         | neutral  | outline             | dot            | `status = DRAFT`                                                                                     | Appear on any public surface                                                                                         |
| `Published`     | positive | soft                | dot            | `status = PUBLISHED`                                                                                 | Appear on the public tile (the whole grid is published — a "Published" badge on every card carries zero information) |
| `Unpublished`   | caution  | soft                | dot            | `status = UNPUBLISHED`                                                                               | —                                                                                                                    |
| `Archived`      | neutral  | outline             | dot            | `status = ARCHIVED`                                                                                  | Use a destructive tone; archived is not an error                                                                     |
| `Response rate` | positive | soft, **text-only** | none           | n ≥ 10 in the trailing 90 days                                                                       | Appear below the sample-size gate                                                                                    |

**Critical detail on `Published`:** status badges belong on **admin surfaces**, where a mixed list
genuinely needs them. On the public browse grid, every visible listing is published, so a
`Published` badge is pure noise. Public tiles carry `Verified` and `Featured` only. This is exactly
why Amazon's "Best Seller" is meaningful and a hypothetical "In Stock" badge on every tile would not
be. **[ours]**

### 6.4 Lead statuses (admin only)

Lead status is admin/account chrome. It must **never** use the primary action fill (§3.4).

| Lead status | Tone     | Variant   | Because                                                                       |
| ----------- | -------- | --------- | ----------------------------------------------------------------------------- |
| `New`       | accent   | solid     | Needs attention; accent is the "look here" tone that is not the action colour |
| `Contacted` | neutral  | soft      | In progress, nothing to celebrate                                             |
| `Qualified` | positive | soft      | Real progress                                                                 |
| `Won`       | positive | **solid** | Terminal good state, deserves the strongest non-primary fill                  |
| `Lost`      | critical | soft      | Terminal bad state                                                            |
| `Spam`      | neutral  | outline   | Not a failure of the user or the vendor                                       |

### 6.5 Badge construction rules

1. **22px tall**, `--app-radius-pill`, `padding: 0 8px`, caption type 12px/650, one icon at 12px,
   4px icon-to-text gap.
2. **Maximum one badge over the media**, top-left, inset 12px. A second badge goes in the trust row
   in the card body, not stacked on the image.
3. **Maximum two badges on a card total.**
4. **Never colour alone.** Tone is always paired with a text label and, where useful, a `dot` or icon
   — the repo's `StatusBadge` already accepts `dot`. Colour-only status fails for the ~8% of Indian
   male users with red-green colour deficiency, and it fails in greyscale print of an admin export.
5. **The soft variant is the default.** Solid fills are reserved for terminal/urgent states, so that
   a screen of 20 rows does not become a wall of colour.
6. **No countdown, ever.** No timer, no "expires in", no pulsing dot. The only thing that may pulse
   is a live-connection indicator, which this product does not have.

### 6.6 Trust surfaces beyond badges

Badges are the cheapest trust signal and therefore the weakest. The stronger ones, in order:

1. **A real response commitment, measured** (§2.4) — beats every badge.
2. **Verified contact and identity details on the profile** — a named contact, a real address, a
   phone number behind a deliberate reveal (the repo has a product rule against a phone number in
   page text).
3. **Data completeness stated plainly** — "Responds to 8 of 10 enquiries" is trust; "Trusted vendor"
   is not.
4. **A stated review/verification date** — "Verified 3 Feb 2026" is auditable; a bare checkmark is
   not.

---

## 7. Interaction and motion

### 7.1 The principle

Amazon is a transactional UI and animates almost nothing: hover state changes are effectively
instant, on the order of 150ms, and structural things do not move. **[approx]** Flipkart and Myntra
add exactly one motion idea each — Myntra cross-fades to a second product image on hover, Flipkart
shimmers its skeletons. **[observed]** That is the whole vocabulary.

> **Marketplaces animate state, never position.** Colour, opacity and border may change. Nothing
> that has been laid out moves, grows, or slides unless it is entering or leaving the viewport as an
> overlay. Motion in a grid is not delight, it is a scroll-jank budget spent on nothing.

Why: on a browse page the user is comparing 24 objects. Motion anywhere in the grid competes for the
same attention the anchor row is supposed to win. A card that lifts on hover makes the _cursor_
interesting at the exact moment the _content_ should be.

### 7.2 Tokens

```css
--duration-instant: 0ms; /* text/link hover, focus ring appearance */
--duration-micro: 90ms; /* button bg/border change, checkbox tick, chip remove */
--duration-fast: 140ms; /* card border + elevation, menu item hover, tooltip */
--duration-base: 200ms; /* skeleton cross-fade, image cross-fade, scrim, modal enter */
--duration-slow: 280ms; /* drawer/sheet enter, accordion group expand */
--duration-exit: 140ms; /* anything leaving, always faster than entering */

--ease-out: cubic-bezier(0.2, 0, 0, 1); /* entering, hover, most things */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* state A -> state B, layout-ish */
--ease-in: cubic-bezier(0.4, 0, 1, 1); /* leaving */
```

Two rules on the values. **Exit is always shorter than enter** (140ms vs 200ms) — a slow exit makes
the UI feel like it is arguing with the user. **Nothing exceeds 320ms**, because above that the user
has already moved the cursor and the animation is now a delay.

### 7.3 Interaction-by-interaction spec

| Interaction                           | Change                                                              | Duration                                            | Easing                     | Never                                                                                |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| Card hover / focus-within             | `border-color` → `--app-border-strong`; elevation E0 → **E1 only**  | 140ms                                               | `--ease-out`               | Scale, rotate, translate, shadow beyond E1, moving the title                         |
| Card image hover (optional, per grid) | Cross-fade to the second image                                      | 200ms `opacity`, with a 60ms delay before it starts | `--ease-out`               | Zoom > 1.03; a zoom on a 24-tile grid is nauseating                                  |
| Link / title hover                    | `text-decoration: underline` + colour step                          | **0ms**                                             | —                          | Fading an underline; animated underlines; a colour transition on text                |
| Secondary button hover                | background one ramp step deeper                                     | 90ms                                                | `--ease-out`               | Elevation change                                                                     |
| Primary button hover                  | background one ramp step deeper, border matches                     | 90ms                                                | `--ease-out`               | Growth, glow, gradient shift                                                         |
| Button active/press                   | `translateY(1px)` + one further step deeper                         | 90ms in, 0ms out                                    | `--ease-out`               | Scale down below 0.98                                                                |
| Focus ring                            | `outline: 2px solid var(--app-focus-ring)`, `outline-offset: 2px`   | **0ms, always instant**                             | —                          | Fading a focus ring in. A focus ring that animates is an accessibility failure.      |
| Filter chip remove                    | width collapse + opacity out, then the grid re-flows **once**       | 140ms                                               | `--ease-in`                | Animating the grid re-flow itself                                                    |
| Filter option toggle                  | checkbox tick 90ms; the results grid updates with **no** transition | 90ms                                                | `--ease-out`               | Animating result counts up/down                                                      |
| Skeleton → content                    | opacity cross-fade over the skeleton                                | 200ms                                               | `--ease-out`               | A shimmer on the real content, a slide-in, a stagger per card                        |
| Skeleton shimmer                      | `background-position` sweep                                         | **1.2s linear, infinite**                           | linear                     | Shimmering faster than 1s (reads as a bug); shimmering on more than the visible rows |
| Dropdown / popover enter              | opacity 0→1 + `translateY(-4px)`→0                                  | 140ms                                               | `--ease-out`               | Scale-from-zero, spring, bounce                                                      |
| Modal / drawer enter                  | scrim opacity 200ms; panel `translateX/Y`                           | 200ms                                               | `--ease-out`               | Scale-in from 0.8; rotating                                                          |
| Modal / drawer exit                   | reverse                                                             | 140ms                                               | `--ease-in`                | Hanging on the exit                                                                  |
| Accordion / filter group              | `grid-template-rows` or height, 200ms                               | 200ms                                               | `--ease-in-out`            | Animating a very tall group (clamp to 300px)                                         |
| Toast                                 | `translateY(8px)` + opacity in; auto-dismiss **6s**; exit 140ms     | 200 / 140ms                                         | `--ease-out` / `--ease-in` | A toast that cannot be dismissed by hand                                             |
| Shortlist toggle                      | icon fill swap 90ms + a single 0ms colour change                    | 90ms                                                | `--ease-out`               | A heart burst, confetti, a scale-pop                                                 |

### 7.4 What is never animated

- **Layout**: the results grid re-flow, the filter rail width, table column widths, the card's own
  box. These snap. Animating a re-flow of 24 cards is the classic cause of a dropped-frame scroll on
  Android.
- **Numbers**: result counts, prices, capacities, ratings-substitutes, progress percentages. No
  count-ups, no odometer rolls. A number that moves is a number that was optimised for effect.
- **Focus rings.** Instant, both in and out.
- **Text colour, font-weight, or font-size on hover.** No layout-shifting hover. If a hover changes a
  title's weight, the title re-wraps and the whole row jitters.
- **`scroll-behavior: smooth` on filter application.** It is fine on an in-page anchor; it is not
  fine when the results change under the user.
- **Anything decorative at page load**: hero parallax, staggered card fade-ins, scroll-triggered
  reveals. A marketplace's job is to be finished rendering, not to perform.
- **Autoplaying carousels.** If a carousel exists it advances only on user action.
- **Cursor-following effects, custom cursors, hover video with sound.**

### 7.5 `prefers-reduced-motion` policy

The repo already neutralises `animation-duration`, `animation-iteration-count`, `transition-duration`
and `scroll-behavior` inside `@media (prefers-reduced-motion: reduce)`, and sets Mantine's
`respectReducedMotion: true`. Keep both. Beyond that, the policy has a distinction worth stating
explicitly, because "reduce everything to zero" breaks affordances:

> **Motion that carries state survives; motion that carries position goes.**
> A hover colour change _is_ the affordance, so it stays (at 0ms). A card sliding, lifting, scaling
> or staggering carries position, so it is removed entirely.

Concretely, under reduced motion:

| Kept                                                                                | Removed / replaced                                                                                  |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Hover and active colour changes, instantly                                          | Card elevation change on hover — replaced by border-colour change alone                             |
| Focus ring, instantly                                                               | Image cross-fade — show the first image only                                                        |
| Opacity-only fade for content replacing a skeleton                                  | Skeleton **shimmer** — replaced by a static `--app-surface-muted` fill with the same box dimensions |
| The skeleton's box dimensions (this is the _point_ of a skeleton — no layout shift) | Drawer/modal slide — replaced by an instant appearance, with the scrim fading over 0ms              |
| `aria-busy` / `role="status"` announcements                                         | Accordion height animation — replaced by instant expand/collapse                                    |

Test procedure: run the app with `prefers-reduced-motion: reduce` forced in DevTools, browse the
vendor grid, apply three filters, open the mobile filter sheet, and open a vendor profile. Nothing
may move between two states; the loading states must still communicate loading; and `layout shift`
in the Performance panel must stay at zero through the skeleton→content swap.

---

## 8. The dense-list vs marketing-page tension

This is the hardest thing to get right, because both instincts are correct on different surfaces. The
rule that resolves it:

> **Density is proportional to comparison load** — the number of _comparable_ items a user must hold
> in view to make one decision.
>
> - **6 or more comparable items in one viewport → dense.** Tight gutters, 13px meta, borders not
>   shadows, smaller radius, 32px section gaps, no hero, no prose.
> - **1–2 items in one viewport → breathe.** Larger type, 48–80px section gaps, 14–16px radius, one
>   shadow step, generous media, room for a sentence.
> - **3–5 items → medium.** The default type scale, 20px gutters, 12px radius.

Notice what the rule is _not_ based on: it is not "public vs admin", not "home vs browse", and not
"marketing vs product". A vendor profile can be dense (a photo grid) or airy (the hero) on the same
page, and the rule tells you which is which without a judgement call.

### 8.1 Zone map

| Surface                                      | Zone        | Evidence for the call                                |
| -------------------------------------------- | ----------- | ---------------------------------------------------- |
| Home — hero                                  | **Breathe** | 1 message; density would dilute it                   |
| Home — category tiles                        | Medium      | 6–7 items, but they are _wayfinding_, not comparison |
| Browse `/vendors` + city + category grids    | **Dense**   | 12–24 items compared on price/capacity/location      |
| Filter rail                                  | **Dense**   | ~40 options; every extra pixel is a scroll           |
| Vendor profile — hero (name, image, enquiry) | **Breathe** | 1 decision: "is this the one?"                       |
| Vendor profile — gallery                     | Dense       | Many images, one job: show range                     |
| Vendor profile — packages / rates table      | **Dense**   | Direct comparison of 3–6 packages                    |
| Vendor profile — about / prose               | Medium      | Read, not scanned                                    |
| Enquiry form                                 | Medium      | One column, one task, no comparison                  |
| Account — shortlist, enquiries               | **Dense**   | Lists of comparable rows                             |
| Admin — every list, table, editor            | **Dense**   | The densest surface in the product                   |

### 8.2 The density knob

Do not fork components. Re-value four tokens per context:

```css
/* Dense: browse grids, admin, account lists */
.surface--dense {
  --app-card-padding: 12px;
  --app-section-gap: 32px;
  --app-radius-card: var(--app-radius-card-dense); /* 12px */
  --app-shadow-card: none; /* E0: border only */
}

/* Editorial: home, profile hero, enquiry */
.surface--editorial {
  --app-card-padding: 16px;
  --app-section-gap: clamp(2.5rem, 1.5rem + 3vw, 4.5rem);
  --app-radius-card: 0.875rem; /* 14px */
  --app-shadow-card: var(--elev-2); /* E2 reserved for real overlays */
}
```

`--app-card-padding` must actually be consumed by the card's padding property — the repo defines it
already, and the failure mode is a stale hard-coded `16px` in one module. Grep for it during review.

### 8.3 Three anti-patterns this rule prevents

1. **The airy browse grid.** 24px gutters, 16px body, 18px card padding, 16px radius: three tiles
   per screen instead of eight, and the user scrolls four times as far to compare the same set. This
   is the most common way a marketplace gets styled into a marketing site.
2. **The dense home page.** A hero, a search field, four sections of tiles and a footer stat block
   all at 13px with 20px gaps. It reads as an admin dashboard with a photograph in it, and the user
   has no idea where to start.
3. **The dense enquiry form.** 13px labels, 32px inputs, 8px gaps — it looks efficient and it
   measurably reduces completion, because a form is a _reading and typing_ surface, not a scanning
   one.

---

## 9. What NOT to copy

The most valuable half of this research. Each item below is a pattern these three sites genuinely use
and that would be actively wrong here, with the reason.

### 9.1 Cart and checkout affordances

**Wrong because there is no transaction.** No `Add to cart`, no `Buy now`, no cart icon, no cart
badge, no checkout step indicator, no quantity stepper, no "proceed to payment". The conversion event
is an **enquiry**, and the only two actions on a vendor are **Enquire** and **Shortlist**. A cart icon
in the header sets an expectation the product cannot fulfil, and the abandonment that follows is
worse than never showing it.

Also excluded: **order-tracking UI patterns.** The enquiry status tracker is not a shipment tracker.
Do not render a 4-step progress bar with truck icons; a lead has three outcome states and two of them
are terminal.

### 9.2 Urgency, scarcity and manufactured pressure

Never ship, in any form:

- Countdown timers, "Offer ends in", "Book within 24h".
- `Only 2 dates left`, `Only 3 slots`, `Selling fast` — a wedding vendor's calendar is not inventory,
  and the platform does not know their real availability.
- `12 people are viewing this`, `5 enquiries in the last hour`, `Trending now` — unless computed from
  real events, and even then it is pressure rather than information. **Do not compute it.**
- Pulsing dots, flashing badges, red exclamation marks on a tile.
- Artificial deadline copy in the enquiry flow ("Book a call today to lock this rate"). Cross-vendor
  rate-holding is a lie the platform cannot honour.

The reason is not only ethics: a wedding is a high-consideration, months-long decision. Manufactured
urgency does not accelerate it; it makes the platform look like a discount aggregator and pushes
couples to the vendor's own site.

### 9.3 Star ratings and review UI

No star glyphs, no rating chip, no review count, no "4.6 ★ (218)" and no empty-star placeholder.
Fabricating ratings is forbidden by the product rules, and §2.4 gives the substitute. A half-built
rating UI is the worst outcome: it promises verification the platform has not done, and it makes
every _real_ signal on the page — the verification, the response rate — look equally made-up.

If reviews ever ship, they ship as **attributed, verifiable, moderated text** with a reviewer name
and date, or not at all. And even then, they do not get the green chip, because the green chip is a
numeric aggregate and the platform will not have one.

### 9.4 Fake price anchoring

No struck-through rates, no `MRP ₹X`, no `40% OFF`, no `Save ₹X`, no "was/now". A service has no
list price — the strikethrough would be invented, and inventing it is the single most legally exposed
pattern on this list. Show one real number, or show the designed "Price on request" state (§2.3).

### 9.5 Ad and sponsored-tile clutter

Amazon's search results are heavily interleaved with sponsored placements. **[observed]** Do not
copy it. Concretely:

- No sponsored tile in a grid **unless** the tile carries a visible `Sponsored` label in the same
  size and weight class as the card's meta text. A footnote, a tooltip, or a faint `Ad` glyph is not
  a label.
- No third-party ad slots, no affiliate banners, no "also bought from" rails, no promo carousel
  between the filter bar and the first row of results — that space is above the fold and belongs to
  the first three listings.
- No cross-category "you might also like" rail _inside_ the results grid. It belongs below the grid
  and it must be explicitly labelled as suggestions.

The reasoning: on Amazon the ads are digestible because the user already knows the domain and the
price is the anchor. Here, the anchor is weak by construction (§2), so an unlabelled sponsored tile
does not just take a slot — it corrupts the only comparison the page is offering.

### 9.6 Amazon's information overload on the card

Amazon tiles carry 6–9 text rows including delivery date, offers, seller name, Prime status and two
price figures. **[observed]** It works because Amazon shoppers are repeat users with a mental model
of the schema. Live Envt's user arrives once, for one wedding, with no schema. Copying the row count
produces a card that is dense but not scannable. §1.5 caps the card at **two meta rows and one
anchor** for this reason.

### 9.7 Programme badges without a programme

Do not copy `Prime`, `Assured`, `Plus`, `Insider`. Each of those is backed by a real, published
service commitment with SLAs. A `Live Envt Assured` badge with nothing behind it is exactly the
fabricated claim §6.2 forbids. `Verified` is available only because a `Verification` record exists.

### 9.8 Other specific exclusions

| Pattern                              | Why not here                                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wishlist "heart" filled red/orange   | It is a _shortlist_, not a purchase save. Use the app's icon in `--app-ink` and the primary ramp for the active state — not red, which is the destructive tone. |
| Size / colour swatches               | There are no SKUs. Package selectors belong on the profile.                                                                                                     |
| "Recently viewed" rail on every page | Useful on Amazon, clutter here; if shipped, cap it at one rail, below the results.                                                                              |
| Sticky "Add to cart" bar on mobile   | Replace with a sticky **Enquire** bar, and only on the vendor profile, not on the browse grid.                                                                  |
| Infinite scroll with no URL state    | Every filter, sort and page must be in the query string so a couple can share a link and the back button works.                                                 |
| Dark-pattern filter reset            | `Clear all` clears what is visible and says so ("Clear 4 filters"); it never silently drops a hidden filter.                                                    |
| Autoplay video in a grid tile        | Bandwidth and jank on Indian mobile networks. Play on user action only.                                                                                         |
| Greyed-out "Sold out" tiles          | There is no sold-out state. Only `Unpublished`/`Archived`, which never appear on public surfaces at all.                                                        |

---

## 10. Implementation checklist

Before a component ships, all of these must be true:

- [ ] The card reserves fixed heights for its 2-line title and its 2 meta rows, so anchors align
      across the grid.
- [ ] The anchor slot renders the first available rung of the ladder (§2.2) and **never** renders
      `₹0`, a blank, `N/A` or `—`.
- [ ] Every number in a column or an anchor row has `font-variant-numeric: tabular-nums`.
- [ ] No star glyphs, rating chips, review counts, countdowns, struck-through prices or scarcity copy
      anywhere in the component tree.
- [ ] At most one primary-filled button per card and per page section.
- [ ] No status badge uses `--app-primary`.
- [ ] Every badge is traceable to a record that a support engineer can retrieve.
- [ ] Elevation never exceeds E1 on a card in a grid; E0 for the resting state.
- [ ] Radii come from the five-token set, and inner radius = outer − padding.
- [ ] Colours come from roles, not literals. `grep -rn '#[0-9a-fA-F]\{3,8\}' src/components src/app`
      returns only `src/theme/tokens.ts`.
- [ ] Focus ring is `2px solid var(--app-focus-ring)` with a `2px` offset, and appears instantly.
- [ ] All durations and easings come from the §7.2 token set; exits are shorter than enters.
- [ ] Under `prefers-reduced-motion: reduce`, no element changes position between two states, and
      the skeleton→content swap produces zero cumulative layout shift.
- [ ] Both themes verified by measured contrast ratio, not by eye.
- [ ] Keyboard: the card is one link (or one composite with a single tab stop), the shortlist toggle
      is reachable, and the filter chip remove control has the accessible name `Remove filter: <label>`.
