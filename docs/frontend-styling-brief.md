# Frontend styling brief

Every engineer on the styling pass reads this before touching a component. It is the shared contract:
the visual world, the token contract, the motion rules, and the hard constraints that keep the test
suite green. Read it once, then read [`marketplace-styling-guide.md`](./marketplace-styling-guide.md)
for the detailed specifications it references.

---

## 1. The visual world

The product is a **marketplace**, not an editorial site. The references are Amazon, Flipkart and Myntra
— studied for their _structure_, never their branding. What makes them work is:

- a **neutral wall** (≥90% of painted area) with colour spent on action and status;
- **one dominant action colour**, so the eye learns a single "this does something" signal;
- **one comparable value in the same slot on every tile**, so rows can be sorted by eye;
- **dense, honest information** — every pixel carries a fact, and nothing carries a fabricated one.

The palette has been rebuilt to match: a deep action blue on a cool slate neutral, with a warm amber
accent carrying the wedding register and the featured/verified marks. The palette is **already landed**
in `src/theme/tokens.ts` and verified — 78 contrast pairs, all passing, in both schemes.

**Do not re-colour anything by hand.** If a surface looks wrong, the fix is a different _token_, not a
hex value.

## 2. Token contract — frozen

`src/theme/tokens.ts` and the `:root` block of `src/app/globals.css` are the contract. Consume them;
**do not add, rename or remove tokens**, and never write a hex literal outside `src/theme`.

| Group     | Tokens                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| Surfaces  | `--app-surface`, `-raised`, `-muted`, `-sunken`, `-hover`                                                           |
| Ink       | `--app-text`, `--app-text-muted`, `--app-text-subtle`                                                               |
| Action    | `--app-brand`, `-soft`, `-soft-hover`, `-soft-text`, `-contrast`                                                    |
| Accent    | `--app-accent`, `-soft`, `-soft-hover`, `-soft-text`                                                                |
| Semantic  | `--app-{success,warning,danger}` each with `-soft`, `-soft-hover`, `-soft-text`                                     |
| Lines     | `--app-border` (decorative hairline), `--app-border-strong` (a control outline — clears 3:1)                        |
| Focus     | `--app-focus-ring`, `--app-overlay`, `--app-contrast`                                                               |
| Radius    | `--app-radius-1`, `-control`, `-card-dense`, `-card`, `-pill`                                                       |
| Elevation | `--app-shadow-raised` (E1), `-overlay`/`-card` (E2), `-top` (E3)                                                    |
| Rhythm    | `--app-gutter`, `-section-gap`, `-stack-gap`, `-card-padding`, `-grid-gap`                                          |
| Motion    | `--app-duration-{instant,micro,fast,base,slow,exit}`, `--app-ease-{out,in-out,in}`                                  |
| Type      | `--text-{display,h1,h2,h3,anchor,card-title,body,secondary,label,button,caption,error,dense}-{size,weight,leading}` |

### The five rules that follow from the tokens

1. **Elevation is E0 unless it floats.** A resting card is a 1px `--app-border` on a raised surface,
   never a shadow. `--app-shadow-raised` is the _maximum_ on any grid card and is for hover. Shadows are
   for dropdowns, popovers, drawers, modals and toasts.
2. **`--app-primary` is for actions only.** Never a badge, heading, border or decorative fill. Budget:
   at most **one primary fill per card and per page section**, ≤4% of painted area.
3. **Accent is a line or a glyph, never a large fill.** ≤1.5%.
4. **`--app-contrast` goes on saturated fills**; `--app-brand-contrast` on a brand fill. Both flip
   automatically between schemes — never hard-code white text on a coloured button.
5. **Radius steps _down_ as density goes up.** Dense internals 4px, controls 8px, dense cards 12px,
   editorial panels 14px, pills only for badges and chips.

## 3. Density — airy by default

This product has chosen **airy and premium** as its default register. Density is added only where the
task demands comparison.

`.surface--editorial` (default) and `.surface--dense` re-value the rhythm tokens. The decision rule is
the number of comparable items in one viewport: **6 or more → dense; 1–2 → editorial; 3–5 → neither.**

| Surface                                                                          | Register                 |
| -------------------------------------------------------------------------------- | ------------------------ |
| Home hero, profile hero, vendor profile body, about/contact/legal                | editorial                |
| Category tiles, enquiry form, account overview                                   | editorial, stepping down |
| Browse grid, city/category grid, filter rail, admin tables, account enquiry list | `surface--dense`         |

## 4. Typography — one family, nine weights

**Manrope only.** Hierarchy is built from size, weight and colour, never from a second typeface and
never from a decorative treatment. Weights in use: **450, 500, 550, 600, 650, 700, 720, 750, 800**.
Do not use 200, 300, 400 (use 450 — Manrope is variable) or 900, and never italic.

Sizes are rem-based; use the `--text-*` tokens rather than raw `font-size`. The one new step is
`--text-anchor` — the scan value that replaces the price/rating slot these marketplaces use. See
`marketplace-styling-guide.md` §2.2 for the ladder that decides what fills it.

Length: keep body measure under ~72 characters. Uppercase is not a label treatment here — labels are
sentence case at weight 650.

## 5. Motion — restrained

Five durations, three easings, and an exit shorter than its enter. **Nothing exceeds 280ms.**

| Beat      | Duration | Use                                                      |
| --------- | -------- | -------------------------------------------------------- |
| `instant` | 0ms      | text and focus-ring changes — these _are_ the affordance |
| `micro`   | 90ms     | button background, checkbox, chip remove                 |
| `fast`    | 140ms    | card border + elevation, menu row hover                  |
| `base`    | 200ms    | skeleton/image cross-fade, scrim, modal enter            |
| `slow`    | 280ms    | drawer/sheet, accordion                                  |
| `exit`    | 140ms    | every dismissal                                          |

Easings: `--app-ease-out` for entrances, `--app-ease-in-out` for state changes, `--app-ease-in` for
exits.

**Animate:** colour, border, shadow, opacity, transform on overlay surfaces only, skeleton shimmer
(1.2s linear, visible rows only).

**Never animate:** card scale or translate on hover, grid re-flow, any number (no count-ups), focus
rings, text size/weight/colour on hover, `scroll-behavior` when filters apply, page-load stagger,
parallax, scroll reveals, autoplay carousels.

**One orchestrated moment per page, at most.** A single page-load reveal on a hero is fine. A
fade-and-slide-up on every section is the generic default and reads as generated.

**`prefers-reduced-motion` policy: motion carrying _state_ survives, motion carrying _position_ goes.**
Colour and focus stay at 0ms — they are the affordance. Lifts, slides, cross-fades and shimmer are
removed; shimmer becomes a static muted fill with identical box dimensions so skeleton→content causes
no layout shift. Every animation you add needs a reduced-motion branch.

## 6. Detail that earns its place

Detail means the small things a careful engineer notices, not decoration:

- **Every interactive element has hover, focus-visible, active and disabled states**, and focus is
  never removed — only restyled to `--app-focus-ring`.
- **Empty, loading and error states are designed**, not defaulted. An empty screen invites an action
  and says what it is; an error says what happened and how to fix it.
- **Numbers use `font-variant-numeric: tabular-nums`** so columns align.
- **Long content is handled**: titles clamp to a reserved 2-line box so a grid row cannot jitter, prices
  and cities truncate with a title attribute rather than wrapping.
- **Real content, not lorem.** Never invent a price, a rating, a review, a statistic or a support
  address. "Price on request" is a designed state.
- **Touch targets ≥24×24 CSS px**; ≥44px where the control is primary on mobile.

## 7. Constraints you must not break

**The test suite is the contract.** 612 Vitest tests and 222 Playwright tests currently pass. E2E
asserts on **accessible names, roles and visible text**. Therefore:

- **Do not change accessible names, `aria-label`s, roles, or user-visible copy** unless you are fixing
  a genuine defect. If you believe copy is wrong, report it rather than changing it.
- **Do not remove structural elements** tests rely on: `article` for a listing card, the `search` role,
  the `complementary` role named "Filters", the `dialog` role for the mobile filter sheet, heading
  levels (`h1` exactly once per page).
- Keep one `<h1>` per page and a monotonic heading order.

**Both themes must work.** Every visual decision is checked in light and dark; dark alphas are
deliberately much higher (a 5% black shadow is invisible on near-black).

**Accessibility floor:** 4.5:1 for text, 3:1 for control outlines and focus rings, no colour as the
only signal, visible focus on every control, and reduced-motion honoured.

## 8. Before you report

Run, on your own paths only:

```bash
source .dev-env.sh
npx tsc --noEmit
npx eslint <your paths>
npx prettier --check <your paths>
grep -rEn "#[0-9a-fA-F]{3,8}" <your paths>   # must return only src/theme
```

**Do not run `next build`, `next dev`, `pnpm start`, `vitest` or `playwright`.** Those are shared
resources and the verifier owns them; a concurrent run corrupts both. If you need a visual check,
describe precisely what a screenshot should show and the verifier will capture it.

In your report: what you changed per surface, the exact verification output, anything you could not do
because it fell outside your scope, and any defect you found but did not fix.
