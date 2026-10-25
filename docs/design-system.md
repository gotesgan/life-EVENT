# Live Envt — Design System

Status: **implemented** · Last updated: 2026-10-15 · Applies to the public discovery site, the auth
and enquiry surfaces, and the admin panel.

This document describes what is actually in the repository, not an aspiration. Every value below was
read back out of the compiled CSS or measured from the shipped token objects; the colour and contrast
figures in §3 were re-measured against the current tokens on 2026-10-15. Anything not built is listed
under [Not implemented](#not-implemented).

Source of truth:

| Concern                                                    | File                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Palette tuples                                             | `src/theme/tokens.ts`                                                     |
| Semantic colour tokens (per scheme)                        | `src/theme/tokens.ts` → emitted by `src/theme/css-variables-resolver.ts`  |
| Radius, elevation and motion tokens                        | `src/theme/tokens.ts` (`sharedTokens`)                                    |
| Typography tokens and density contexts                     | `src/app/globals.css` (`:root`, `.surface--dense`, `.surface--editorial`) |
| Mantine theme (scale, radius, shadows, component defaults) | `src/theme/theme.ts`                                                      |
| Colour-scheme persistence                                  | `src/theme/color-scheme.ts`, `src/theme/color-scheme-manager.ts`          |
| Provider boundary                                          | `src/theme/app-providers.tsx`                                             |
| Reusable primitives                                        | `src/components/ui/**`                                                    |
| PostCSS pipeline                                           | `postcss.config.cjs`                                                      |

---

## 1. Visual direction

The product is a lead-generation discovery platform for Indian wedding and event vendors. Its visual
identity is a **marketplace** identity, not an editorial one. The structural references are Amazon,
Flipkart and Myntra — their _structure_, never their branding. `docs/marketplace-styling-guide.md`
derives the rules from those sites, marks how confident each claim about them is, and is the
companion to this file: it states what the implementation _should_ do, this file states what is
_actually in the repository_. The direction in one sentence: a neutral wall, one dominant action
colour, colour spent on action and status rather than decoration, an airy premium default register,
and density added only where comparison load demands it.

**The four load-bearing decisions**

1. **A neutral wall.** The cool `slate` ramp (§3.1) covers ≥90% of painted area. The page is a quiet
   field, so the few coloured things on it can be found at a glance.
2. **One dominant action colour.** A deep blue (`brand`) means "this does something" everywhere:
   links, primary buttons, active navigation. Spending it on badges, headings or decorative borders
   spends the affordance itself. There is exactly one action hue in the palette.
3. **Colour on action and status, not decoration.** Amber (`accent`) carries the wedding register
   and the "featured / verified" marks; `success`, `warning` and `danger` carry state. The coverage
   budget in `src/theme/tokens.ts` — neutrals ≥90%, ink ≤9%, primary ≤4%, accent ≤1.5%, semantic
   tones ≤3% combined — is enforced by review, not by code, and is the number to design against.
4. **An airy, premium default register.** Whitespace, a real type scale and hairline borders carry
   authority; depth is one border, not a shadow (§5). Density is a property of the task, not the
   brand: a region with six or more comparable items in one viewport declares `.surface--dense`, and
   one with one or two declares `.surface--editorial`. The default is the editorial register,
   because density is the easier of the two to add back.

**Structural findings carried over from `docs/ui-reference-research.md`**

- **One landscape card ratio everywhere.** VenueLook mixes 3:2 and ~4:3 inside one grid; the
  research calls that out as a defect. `AspectImage` and `MediaPlaceholder` therefore _own_ the
  aspect ratio — a page cannot set it — and the union of allowed ratios is four values.
- **A fixed five-element card anatomy**: image → name → locality plus one differentiating attribute
  → price or a designed "price on request" state → one primary action. The listing skeleton in
  `Skeletons.tsx` encodes those exact box dimensions, so the shape is enforced at build time by the
  layout shift it would otherwise cause.
- **Status is a first-class, filterable idea** (Eventbrite's image tags, Tagvenue's "Supervenue"),
  not a decoration. `StatusBadge` is a typed, tone-driven primitive with three emphasis levels.
- **"Price on request" is a designed state**, never a blank or a `₹0`. `PriceTag` renders it as
  muted text over a dashed rule when `formatPriceRange` returns `null`.
- **Filter state must be legible.** Weddingz has counts but no chips; Eventbrite has chips but no
  counts. `FilterChip` carries both a label and an optional count, and its remove control has the
  accessible name `Remove filter: <label>`.

**Where we deliberately diverge**

1. **Blue is the action colour, not the brand colour.** Competitors spend their brand hue across
   chrome, badges and decoration; here `brand` is reserved for things that act, and the warm
   `accent` is held to a line, a glyph or a small chip. Amazon's own reported rationale for a warm
   CTA on a neutral wall — so it does not compete with links — is the part of their system this
   palette transfers; their hexes are not.
2. **No gradients, no glows, no decorative blobs.** Authority here comes from a real type scale,
   generous whitespace, hairline borders and a shadow only for things that genuinely float (§5).
   At rest a card is a 1px border and _no_ shadow.
3. **A designed placeholder instead of a broken tile.** `MediaPlaceholder` draws one of four
   abstract motifs derived deterministically from the listing's slug. The research found
   placeholder-dominated galleries (Weddingz emitted ~29 `<img>` slots, most blank) and calls a
   gallery that looks broken worse than a smaller deliberate one.
4. **A serif accent was considered and rejected.** `docs/ui-reference-research.md` divergence #7
   recommends a display serif plus a UI sans; `docs/technology-decisions.md` §4 settles on one
   family. Hierarchy is therefore carried by size, weight, tracking and colour — four channels
   within one family. See §2.
5. **No phone number as page text, no login wall on shortlisting, no multi-step booking flow.** These
   are product rules from the research, but they shape the primitives: `EmptyState` and `ErrorState`
   always expose a single clear action, and there is no "call us" primitive to reach for.

---

## 2. One font family

**Manrope**, loaded once through `next/font/google` in `src/app/layout.tsx` as the CSS variable
`--font-manrope`, and applied to `body` in `globals.css`. Every element inherits it, including admin
tables.

Why one family:

- Manrope is a variable geometric-humanist sans with a large x-height and open apertures, so it
  holds up at 13px in a dense admin table and at 56px in a marketing display headline.
- The variable axis runs 200–800, so the full hierarchy above is reachable with one font file.
- `next/font` self-hosts it: no third-party request at runtime, no layout shift, no privacy surface.

`--font-manrope` resolves in the compiled CSS to `"Manrope", "Manrope Fallback"` — verified in the
development CSS output. The fallback is a metric-adjusted local font generated by Next, so the
swap does not move text.

The Mantine theme's `fontFamily` and `headings.fontFamily` both reference
`var(--font-manrope), ui-sans-serif, system-ui, sans-serif`, so even a Mantine component used without
a wrapper is in Manrope. This is the **only UI family** in the repository and there is no CDN
`@import`. Manrope is not the only family rendered: `--mantine-font-family-monospace` is the second
family, used deliberately for code-like and tabular text — the enquiry reference
(`src/components/enquiry/EnquiryForm.module.css` `.reference`), `pre`/`code`/`kbd`/`samp`
(`src/app/globals.css`), and admin reference/identifier cells (for example
`src/components/admin/Enquiries.module.css` and `src/app/account/account.module.css`).

---

## 3. Colour

### 3.1 Palette ramps

Seven 10-step ramps, lightest → darkest, defined once in `src/theme/tokens.ts` and handed to
`createTheme({ colors })`. No other file may contain a hex value; ESLint plus review is the
enforcement mechanism.

| Ramp      | Role                     | 0         | 1         | 2         | 3         | 4         | 5         | 6         | 7         | 8         | 9         |
| --------- | ------------------------ | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- |
| `brand`   | Action blue              | `#EEF4FF` | `#DCE8FE` | `#BBD0FC` | `#8FB2F9` | `#4E88F5` | `#3371EA` | `#1F5EDC` | `#1B4FB8` | `#174094` | `#123170` |
| `accent`  | Warm amber               | `#FEF9EF` | `#FCF0DA` | `#F8DFAF` | `#F1C878` | `#E8AE45` | `#D99A2B` | `#C0851F` | `#9A6A18` | `#744F12` | `#4E340B` |
| `slate`   | Cool neutral (the wall)  | `#FFFFFF` | `#F7F8FA` | `#EEF1F4` | `#E3E6EB` | `#C6CCD6` | `#9AA3B2` | `#6B7585` | `#4A5462` | `#2B333F` | `#14181F` |
| `success` | Success                  | `#EFFAF4` | `#D6F2E3` | `#A9E5C6` | `#6FD3A1` | `#4FBE84` | `#2FA46B` | `#1B7F4B` | `#166742` | `#145436` | `#0E3C27` |
| `warning` | Warning                  | `#FFF9EC` | `#FDF0D5` | `#F8DEA5` | `#F0C468` | `#E0A046` | `#C4842C` | `#9A5B00` | `#7C4900` | `#613900` | `#412600` |
| `danger`  | Error / destructive      | `#FEF2F2` | `#FDE0E0` | `#FAC2C3` | `#F49A9C` | `#F0736F` | `#DE4F4F` | `#C2333A` | `#9E282E` | `#7C2025` | `#54151A` |
| `dark`    | Dark surfaces, dark text | `#EEF1F5` | `#DDE2E9` | `#B9C1CC` | `#949EAC` | `#6E7887` | `#4A5462` | `#2F3742` | `#232A34` | `#171C24` | `#0F1319` |

`palette` exports exactly seven tuples — `brand`, `accent`, `slate`, `success`, `warning`, `danger`,
`dark` — and `src/theme/index.ts` re-exports them by those names. `stone`, `sage` and `clay` no
longer exist; a reference to any of them is a stale import, not an alias.

`slate` also **replaces Mantine's `gray` ramp**: `cssVariablesResolver` writes
`--mantine-color-gray-0…9` from `slate[0…9]`, so skeletons, table borders and dividers inside
Mantine components use the same neutral family as the surfaces they sit on. Verified in the emitted
variables: `--mantine-color-gray-0: #FFFFFF`, `--mantine-color-gray-9: #14181F`.

`brand` **is** the product's blue — the palette is deliberately cool, and the deep action blue on a
cool slate neutral is the whole visual identity. `StatusBadge`'s `info` tone is an explicit alias of
`brand` rather than its own hue: there is one action colour, and an informational state that must be
visually distinct from brand should use `accent` or `neutral`, or be reworded. (The comment above
`StatusTone` in `src/components/ui/StatusBadge.tsx` still says the palette "contains no blue"; that
comment is stale — see §12.)

### 3.2 Primary colour and `autoContrast`

```ts
primaryColor: 'brand'
primaryShade: { light: 6, dark: 4 }   // #1F5EDC light · #4E88F5 dark
autoContrast: true
luminanceThreshold: 0.22              // Mantine's default is 0.30
white: '#FFFFFF'
black: '#1D1917'                      // still the warm near-black, not #000
```

**The key insight: the action colour inverts between schemes.** In light the action colour is a deep
blue and takes **white** text; in dark it is a light blue and takes **dark** text. Both directions
have to be classified correctly by one number.

Mantine's `getContrastColor` classifies a fill by `luminance(fill) > theme.luminanceThreshold` and
then puts `theme.black` or `theme.white` on it. So a single threshold must sit between the luminance
of the light-scheme fill and the luminance of the dark-scheme fill. Measured relative luminances and
the resulting text contrast:

| Fill                       | Luminance | White text | `#1D1917` text | Chosen by 0.22 |
| -------------------------- | --------- | ---------- | -------------- | -------------- |
| light `brand[6]` `#1F5EDC` | 0.1346    | **5.69:1** | 3.07:1         | white          |
| light `brand[5]` `#3371EA` | 0.1845    | 4.48:1     | 3.90:1         | white          |
| dark `brand[4]` `#4E88F5`  | 0.2582    | 3.41:1     | **5.12:1**     | `#1D1917`      |
| dark `brand[3]` `#8FB2F9`  | 0.4452    | 2.12:1     | **8.23:1**     | `#1D1917`      |
| light `danger` `#C2333A`   | 0.1414    | **5.49:1** | 3.18:1         | white          |
| dark `danger` `#F0736F`    | 0.3193    | 2.84:1     | **6.14:1**     | `#1D1917`      |

**0.22 sits between 0.1346 and 0.2582**, so both action fills take the readable direction. Mantine's
default of 0.30 would put _white_ on the dark-scheme blue — measured 3.41:1, an AA failure. Among
the ten emitted tone fills (five tones × two schemes) the dark `brand` is the **only** one whose
classification changes between 0.22 and 0.30; every other fill measures either well below 0.22
(0.1414–0.1653 light) or well above 0.30 (0.3193–0.4143 dark). The threshold change is therefore
targeted rather than a global shift of the palette.

Two caveats, both measured rather than assumed:

- `brand[5]` (`#3371EA`) takes white text under this threshold at **4.48:1**, which is 0.02 below
  the 4.5:1 AA floor. It is not reachable through the theme: `primaryShade.light` is **6**, and
  `--app-brand` is `brand[6]`. A component that deliberately fills with `brand[5]` would fail AA.
- The dark-scheme value the _token layer_ promises is `--app-brand-contrast: #0B1220` (5.50:1
  against `#4E88F5`), but Mantine's `autoContrast` does not read that token — it uses `theme.black`
  `#1D1917`, which measures **5.12:1**. Both pass; a Mantine filled control and an app component
  using the token differ slightly.

**Measured filled brand button:** light **5.69:1**, dark **5.12:1** on Mantine's `autoContrast`
path, or **5.50:1** on the `--app-brand-contrast` token — all pass WCAG AA for normal text.

(A comment in `src/theme/theme.ts` gives `brand[5]` as luminance 0.121 / 6.28:1 and `brand[3]` as
0.420 / 8.66:1. Those two figures do not match the colours they name; the measured values are the
table above. The comment is not load-bearing — the threshold itself is correct — and `src/**` is out
of scope for this document's revision.)

### 3.3 Semantic tokens

Emitted by `cssVariablesResolver`, so they are scheme-correct with **no JavaScript and no hydration
risk**: `variables` lands on `:root`, `light`/`dark` land inside
`[data-mantine-color-scheme='light'|'dark']`. Values below are read from `lightSchemeTokens` and
`darkSchemeTokens` in `src/theme/tokens.ts`.

| Token                      | Light                     | Dark                        |
| -------------------------- | ------------------------- | --------------------------- |
| `--app-surface`            | `#F7F8FA`                 | `#0F1319`                   |
| `--app-surface-raised`     | `#FFFFFF`                 | `#171C24`                   |
| `--app-surface-muted`      | `#EEF1F4`                 | `#232A34`                   |
| `--app-surface-sunken`     | `#E3E6EB`                 | `#0A0D12`                   |
| `--app-surface-hover`      | `#F0F3F7`                 | `#2A323D`                   |
| `--app-border`             | `#E3E6EB`                 | `#2F3742`                   |
| `--app-border-strong`      | `#737D8D`                 | `#71808F`                   |
| `--app-text`               | `#14181F`                 | `#EEF1F5`                   |
| `--app-text-muted`         | `#454E5C`                 | `#A7B0BD`                   |
| `--app-text-subtle`        | `#5A6474`                 | `#95A0AF`                   |
| `--app-brand`              | `#1F5EDC`                 | `#4E88F5`                   |
| `--app-brand-soft`         | `rgba(31, 94, 220, 0.10)` | `rgba(78, 136, 245, 0.16)`  |
| `--app-brand-soft-hover`   | `rgba(31, 94, 220, 0.16)` | `rgba(78, 136, 245, 0.24)`  |
| `--app-brand-soft-text`    | `#15489F`                 | `#A8C6FC`                   |
| `--app-brand-contrast`     | `#FFFFFF`                 | `#0B1220`                   |
| `--app-contrast`           | `#FFFFFF`                 | `#0B1220`                   |
| `--app-accent`             | `#A85F0A`                 | `#E0A046`                   |
| `--app-accent-soft`        | `rgba(168, 95, 10, 0.12)` | `rgba(224, 160, 70, 0.18)`  |
| `--app-accent-soft-hover`  | `rgba(168, 95, 10, 0.18)` | `rgba(224, 160, 70, 0.26)`  |
| `--app-accent-soft-text`   | `#7A4405`                 | `#F0C684`                   |
| `--app-success`            | `#1B7F4B`                 | `#4FBE84`                   |
| `--app-success-soft`       | `rgba(27, 127, 75, 0.12)` | `rgba(79, 190, 132, 0.18)`  |
| `--app-success-soft-hover` | `rgba(27, 127, 75, 0.18)` | `rgba(79, 190, 132, 0.26)`  |
| `--app-success-soft-text`  | `#145436`                 | `#A9E5C6`                   |
| `--app-warning`            | `#9A5B00`                 | `#E0A046`                   |
| `--app-warning-soft`       | `rgba(154, 91, 0, 0.12)`  | `rgba(224, 160, 70, 0.18)`  |
| `--app-warning-soft-hover` | `rgba(154, 91, 0, 0.18)`  | `rgba(224, 160, 70, 0.26)`  |
| `--app-warning-soft-text`  | `#613900`                 | `#F0C684`                   |
| `--app-danger`             | `#C2333A`                 | `#F0736F`                   |
| `--app-danger-soft`        | `rgba(194, 51, 58, 0.12)` | `rgba(240, 115, 111, 0.18)` |
| `--app-danger-soft-hover`  | `rgba(194, 51, 58, 0.18)` | `rgba(240, 115, 111, 0.26)` |
| `--app-danger-soft-text`   | `#7C2025`                 | `#FAC2C3`                   |
| `--app-focus-ring`         | `#1F5EDC`                 | `#6B9CF8`                   |
| `--app-overlay`            | `rgba(17, 20, 26, 0.55)`  | `rgba(4, 6, 10, 0.72)`      |

Note that `--app-brand-contrast` and `--app-contrast` are the same value in both schemes today but
are not the same token: the first is the label colour for a brand fill, the second for any saturated
semantic fill. `--app-accent` and `--app-warning` are both amber in the dark scheme (`#E0A046`) and
differ in light (`#A85F0A` vs `#9A5B00`); they carry different meanings, so they are not merged.

Scheme-independent tokens (`sharedTokens`, emitted on `:root`). Radii, elevation and motion are
contracts, not just values — §5 is the normative description.

| Token                     | Value                                   | Meaning                             |
| ------------------------- | --------------------------------------- | ----------------------------------- |
| `--app-radius-1`          | `0.25rem` (4px)                         | the smallest step, for 1px-scale UI |
| `--app-radius-control`    | `0.5rem` (8px)                          | inputs, buttons, small controls     |
| `--app-radius-card-dense` | `0.75rem` (12px)                        | the card radius in a dense region   |
| `--app-radius-card`       | `0.875rem` (14px)                       | cards, panels, modals               |
| `--app-radius-pill`       | `999px`                                 | badges and chips **only**           |
| `--app-max-width`         | `1280px`                                | page measure                        |
| `--app-header-height`     | `4rem` (64px)                           | app chrome                          |
| `--app-sidebar-width`     | `16.5rem` (264px)                       | admin/filter rail                   |
| `--app-gutter`            | `clamp(1rem, 0.25rem + 2.5vw, 2.5rem)`  | page gutter                         |
| `--app-section-gap`       | `clamp(2.5rem, 1.5rem + 3vw, 4.5rem)`   | vertical rhythm between sections    |
| `--app-stack-gap`         | `1rem`                                  | default vertical gap inside a stack |
| `--app-card-padding`      | `clamp(1rem, 0.75rem + 0.75vw, 1.5rem)` | card interior padding               |
| `--app-grid-gap`          | `1.25rem`                               | gap inside a card grid              |

Four of those values are re-declared by the density context classes; see §5.

`--app-surface-hover` exists beyond the briefed list and is documented so it is not mistaken for
drift: it is the row/menu hover state where `--app-surface-muted` is the resting state. The
`--app-*-soft-hover` tokens are the hover state of a soft status chip. `--app-contrast` is the label
colour for a saturated fill in the current scheme — one token instead of five per-tone contrast
tokens.

### 3.4 How the dark theme was designed (not inverted)

Four deliberate decisions:

1. **Separate elevation steps.** Light mode reads _brighter is higher_: `sunken #E3E6EB` →
   `muted #EEF1F4` → `surface #F7F8FA` → `raised #FFFFFF`. Dark mode reads _lighter is higher_ on
   palette steps 9 → 8 → 7 (`surface #0F1319` → `raised #171C24` → `muted #232A34`), with one
   derived step (`sunken #0A0D12`) _below_ the canvas for recessed wells, so a sunken well is still
   visibly below the canvas rather than identical to it. The dark values are not a mechanical
   inversion of the light ones: `surface-hover`, `border-strong`, `text-muted` and `text-subtle` are
   all derived colours measured against the surfaces rather than palette entries.
2. **Desaturated brand tints for large fills.** The dark brand tint is a translucent blue
   (`rgba(78, 136, 245, 0.16)`) over the raised surface, not a solid light-blue block. The same
   override is applied to Mantine's own `--mantine-color-brand-light*`, because Mantine derives that
   by darkening shade 9 by 50%, which would be a near-black chip. (The comment in
   `css-variables-resolver.ts` justifying the override still says "which for plum is a near-black
   chip"; the mechanism is right, the noun is stale.)
3. **Raised border contrast.** The light hairline `#E3E6EB` is _darker_ than its surface; the dark
   hairline `#2F3742` is _lighter_ than its surface. Control borders go up again:
   `--app-border-strong` is `#737D8D` in light and `#71808F` in dark, and both clear 3:1 against
   every one of the five surface steps (measured 3.33–4.16:1 light, 3.20–4.81:1 dark — §3.5).
4. **Re-tuned muted text.** `--app-text-muted` and `--app-text-subtle` were measured, not guessed,
   against every surface step (see §3.5). The tightest cells are light `--app-text-subtle` on
   `--app-surface-sunken` at **4.78:1** and dark `--app-text-subtle` on `--app-surface-hover` at
   **4.89:1** — both above 4.5:1, but only by ~0.3, which is the headroom a future surface step
   would have to respect.

### 3.5 Measured contrast (WCAG 2.1, relative luminance)

Re-measured for this revision. A throwaway `npx tsx` probe imported the real `lightSchemeTokens` /
`darkSchemeTokens` objects, composited every `rgba()` tint over its base surface, and applied the
WCAG 2.1 relative-luminance formula, `(L1 + 0.05) / (L2 + 0.05)`. The probe was deleted after the
numbers were recorded; a second, independently written implementation reproduced every value below.

**Coverage.** 80 acceptance pairs, 40 per scheme:

- 3 text tokens (`--app-text`, `-muted`, `-subtle`) × 5 surfaces = 15;
- `--app-contrast` (and `--app-brand-contrast` on the brand fill) on each of the 5 saturated fills =
  5;
- each of the 5 semantic tones as text on `--app-surface` = 5;
- each of the 5 `-soft-text` tokens on its `-soft` fill, composited over `--app-surface-raised` = 5;
- `--app-border-strong` and `--app-focus-ring` on each of the 5 surfaces = 10.

Thresholds are WCAG 1.4.3 (4.5:1 for normal text) and WCAG 1.4.11 (3:1 for non-text contrast).

**Result: light 40/40 passing · dark 40/40 passing · 80 passing, 0 failing.** Every acceptance pair
clears its threshold. This supersedes the smaller "four pairs" summary in earlier revisions of this
file.

**Text on every surface step**

| Token               | Surface                | Light   | Dark    |
| ------------------- | ---------------------- | ------- | ------- |
| `--app-text`        | `--app-surface`        | 16.75:1 | 16.44:1 |
| `--app-text`        | `--app-surface-raised` | 17.79:1 | 15.09:1 |
| `--app-text`        | `--app-surface-muted`  | 15.70:1 | 12.76:1 |
| `--app-text`        | `--app-surface-sunken` | 14.22:1 | 17.18:1 |
| `--app-text`        | `--app-surface-hover`  | 15.99:1 | 11.43:1 |
| `--app-text-muted`  | `--app-surface`        | 7.91:1  | 8.50:1  |
| `--app-text-muted`  | `--app-surface-raised` | 8.41:1  | 7.81:1  |
| `--app-text-muted`  | `--app-surface-muted`  | 7.42:1  | 6.60:1  |
| `--app-text-muted`  | `--app-surface-sunken` | 6.72:1  | 8.88:1  |
| `--app-text-muted`  | `--app-surface-hover`  | 7.56:1  | 5.91:1  |
| `--app-text-subtle` | `--app-surface`        | 5.63:1  | 7.03:1  |
| `--app-text-subtle` | `--app-surface-raised` | 5.98:1  | 6.45:1  |
| `--app-text-subtle` | `--app-surface-muted`  | 5.28:1  | 5.46:1  |
| `--app-text-subtle` | `--app-surface-sunken` | 4.78:1  | 7.34:1  |
| `--app-text-subtle` | `--app-surface-hover`  | 5.38:1  | 4.89:1  |

All 15 cells clear 4.5:1 in both schemes. The acceptance criterion is that muted and subtle text are
legible on every surface the system can produce, so no future component can accidentally select a
failing pair.

**Solid status fills** (`--app-contrast` on the tone)

| Tone      | Light  | Dark   |
| --------- | ------ | ------ |
| `brand`   | 5.69:1 | 5.50:1 |
| `accent`  | 4.88:1 | 8.28:1 |
| `success` | 5.02:1 | 8.05:1 |
| `warning` | 5.43:1 | 8.28:1 |
| `danger`  | 5.49:1 | 6.59:1 |

The label colour is `--app-contrast` (and `--app-brand-contrast` on the brand fill): white on every
light-scheme fill, `#0B1220` on every dark-scheme fill. The narrowest margin in the whole acceptance
set is light `--app-accent` as text on the canvas at **4.59:1** — 0.09 above the floor. The lowest
absolute ratio is light `--app-focus-ring` on `--app-surface-sunken` at **4.55:1**, measured against
the 3:1 non-text threshold.

**Semantic tone as text on the canvas** (`--app-<tone>` on `--app-surface`)

| Tone      | Light  | Dark   |
| --------- | ------ | ------ |
| `brand`   | 5.35:1 | 5.47:1 |
| `accent`  | 4.59:1 | 8.24:1 |
| `success` | 4.72:1 | 8.01:1 |
| `warning` | 5.11:1 | 8.24:1 |
| `danger`  | 5.16:1 | 6.55:1 |

**Soft status fills** (`--app-<tone>-soft-text` on the `-soft` tint composited over
`--app-surface-raised`; composited fill in parentheses)

| Tone      | Light (fill)       | Dark (fill)        |
| --------- | ------------------ | ------------------ |
| `brand`   | 7.41:1 (`#E9EFFC`) | 7.98:1 (`#202D45`) |
| `accent`  | 6.77:1 (`#F5ECE2`) | 7.67:1 (`#3B342A`) |
| `success` | 7.63:1 (`#E4F0E9`) | 8.65:1 (`#213935`) |
| `warning` | 8.49:1 (`#F3EBE0`) | 7.67:1 (`#3B342A`) |
| `danger`  | 8.41:1 (`#F8E7E7`) | 8.42:1 (`#3E2C32`) |

Informational, not part of the acceptance count: `--app-text` on those same composited tints
measures 14.89–15.44:1 light and 10.84–12.17:1 dark, which is why `Surface` tinted panels can carry
body text directly rather than only a soft-text label.

**Borders and focus**

| Token                 | Against                | Light  | Dark   |
| --------------------- | ---------------------- | ------ | ------ |
| `--app-border`        | `--app-surface`        | 1.18:1 | 1.55:1 |
| `--app-border-strong` | `--app-surface`        | 3.92:1 | 4.60:1 |
| `--app-border-strong` | `--app-surface-raised` | 4.16:1 | 4.22:1 |
| `--app-border-strong` | `--app-surface-muted`  | 3.67:1 | 3.57:1 |
| `--app-border-strong` | `--app-surface-sunken` | 3.33:1 | 4.81:1 |
| `--app-border-strong` | `--app-surface-hover`  | 3.74:1 | 3.20:1 |
| `--app-focus-ring`    | `--app-surface`        | 5.35:1 | 6.86:1 |
| `--app-focus-ring`    | `--app-surface-raised` | 5.69:1 | 6.30:1 |
| `--app-focus-ring`    | `--app-surface-muted`  | 5.02:1 | 5.33:1 |
| `--app-focus-ring`    | `--app-surface-sunken` | 4.55:1 | 7.17:1 |
| `--app-focus-ring`    | `--app-surface-hover`  | 5.11:1 | 4.77:1 |

`--app-border-strong` clears 3:1 on all five surfaces in both schemes; `--app-focus-ring` clears
3:1 comfortably, and in fact clears 4.5:1 on every surface, so a ring is legible even against a
text-adjacent background.

`--app-border` is deliberately **below** 3:1. It is a decorative hairline — the line between two
rows, or the edge of a card — where WCAG 1.4.11 does not apply. Anything that is a _control_
boundary (input outline, default-variant button, an outline badge) uses `--app-border-strong`,
which clears 3:1 on every surface in both schemes. This is the one place where two tokens exist for
what looks like the same job, and the split is the point.

---

## 4. Typography

Implemented as matched `--text-<name>-size` / `-weight` / `-leading` (plus `-tracking` on the
display sizes) triples on `:root` in `globals.css`.

**Why triples rather than one shorthand value.** A CSS `font:` shorthand cannot be partially
applied — `font-size: var(--text-h1)` is not valid CSS — and the shorthand also resets
`font-variant`, `font-stretch` and friends. A matched triple composes with any other property.

| Token                 | Size                                           | Weight | Line height | Tracking   |
| --------------------- | ---------------------------------------------- | ------ | ----------- | ---------- |
| `--text-display-*`    | `clamp(2.5rem, 1.6rem + 3.6vw, 4rem)`          | 800    | 1.05        | `-0.03em`  |
| `--text-h1-*`         | `clamp(2rem, 1.5rem + 2vw, 3rem)`              | 700    | 1.08        | `-0.025em` |
| `--text-h2-*`         | `clamp(1.5rem, 1.3rem + 0.9vw, 2.125rem)`      | 700    | 1.15        | `-0.02em`  |
| `--text-h3-*`         | `clamp(1.1875rem, 1.1rem + 0.35vw, 1.4375rem)` | 700    | 1.22        | `-0.015em` |
| `--text-card-title-*` | `1.0625rem` (17px)                             | 700    | 1.3         | `-0.01em`  |
| `--text-anchor-*`     | `1.125rem` (18px)                              | 700    | 1.2         | `-0.01em`  |
| `--text-body-*`       | `0.9375rem` (15px)                             | 400    | 1.6         | `0`        |
| `--text-secondary-*`  | `0.875rem` (14px)                              | 400    | 1.55        | —          |
| `--text-label-*`      | `0.8125rem` (13px)                             | 600    | 1.3         | —          |
| `--text-button-*`     | `0.875rem` (14px)                              | 600    | 1           | —          |
| `--text-caption-*`    | `0.75rem` (12px)                               | 500    | 1.4         | —          |
| `--text-error-*`      | `0.75rem` (12px)                               | 600    | 1.4         | —          |
| `--text-dense-*`      | `0.8125rem` (13px)                             | 500    | 1.35        | —          |

`--text-dense` is the admin-table size. It is 13px rather than 12px, is paired with `tabular-nums`
so currency columns align, and is never used for prose.

`--text-anchor` is **the scan anchor**. A marketplace grid sorts because one comparable, ordinal
value sits in the same slot on every tile; Amazon and Flipkart use price and rating, whereas this
product has neither (fabricated ratings are forbidden and rates are often "on request"), so the slot
is filled by a deterministic ladder (`docs/marketplace-styling-guide.md` §2.2). The step is larger
and heavier than a card title, tabular so digits align down a column, and never the loudest thing on
the page. It is defined in `globals.css`. The listing card's price slot now renders through `PriceTag`
(the amount is the card-title step at weight 700, with the unit on its own line in narrow columns),
so the anchor slot is adopted rather than aspirational.

**Five weights, not nine.** The scale ships exactly five weights: **400** reading text, **500**
supporting text (captions, metadata, dense table cells), **600** labels and controls, **700**
headings and the scan anchor, **800** the hero display. The previous scale used nine
(450/500/550/600/650/700/720/750/800); nine values inside a 400-wide axis are indistinguishable at
text sizes, so the result read as inconsistency rather than emphasis — a label at 550 and one at 650
looked identical and neither looked chosen. New type picks a rung; it never invents a weight between
two rungs.

**Hierarchy is four-channel, not just size.** A caption is smaller _and_ lighter (500) _and_ muted
(`--app-text-subtle`); a card title is larger _and_ heavier (700) _and_ tighter (-0.01em) _and_ full
contrast. Weight comes from Manrope's variable axis, so all five are real weights, not faux-bold.

**One family everywhere on the public site.** Manrope is the only typeface; reference codes are set
in Manrope with `tabular-nums` and letter-spacing rather than a second monospace family. Monospace
remains only in the admin back office, where it marks machine data (ids, audit payloads).

The Mantine theme mirrors these into `headings.sizes` by reference
(`h1.fontSize: 'var(--text-h1-size)'`), so Mantine's `Title` renders at the same size as a plain
`<h1>`. Verified in the emitted variables: `--mantine-h1-font-size: var(--text-h1-size)`.

Global element rules in `globals.css`: headings inherit the scale, `text-wrap: balance` on
`h1…h6`, `text-wrap: pretty` on `p`, and zeroed default margins (spacing belongs to layout
primitives).

---

## 5. Spacing, radius, elevation and motion

### 5.1 Spacing

Spacing keeps Mantine's `xs…xl` names, re-valued in `src/theme/theme.ts`:

| Token                  | Value     |
| ---------------------- | --------- |
| `--mantine-spacing-xs` | `0.5rem`  |
| `--mantine-spacing-sm` | `0.75rem` |
| `--mantine-spacing-md` | `1rem`    |
| `--mantine-spacing-lg` | `1.5rem`  |
| `--mantine-spacing-xl` | `2.25rem` |

Above that, five component-level rhythm tokens carry the page: `--app-gutter` (fluid page gutter),
`--app-section-gap` (vertical distance between sections), `--app-stack-gap` (default gap in a
vertical stack), `--app-card-padding` (card interior) and `--app-grid-gap` (gap inside a card grid).
Components use these instead of inventing new numbers.

**Density is a context, not a per-page tweak.** `globals.css` declares two class-based contexts that
re-value four of those five tokens (and, for dense, the card radius) in one place:

| Context               | `--app-card-padding`                    | `--app-section-gap`                   | `--app-stack-gap` | `--app-grid-gap` | card radius                           |
| --------------------- | --------------------------------------- | ------------------------------------- | ----------------- | ---------------- | ------------------------------------- |
| default (`:root`)     | `clamp(1rem, 0.75rem + 0.75vw, 1.5rem)` | `clamp(2.5rem, 1.5rem + 3vw, 4.5rem)` | `1rem`            | `1.25rem`        | `--app-radius-card` (14px)            |
| `.surface--dense`     | `0.75rem`                               | `2rem`                                | `0.75rem`         | `1rem`           | `--app-radius-card-dense` (12px)      |
| `.surface--editorial` | `clamp(1.25rem, 1rem + 1vw, 2rem)`      | `clamp(3.5rem, 2rem + 5vw, 6rem)`     | `1.25rem`         | `1.5rem`         | `--app-radius-card` (14px, untouched) |

Both classes are additive to `:root`, which is why `globals.css` declares them after it. The
decision rule, stated in the stylesheet: count the comparable items in one viewport. **Six or more →
`.surface--dense`; one or two → `.surface--editorial`.** No class means the default editorial
register, because a page that breathes reads as more considered than one that does not, and density
is the easier of the two to add back. Density is deliberately a class rather than a prop or a
component fork, so no component needs to know which register it is in.

### 5.2 Radius

Five steps, in `sharedTokens`. Radius cost scales with how many times it is drawn: 24 tiles at a
generous 16px reads as a field of lozenges and the grid edges stop registering, so dense browse
surfaces step _down_, not up.

| Token                     | Value      | Applies to                                    |
| ------------------------- | ---------- | --------------------------------------------- |
| `--app-radius-1`          | `0.25rem`  | the smallest step, for 1px-scale UI           |
| `--app-radius-control`    | `0.5rem`   | inputs, buttons, action icons, small controls |
| `--app-radius-card-dense` | `0.75rem`  | cards inside `.surface--dense`                |
| `--app-radius-card`       | `0.875rem` | cards, panels, modals, drawers, media wells   |
| `--app-radius-pill`       | `999px`    | badges and chips **only**                     |

Mantine's `radius` scale is set so `xs` = 4px, `sm` = 6px, `md` = 8px (the control step), `lg` =
14px (the card step) and `xl` = 20px, with `defaultRadius: 'md'`. Nothing is pill-shaped that is not
a status chip or a filter chip. The `--app-radius-*` tokens are the contract; the Mantine scale is
the fallback for a Mantine component used without a wrapper.

### 5.3 Elevation

Four levels. Elevation is bought with a shadow **only** when something genuinely floats above the
page; the resting state is a border, not a shadow.

| Level | Token                                        | Light                                                                | Dark                                                          | Used for                   |
| ----- | -------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| E0    | `1px solid var(--app-border)`, **no shadow** | —                                                                    | —                                                             | default resting card/panel |
| E1    | `--app-shadow-raised`                        | `0 1px 2px rgba(17,20,26,.06), 0 2px 8px -3px rgba(17,20,26,.10)`    | `0 1px 2px rgba(0,0,0,.55), 0 2px 10px -3px rgba(0,0,0,.62)`  | hover lift, popover        |
| E2    | `--app-shadow-overlay`                       | `0 1px 2px rgba(17,20,26,.05), 0 10px 28px -14px rgba(17,20,26,.16)` | `0 1px 2px rgba(0,0,0,.5), 0 12px 32px -16px rgba(0,0,0,.72)` | modal, drawer              |
| E3    | `--app-shadow-top`                           | `0 28px 72px -18px rgba(17,20,26,.30)`                               | `0 32px 80px -20px rgba(0,0,0,.80)`                           | lightbox / top layer       |

**E0 is the default for a resting card**: a 1px `--app-border` and no shadow. Shadow is reserved for
things that float, so 95% of the app paints none. In light mode a white card separates from the
cool off-white wall without a shadow; in dark mode the card is lifted by being a _lighter_ step than
the canvas (see §3.4), not by a shadow.

Two compatibility tokens exist and are exact aliases, recorded so they are not mistaken for extra
levels: `--app-shadow-card` equals `--app-shadow-overlay` (E2) in both schemes, and
`--app-shadow-overlay-strong` equals `--app-shadow-top` (E3). `Surface`'s `elevated` prop and
Mantine's `shadows.md`/`xl` currently reference those two aliases. Dark alphas are much higher than
light ones on purpose: a 5%-black shadow on a near-black canvas is invisible.

Two source inconsistencies are visible from here and are **not** fixed by this document:

- At the time of writing, `ListingCard` and `ListingCardSkeleton` still paint `--app-shadow-card` on
  a _resting_ card, which contradicts E0. Migrating them is part of the in-flight component restyle;
  this section states the contract, not a completed migration.
- Mantine's `shadows.xs`, `sm` and `lg` in `src/theme/theme.ts` still use the warm near-black
  `rgba(29, 25, 23, …)` from the previous palette, while `md` and `xl` reference the app tokens. A
  Mantine component that asks for `shadow="lg"` therefore gets a warm shadow from the old world.

### 5.4 Motion

Six durations and three easings, in `sharedTokens`. A dismissal that takes as long as an arrival
feels stuck, so **exit is always shorter than enter**, and nothing in the product exceeds 280ms.

| Token                    | Value   | Contract                                                 |
| ------------------------ | ------- | -------------------------------------------------------- |
| `--app-duration-instant` | `0ms`   | the reduced-motion end state — change with no transition |
| `--app-duration-micro`   | `90ms`  | colour/opacity on a small control                        |
| `--app-duration-fast`    | `140ms` | enter for a small overlay; the exit duration             |
| `--app-duration-base`    | `200ms` | the default enter                                        |
| `--app-duration-slow`    | `280ms` | the largest move; the ceiling                            |
| `--app-duration-exit`    | `140ms` | every dismissal (**shorter than `base`**)                |

| Token               | Value                          | Contract                            |
| ------------------- | ------------------------------ | ----------------------------------- |
| `--app-ease-out`    | `cubic-bezier(0.2, 0, 0, 1)`   | entering — decelerate to rest       |
| `--app-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | moving between two on-screen states |
| `--app-ease-in`     | `cubic-bezier(0.4, 0, 1, 1)`   | leaving — accelerate away           |

**The reduced-motion policy: motion carrying state survives, motion carrying position goes.**
`globals.css` collapses `animation-duration` / `transition-duration` to `0.01ms` and forces
`scroll-behavior: auto` inside `@media (prefers-reduced-motion: reduce)` (the one justified
`!important`, because a third-party component's transition must not re-animate the page). The
consequence is that a **state** change — a colour, an opacity, which variant is shown — still
communicates its final state, instantly; a **positional** change — a translate, a scale, a slide-in,
a smooth scroll — is removed entirely, because a movement that cannot be shown should not happen at
all. Mantine's `respectReducedMotion: true` disables its own transition wrappers to match.

No component consumes the motion tokens yet: the only transition among the primitives is
`FilterChip`'s inline `border-color 120ms ease, background-color 120ms ease`, which should migrate
to `--app-duration-micro` / `--app-duration-fast` and `--app-ease-out` (or `-in-out`). The tokens are
available and normative; adoption is part of the in-flight component restyle.

**Breakpoints** are Mantine's defaults, in `em` (which keeps them zoom-correct):

| Name | Value  |
| ---- | ------ |
| `xs` | `36em` |
| `sm` | `48em` |
| `md` | `62em` |
| `lg` | `75em` |
| `xl` | `88em` |

The same five values are mirrored into `postcss-simple-vars` in `postcss.config.cjs` so CSS Modules
can write `@mixin smaller-than $mantine-breakpoint-md`. The breakpoints live in two places by
necessity (TypeScript and PostCSS); they must be changed together. The values are Mantine 9.7.2's
`DEFAULT_THEME.breakpoints`, verified against `node_modules/@mantine/core`.

---

## 6. Focus and accessibility states

- **Focus ring.** One ring for everything interactive: `outline: 2px solid var(--app-focus-ring)`
  with `outline-offset: 2px`. It is the action blue in light (`#1F5EDC`) and a lighter blue in dark
  (`#6B9CF8`). Measured against all five surface steps: **4.55–5.69:1** light, **4.77–7.17:1** dark
  (§3.5), so it clears both the 3:1 non-text requirement and 4.5:1 as text. In light the ring colour
  is **identical** to the brand fill (1.00:1 against it), and in dark it is only 1.26:1 against the
  fill — the ring therefore works because `outline-offset: 2px` places it over the surrounding
  surface, where it has 4.55:1 or better, not because it contrasts with the button. A focused blue
  button reads as focused by the 2px gap, not by ring-versus-fill contrast. The global rule also
  restates Mantine's own focus classes at equal specificity but later in the cascade, so Mantine
  components get the app ring instead of `--mantine-primary-color-filled`. Verified present in the
  compiled CSS. (The comment above that rule in `globals.css` still says "brass"; the declaration
  below it uses the token, so only the comment is stale.)
- **Reduced motion.** `globals.css` neutralises `animation-duration`, `animation-iteration-count`,
  `transition-duration` and `scroll-behavior` inside `@media (prefers-reduced-motion: reduce)`, and
  Mantine's `respectReducedMotion: true` disables its transition wrappers. The policy is §5.4:
  motion carrying **state** survives (the state change still happens, instantly); motion carrying
  **position** goes.
- **Native UI.** `color-scheme: light` on `html`, switched to `dark` by
  `html[data-mantine-color-scheme='dark']`, so scrollbars and native controls follow the app scheme.
- **Forced colours.** No `forced-colors` media query is implemented; components use `currentColor`
  and semantic tokens, which is the safest default, but this has not been tested in Windows High
  Contrast and is listed under [Not implemented](#not-implemented).
- **Non-colour signals.** `StatusBadge` accepts a `dot`; `ErrorState` always renders `role="alert"`;
  skeletons and decorative motifs are `aria-hidden` while their containers carry `role="status"` +
  `aria-busy`.
- **Overflow.** `html`/`body` use `overflow-x: clip` (not `hidden`, so `position: sticky` keeps
  working), and `img/svg/video/canvas` are capped at `max-width: 100%`. `DataTable` additionally
  wraps its table in Mantine's `TableScrollContainer`, so no admin table can widen the page.
- **Landmarks and headings.** `PageHeader` owns the single `<h1>`; `SectionHeading` defaults to
  `h2` and can be demoted to `h3`; breadcrumbs are a `<nav aria-label="Breadcrumb">` around an
  ordered list. `EmptyState`'s title defaults to a `<p>` precisely so it cannot inject a stray
  heading level into the outline.

---

## 7. Component inventory

All primitives live in `src/components/ui` and are exported from its `index.ts`. They are **thin
composition wrappers**: no business logic, no data fetching, no formatting that already exists in
`src/lib/format.ts`.

| Component          | Purpose                                                                                                       | API surface                                                                                                                                                                              | Client? |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `Container`        | Page-width wrapper                                                                                            | `size: default \| wide \| prose`, `bleed`, `as`, `id`                                                                                                                                    | no      |
| `PageHeader`       | Page title block, owns the `<h1>`                                                                             | `title`, `description`, `eyebrow`, `actions`, `breadcrumbs[]`                                                                                                                            | no      |
| `SectionHeading`   | Section title                                                                                                 | `title`, `eyebrow`, `description`, `action` (view-all slot), `level: 2 \| 3`                                                                                                             | no      |
| `PriceTag`         | Renders `formatPriceRange`                                                                                    | `priceMin`, `priceMax`, `priceUnit`, `size: sm \| md \| lg`, `onRequestLabel`                                                                                                            | no      |
| `CapacityTag`      | Renders `formatCapacityRange`                                                                                 | `capacityMin`, `capacityMax`, `size: sm \| md`, `withIcon`                                                                                                                               | no      |
| `StatusBadge`      | Typed status pill                                                                                             | `tone: neutral \| brand \| accent \| success \| warning \| danger \| info`, `variant: solid \| soft \| outline`, `size`, `dot`                                                           | no      |
| `FilterChip`       | Removable applied-filter chip                                                                                 | `label`, `count`, `onRemove`, `disabled`                                                                                                                                                 | **yes** |
| `EmptyState`       | No results / nothing yet                                                                                      | `icon`, `title`, `description`, `primaryAction`, `secondaryAction`, `size`, `titleAs`                                                                                                    | no      |
| `ErrorState`       | Failure surface                                                                                               | `title`, `description`, `onRetry`, `retryLabel`, `secondaryAction`                                                                                                                       | **yes** |
| `Skeletons`        | `ListingCardSkeleton`, `ListingGridSkeleton`, `ListingDetailSkeleton`, `TableSkeleton`, `FilterPanelSkeleton` | `count`, `rows`, `columns`, `groups`, `optionsPerGroup`                                                                                                                                  | no      |
| `BrandMark`        | Wordmark + arch tile                                                                                          | `size: sm \| md \| lg`, `showWordmark`                                                                                                                                                   | no      |
| `ThemeToggle`      | Light/dark switch                                                                                             | `size: sm \| md \| lg`                                                                                                                                                                   | **yes** |
| `Surface`          | Panel primitive                                                                                               | `tone: base \| raised \| muted \| sunken \| brand \| accent \| success \| warning \| danger`, `padding: none \| sm \| md \| lg`, `radius: control \| card`, `bordered`, `elevated`, `as` | no      |
| `MediaPlaceholder` | Designed no-photo motif                                                                                       | `seed` (required), `ratio: 3/2 \| 4/3 \| 1/1 \| 16/9`, `label`                                                                                                                           | no      |
| `AspectImage`      | Fixed-ratio image with fallback                                                                               | `src` (nullable), `alt`, `ratio`, `sizes`, `preload`, `seed`                                                                                                                             | no      |
| `DataTable`        | Generic admin table                                                                                           | `columns[{ key, header, width?, align?, render(row) }]`, `rows`, `getRowKey`, `emptyState`, `isLoading`, `caption`, `skeletonRowCount`, `minWidth`, `stickyHeader`                       | no      |
| `cx`               | Class joiner                                                                                                  | —                                                                                                                                                                                        | no      |

Notable implementation decisions:

- **`PriceTag` never formats a price itself.** It calls `formatPriceRange` and, separately,
  `formatPriceUnit`, then splits the unit off the end of the formatted string so the amount can be
  set one step heavier than "per plate". Both halves come from the shared formatter, so a price
  cannot render differently on a card and on a detail page.
- **`PriceTag` renders a designed unknown state.** When the formatter returns `null` it renders
  muted text over a dashed rule, never an empty node. `onRequestLabel` lets a caller add the reason
  ("Price on request — 3 of 5 similar vendors published"), which the research recommends as a
  differentiator.
- **`CapacityTag` returns `null`** when both bounds are absent, rather than printing "0 guests".
- **`MediaPlaceholder` is deterministic.** An FNV-1a hash of `seed` picks one of four compositions
  and a tone from the `brand` / `accent` / `success` / `warning` application tokens; a mulberry32
  PRNG seeded from the same hash jitters it. Identical on server and client, stable across renders,
  and different for different listings — so a grid of photo-less listings reads as a set of distinct
  objects. One amber (`--app-accent`) element is present in every composition as a signature, and
  `danger` is never used: a placeholder is not an error.
- **`AspectImage` owns the ratio**, so a page physically cannot mix ratios inside one grid. When
  `src` is null it renders the placeholder in the same box, so adding a photograph later causes no
  layout shift.
- **`DataTable` uses Mantine's named `Table*` exports**, not `Table.Thead` statics: compound
  components cannot be used from a Server Component, and `render(row)` must be definable inline by a
  Server Component (a function prop cannot cross into a Client Component). It renders skeleton rows
  while `isLoading`, the `emptyState` inside a full-width cell with the column headers intact when
  there are no rows, always emits `<th scope="col">`, and always wraps in `TableScrollContainer`.
- **`Surface` uses `Paper` with `unstyled`** so the DOM, `component` polymorphism and ref handling
  stay Mantine's while the background comes from app tokens. This matters: Mantine's `Paper`
  background is `--mantine-color-body`, which in dark mode is the _page canvas_, i.e. one step
  below a panel.
- **`StatusBadge` declares four custom properties per tone** (`--tone`, `--tone-soft`,
  `--tone-soft-text`, `--tone-contrast`) and its three variant classes consume them. 7 tones × 3
  variants is 10 CSS rules instead of 21, and the contract is explicit.

### 7.1 The canonical listing card

Enforced by `ListingCardSkeleton` and repeated here so page authors can match it exactly. Values
read from `src/components/listing/ListingCard.module.css` and the primitive CSS:

```
media      aspect-ratio 3/2 (the single landscape ratio; the ratio set is capped at four values)
title      17px, --text-card-title-* (weight 700, tracking -0.01em)
tagline    --text-secondary-* in --app-text-muted
meta line  12px, --text-caption-* in --app-text-subtle
chips      StatusBadge is 20px (sm) / 24px (md) high, radius --app-radius-pill;
           inline highlights are --app-radius-control on --app-surface-muted
price      17px / weight 750 / -0.01em in --app-text, via PriceTag size="md"
action     40px minimum height, full width, radius --app-radius-control
grid       repeat(auto-fill, minmax(min(280px, 100%), 1fr)), gap 20px
```

Two notes, both of which a page author should know rather than guess:

- The price is `--text-card-title-size` (17px) at weight 750 — visually adjacent to, but not the
  same as, the `--text-anchor` step (18px / 750 / -0.01em / 1.2) introduced in §4. That step has no
  consumer yet; the card price is a candidate for it.
- The resting card shadow is a known deviation from the E0 contract in §5.3 (see the note there).

---

## 8. Icons

- **One set**: `@tabler/icons-react` (3.49.0). No second icon library, no bespoke icon font, no
  emoji anywhere in the UI.
- **One stroke width**: `1.5`, passed explicitly (`stroke={1.5}`) on the vast majority of icons.
  Tabler's default is 2, which reads heavier than Manrope at small sizes. Four icon usages do **not**
  pass it and therefore render at the default 2: `src/app/admin/page.tsx`,
  `src/components/admin/listing-editor/ListingEditor.tsx`,
  `src/components/admin/listing-editor/MediaManager.tsx` and
  `src/components/admin/listing-editor/CollectionsSection.tsx`. These are known deviations, not the
  documented rule.
- **Sizes in `rem`, via CSS.** Each icon is given an explicit `size` prop for the server-rendered
  SVG box, and the CSS module sets its width/height in `rem` (or `1em` when the icon should track
  the text around it, as in `CapacityTag`). Nothing is sized in `px`.
- **The steps in use**: 12 (chip remove control), 14 (inline attribute icons), 16 (button
  sections), 18 (theme toggle, header chrome), 22 (empty/error icon wells).
- **Icons are decorative by default.** Every icon that repeats adjacent text is `aria-hidden`; an
  icon that is the _only_ content of a control is covered by that control's `aria-label`
  (see `FilterChip`, `ThemeToggle`).
- Icons are plain SVG, so they are safe in Server Components. No icon is imported from a client-only
  module.

---

## 9. Conventions pages must follow

1. **Never hard-code a colour.** No hex, no `rgb()`, no named CSS colour in `src/**`. Use
   `var(--app-*)`. If a value is missing, add a token — do not inline it.
2. **Never hard-code a font size or line height in `px`.** Use the `--text-*` triples (or a Mantine
   `size` prop, which is tokenised).
3. **Compose primitives instead of restyling Mantine ad hoc.** A bordered panel is `Surface`. A page
   title is `PageHeader`. A price is `PriceTag`. A status is `StatusBadge`. If a page finds itself
   writing `classNames={{ root: … }}` on a Mantine component, that style belongs in a primitive.
4. **Copy the card anatomy, do not invent one.** Section 7.1 is the contract; `ListingCardSkeleton`
   is its executable form.
5. **One ratio per grid.** Use `AspectImage ratio="3/2"` for listing cards and never mix ratios
   inside one grid.
6. **Prices only through `formatPriceRange`.** Never re-implement currency formatting in a
   component; `src/lib/format.ts` is the single source.
7. **Reuse `TONE` semantics, not colours.** `StatusBadge tone="success"`, never `color="green"`.
8. **Icons: Tabler, `stroke={1.5}`, sized in `rem`.**
9. **Motion uses the token scale.** Use `--app-duration-*` and `--app-ease-*` (§5.4); do not invent a
   duration. Any transition must survive `prefers-reduced-motion: reduce` — the global rule
   neutralises durations, so never rely on a transition to reveal content.
10. **Server Components by default.** Add `'use client'` only for browser state. Passing a function
    into a Client Component from a Server Component is a build error — this is why `DataTable` uses
    Mantine's named `Table*` exports and why `render(row)` is defined on the server side.
11. **Respect the provider boundary.** Mantine's provider chain lives in
    `src/theme/app-providers.tsx` (`'use client'`) and must be rendered once, from the root layout.
    A page must not render its own `MantineProvider`.
12. **Colour scheme, not theme, is the only global browser state.** Read it with
    `useMantineColorScheme()`; never read the scheme during render without
    `{ getInitialValueInEffect: true }`.

---

## 10. Theming

### 10.1 Preference storage

`liveenvtColorSchemeManager()` (in `src/theme/color-scheme-manager.ts`) implements Mantine 9's
`MantineColorSchemeManager` contract directly — `{ get, set, subscribe, unsubscribe, clear }` —
because 9.7.2 ships `localStorageColorSchemeManager` and **no cookie manager**. Every write goes to
both stores:

- `localStorage['liveenvt-color-scheme']` — the source `ColorSchemeScript` reads in the blocking
  `<head>` script;
- cookie `liveenvt-color-scheme`, `path=/`, `max-age=31536000`, `SameSite=Lax` — available to the
  server.

Read order is localStorage → cookie → provider default, and the storage-event subscription mirrors
another tab's change back into the cookie so a hard reload still renders the same scheme.

`light | dark | auto` are all supported; `auto` follows `prefers-color-scheme`. `ThemeToggle` flips
between explicit `light` and `dark` only — asking for a scheme is a decision, so `auto` is the
default until the user makes it.

### 10.2 No flash of the wrong theme

`ColorSchemeScript` is rendered in `<head>` with `defaultColorScheme="auto"` and
`localStorageKey="liveenvt-color-scheme"`, matching the manager exactly. It is a blocking inline
script that sets `data-mantine-color-scheme` on `<html>` before first paint. `mantineHtmlProps`
supplies `suppressHydrationWarning`, which is what makes that rewrite safe.

### 10.3 The cookie, `cookies()` and `cacheComponents` — a documented conflict

The brief for this work asked the root layout to read the scheme cookie server-side so the SSR HTML
already carries the resolved scheme. That was implemented first, and **`next build` failed**:

```
Error: Route "/": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed
outside of `<Suspense>` prevents the route from being prerendered…
  - [block] Set `export const instant = false` to allow a blocking route
```

`next.config.ts` sets `cacheComponents: true` (with `partialPrefetching: true`, which is invalid
without it). A cookie read in the root layout cannot sit inside a `<Suspense>` boundary, because the
value is needed for an `<html>` attribute — above every boundary React can create. The only ways to
keep the server read are `export const instant = false` (opts the **entire** app out of the static
shell and PPR) or dropping `cacheComponents`. Both are app-wide architectural changes, so the layout
does not read the cookie and the decision is left open.

**What is lost:** `View Source` always shows `data-mantine-color-scheme="light"` for a first-time
visitor whose OS prefers dark. **What is not lost:** the visible pixels — the blocking head script
applies the correct scheme before first paint, so there is no flash.

**To restore a server-read scheme later**, add the read plus `export const instant = false` to
`src/app/layout.tsx` and pass the resolved value to both `ColorSchemeScript` and `AppProviders`. The
cookie is already being written and the resolver helper (`resolveColorScheme`) already exists, so it
is a small change once the rendering model is decided.

### 10.4 Two corrections to `docs/mantine-9-notes.md`

Both were found by building, not by reading, and both are load-bearing:

1. **`createTheme` does not accept `cssVariablesResolver`.** §2 of the notes puts it inside
   `createTheme({...})`; in 9.7.2 that is a type error —
   `'cssVariablesResolver' does not exist in type PartialObjectDeep<MantineTheme, …>`. It is a
   `MantineProvider` **prop**, and it is passed there in `app-providers.tsx`.
2. **The provider chain cannot live in a Server Component layout.** §1 of the notes shows
   `<MantineProvider theme={theme}>` inline in `src/app/layout.tsx`. With a theme carrying any
   function (or with `cssVariablesResolver`/`colorSchemeManager`, which are functions by nature),
   React fails the render: _"Functions cannot be passed directly to Client Components."_ The chain
   therefore lives in `src/theme/app-providers.tsx`, a `'use client'` module, and the layout renders
   one `<AppProviders>` boundary.

A third, smaller finding: a `'use client'` module's exports cannot be **called** from the server
(_"Attempted to call liveenvtColorSchemeManager() from the server"_). The manager instance is
therefore exported as a value (`appColorSchemeManager`) and never invoked across the boundary.

---

## 11. Verification log

| Check                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast (§3.5) — **re-measured 2026-10-15**                | throwaway `npx tsx` probe against the shipped token objects: **80 acceptance pairs, 80 passing, 0 failing** (40 per scheme). All 15 text-on-surface pairs per scheme clear 4.5:1; the narrowest margin is light `--app-accent` on the canvas at 4.59:1. Reproduced by an independent second implementation.                                                                                                                               |
| `npx tsc --noEmit` — **not re-verified in this revision**   | carried over from the previous revision: "clean for every file in this scope (theme, `components/ui`, `app/layout.tsx`)". A re-run during the concurrent component restyle reported errors in `src/components/ui/index.ts` (duplicate `Button` export), `ListingCard.tsx` and `src/app/admin/listings/page.tsx` — i.e. in files other agents were editing, not in `src/theme`. Treat the clean claim as unproven until the restyle lands. |
| `npx eslint src/theme src/components/ui src/app/layout.tsx` | carried over, **not re-run**: clean, zero warnings                                                                                                                                                                                                                                                                                                                                                                                        |
| `npx next build`                                            | carried over, **not re-run**; see §11.1                                                                                                                                                                                                                                                                                                                                                                                                   |
| Compiled CSS                                                | carried over from the previous revision and **not re-verified** against the new palette. The listed features (`--app-*` tokens per scheme, `--mantine-color-gray-0: #FFFFFF`, `--text-h1-size`, `--mantine-h1-font-size: var(--text-h1-size)`, `.visually-hidden`, the focus-ring rule, both `prefers-reduced-motion` blocks, `--font-manrope`) still exist in source; add `--text-anchor-size` to that list.                             |
| Mantine CSS import                                          | carried over, **not re-run**                                                                                                                                                                                                                                                                                                                                                                                                              |
| CSS Modules through the real PostCSS pipeline               | carried over, **not re-run** — 16 modules, no leftover `@mixin`, `rem()` or `$mantine-breakpoint-*`; expansions as recorded previously                                                                                                                                                                                                                                                                                                    |

### 11.1 Build status at hand-off (read this before trusting the table)

**This subsection describes the previous revision and was not re-verified after the palette
replacement.** The component restyle was in flight while this document was corrected, so any build
result would have been a moving target.

`next build` reaches **`✓ Compiled successfully` (17.3 s) → `Finished TypeScript` → `Generating
static pages (0/31)`** and then fails while prerendering `/`. That ordering is the important part:
every module in this scope — including all 16 CSS Modules that are reachable from app code — was
compiled by Turbopack and type-checked. A PostCSS, module-resolution or type failure in this scope
would have failed the compile step, and it did not.

The remaining failure belongs to another workstream:

```
Error: Route "/": Next.js encountered the unstable value `crypto.randomUUID()` while prerendering.
```

plus a non-fatal Turbopack warning from `src/lib/storage/local-driver.ts` about dynamic filesystem
access tracing the whole project. `grep` over the full build log for `src/theme`,
`src/components/ui` and `src/app/layout` returns **no matches**, and at that hand-off
`npx tsc --noEmit` over the whole repository reported **zero** errors. A re-run on 2026-10-15 —
while other agents were mid-edit — reported errors in `src/components/ui/index.ts` (duplicate
`Button` export), `ListingCard.tsx` and `src/app/admin/listings/page.tsx`; none were in
`src/theme`.

Coverage note: 15 of the 16 primitives are imported by real app code (`CapacityTag` has no consumer
yet), so everything except `CapacityTag`'s CSS has also been through Turbopack's CSS pipeline. The
PostCSS row above covers all 16 independently. A fully green `next build` needs the `/` page's
`crypto.randomUUID()` call moved behind `connection()` + `<Suspense>` (or cached), which is a change
in that file, not in this system.

## 12. Not implemented

Stated plainly so nothing here is mistaken for shipped work:

- **No visual review.** The primitives typechecked, linted, built and compiled through PostCSS in the
  previous revision, and their CSS variables were verified in the compiled output then — but **no
  component here has been looked at in a browser**, and the palette replacement invalidated the
  compiled-CSS check. No screen rendering these primitives has been captured. Screenshot-based
  verification is outstanding.
- **No automated accessibility tests.** Contrast was measured; focus order, screen-reader output and
  keyboard traversal have not been tested. There is no axe/Lighthouse pass in the repo.
- **`forced-colors` / Windows High Contrast** has not been tested, and no forced-colour overrides
  are written.
- **No RTL testing.** CSS Modules use logical properties (`padding-inline`, `margin-inline`) and
  Mantine's `@mixin rtl` is available, but nothing has been verified in an RTL locale.
- **Breakpoints are duplicated** between `src/theme/theme.ts` and `postcss.config.cjs`; this is a
  known manual-sync point, not an automated one.
- **Only a two-state theme toggle is shipped** (`light` ↔ `dark`). `auto` is the default and is
  honoured, but there is no three-way picker exposing it in the UI.
- **Motion tokens are defined but not adopted.** §5.4 specifies six durations and three easings, and
  nothing in `src/**` consumes them yet. The only transition among the primitives is `FilterChip`'s
  inline `120ms ease`, which should be re-pointed at the token scale as part of the component
  restyle. `--text-anchor` and the `--app-radius-1` / `--app-shadow-raised` / `--app-shadow-top` /
  `--app-shadow-overlay-strong` tokens are likewise defined-but-unadopted.
- **Three stale source comments could not be fixed here** (`src/**` is out of scope for this
  document, and four agents were editing components concurrently): the `StatusTone` comment in
  `src/components/ui/StatusBadge.tsx` says the palette "contains no blue" (it is now built on one);
  the focus block in `src/app/globals.css` says the ring is "brass" (it uses the blue token); and
  the `--mantine-color-brand-light*` override in `src/theme/css-variables-resolver.ts` justifies
  itself with "which for plum is a near-black chip" (the mechanism is right, the noun is stale).
  The declarations are correct in all three cases; only the prose is wrong.
