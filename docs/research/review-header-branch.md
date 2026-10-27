# Independent review — `fix/p0-header-contrast-and-tokens` @ `c494365`

**Reviewer role:** independent. I did not write this change. Every number below was
recomputed from `src/theme/tokens.ts` or measured in a browser against a real
production build; none is taken from the commit message.

**Baseline:** `21fe637`. **Diff:** `git show c494365` — exactly two files,
`src/components/layout/SiteHeader.module.css` (+78/−85) and
`src/components/layout/HeaderAccount.tsx` (3 lines). No other file in the tree
changed.

---

## Verdict: **REQUEST CHANGES**

The headline of the branch is real and I could not falsify it:

- the old dark-mode header pair **is** 3.06:1 (I reproduce the author's figure to
  two decimals), and
- the replacement surfaces/tokens **do** clear 4.5:1 for text and 3:1 for the ring
  and control boundaries on every surface the header uses, in both schemes, and
- the brand **is** no longer a full-bleed background (header brand-fill pixels
  fell from **55.8% → 2.35%** of the header).

But the change introduces **one new, measured WCAG 1.4.3 failure** of exactly the
kind it exists to remove — a hover colour that lands at **4.41:1** where 4.5:1 is
required — plus a dead override and a now-false component docblock. All three are
small and cheap to fix, but the first one is a contrast regression on a
contrast-fix branch, so this should not land as-is.

---

## 1. Commands run, real output

```console
$ npx tsc --noEmit
npm warn Unknown env config "store-dir". This will stop working in the next major version of npm…
tsc exit: 0                      # no diagnostics

$ npx eslint .
npm warn Unknown env config "store-dir". …
eslint exit: 0                   # no output

$ npx prettier --check .
Checking formatting...
All matched files use Prettier code style!
prettier exit: 0

$ grep -nE '#[0-9a-fA-F]{3,8}' src/components/layout/SiteHeader.module.css
exit=1                           # zero matches

$ grep -rEn "#[0-9a-fA-F]{3,8}" src/components/layout
src/components/layout/HomeHero.module.css:5:  background-color: #1a1214;
src/components/layout/HomeHero.module.css:57:  color: #fff;
src/components/layout/HomeHero.module.css:105:  color: #7ddf9a;
src/components/layout/HomeHero.module.css:118:  background: #fff;
src/components/layout/HomeHero.module.css:134:  color: #fff;
src/components/layout/HomeHero.module.css:141:  text-decoration-color: #fff;
exit=0

$ git show 21fe637:src/components/layout/SiteHeader.module.css | grep -cE '#[0-9a-fA-F]{3,8}'
22
```

Production build in `.next` was newer than the sources
(`.next/BUILD_ID` 01:20:55 > `SiteHeader.module.css` 01:20:37) and contains the new
rule (`mantine-Burger-root`) and none of the old ones; I served that build
directly rather than rebuilding. Server:

```console
$ BETTER_AUTH_SECRET=… IP_HASH_SALT=… ALLOW_LOCAL_MEDIA_STORAGE='true' \
  NEXT_PUBLIC_APP_URL='http://127.0.0.1:3501' BETTER_AUTH_URL='http://127.0.0.1:3501' \
  npx next start -p 3501
▲ Next.js 16.4.0   ✓ Ready in 163ms
$ curl -s -o /dev/null -w "%{http_code}" 'http://127.0.0.1:3501/vendors?category=venues'   → 200
```

---

## 2. Claim 1 — dark-mode AA failure (verified)

Computed with the WCAG 2.1 relative-luminance formula from the token values in
`src/theme/tokens.ts` (`darkSchemeTokens['--app-brand'] = '#F25F97'`,
`lightSchemeTokens['--app-brand'] = '#D6006E'`). The old header used
`background-color: var(--app-brand)` on _both_ bars and hard-coded nav text, so the
dark-scheme brand value is the one in play.

|                                                     | nav text  | ground    | ratio      | needed |
| --------------------------------------------------- | --------- | --------- | ---------- | ------ |
| **old, dark** (`.mainBar` = `var(--app-brand)`)     | `#FFFFFF` | `#F25F97` | **3.06:1** | 4.5    | **FAIL**      |
| **old, light**                                      | `#FFFFFF` | `#D6006E` | **5.14:1** | 4.5    | pass          |
| old, dark utility strip (`--mantine-color-brand-8`) | `#FFFFFF` | `#850046` | 10.07:1    | 4.5    | pass          |
| old, dark white focus ring                          | `#FFFFFF` | `#F25F97` | 3.06:1     | 3      | pass (barely) |

The author's **3.06:1** and **5.14:1** are both exactly right.

### New pairs — every header surface × both schemes

Measured token pairs for the surfaces the header actually paints:
`--app-surface-raised` (`.header`, `.mainBar`), `--app-surface-muted` (`.utilityBar`),
`--app-surface-hover` (`.navLink:hover`, `.iconAction:hover`). Light and dark.

Light scheme (`--app-surface` `#FFF7F9`, raised `#FFFFFF`, muted `#FBE9EF`, hover `#FFF0F5`):

| pair                                                        | ratio                | needed |                     |
| ----------------------------------------------------------- | -------------------- | ------ | ------------------- |
| `--app-text` `#1C1416` on raised                            | 18.09:1              | 4.5    | pass                |
| `--app-text-muted` `#553D44` on raised                      | 9.83:1               | 4.5    | pass                |
| `--app-text-muted` `#553D44` on muted (utility bar default) | **8.42:1**           | 4.5    | pass                |
| `--app-text` on hover surface                               | 16.39:1              | 4.5    | pass                |
| `--app-focus-ring` `#D6006E` on raised                      | 5.14:1               | 3      | pass                |
| `--app-focus-ring` on muted / surface / hover               | 4.41 / 4.88 / 4.66:1 | 3      | pass                |
| active rule `--app-brand` `#D6006E` on raised               | 5.14:1               | 3      | pass                |
| primary CTA label `#FFFFFF` on `#D6006E`                    | 5.14:1               | 4.5    | pass                |
| primary CTA hover `#FFFFFF` on `#A3005A`                    | 7.76:1               | 4.5    | pass                |
| `--app-border-strong` control outline on raised             | 4.18:1               | 3      | pass                |
| `.utilityLink:hover` `#D6006E` on muted `#FBE9EF`           | **4.41:1**           | 4.5    | **FAIL** ← defect 1 |

Dark scheme (`--app-surface` `#191114`, raised `#221719`, muted `#2C1E21`, hover `#33232A`):

| pair                                              | ratio                | needed |      |
| ------------------------------------------------- | -------------------- | ------ | ---- |
| `--app-text` `#FBEEF1` on raised                  | 15.44:1              | 4.5    | pass |
| `--app-text-muted` `#C4A9B2` on raised            | 8.02:1               | 4.5    | pass |
| `--app-text-muted` on muted (utility bar default) | 7.35:1               | 4.5    | pass |
| `--app-text` on hover surface                     | 13.15:1              | 4.5    | pass |
| `--app-focus-ring` `#F87FAE` on raised            | 7.17:1               | 3      | pass |
| `--app-focus-ring` on muted / surface / hover     | 6.57 / 7.63 / 6.11:1 | 3      | pass |
| active rule `--app-brand` `#F25F97` on raised     | 5.69:1               | 3      | pass |
| primary CTA label `#1C1416` on `#F25F97`          | 5.91:1               | 4.5    | pass |
| primary CTA hover `#1C1416` on `#FFB7CE`          | 11.13:1              | 4.5    | pass |
| `--app-border-strong` control outline on raised   | 3.69:1               | 3      | pass |
| `.utilityLink:hover` `#F25F97` on muted           | 5.22:1               | 4.5    | pass |

Everything the commit _intended_ to fix measures as passing, in both schemes, on
all four header surfaces. The one exception is the hover colour it added.

The hairline `border-block-end: 1px solid var(--app-border)` measures 1.34:1 (light)
/ 1.26:1 (dark) against the header surface. I treat it as decorative (WCAG 1.4.11
does not require contrast for a purely decorative separator), and it is legible in
the screenshots. Not a defect.

Surface steps, for the "are the two bars distinguishable?" question:

|                                           | ratio  |
| ----------------------------------------- | ------ |
| light utility `#FBE9EF` vs main `#FFFFFF` | 1.17:1 |
| dark utility `#2C1E21` vs main `#221719`  | 1.09:1 |
| light main vs page `#FFF7F9`              | 1.05:1 |
| dark main vs page `#191114`               | 1.07:1 |

Both bars are _subtly_ separated. In the rendered screenshots the tint step plus
the hairline is plainly visible in both schemes, so "distinguishable" holds — but
only barely in dark (1.09:1). That is a design judgement, not a WCAG failure.

---

## 3. Claim 2 — colour budget (direction verified; the author's 7.1% is not reproducible as stated)

**Direction: confirmed.** The diff deletes `background-color: var(--app-brand)`
from `.header`/`.mainBar` and `--mantine-color-brand-8` from `.utilityBar`. The
brand is now only the active-nav rule, the one primary CTA and the focus ring.

I measured it on the rendered pixels rather than trusting the arithmetic. Same URL
(`/vendors`), same viewport (1440), same production build path, baseline image from
`docs/research/shots/baseline-vendors-1440-{light,dark}.png` vs my captures at
`docs/research/shots/review/after-vendors-1440-{light,dark}.png`.

Pixel share of the exact brand fill colour (`#D6006E` light / `#F25F97` dark):

|                                                                      | baseline      | after         |
| -------------------------------------------------------------------- | ------------- | ------------- |
| `/vendors` 1440 light, brand-fill pixels                             | 5.21%         | **3.20%**     |
| `/vendors` 1440 dark, brand-fill pixels                              | 5.21%         | **3.20%**     |
| header region only (≤101px), brand-fill                              | **55.82%**    | **2.35%**     |
| whole-page pink/magenta hue family (my own rule, for direction only) | 8.06% / 7.99% | 4.64% / 4.58% |

So: the after state is **within the ≤4% ceiling** on this page, and the header's own
contribution collapsed from over half the header's pixels to ~2.35% (which is the
`Sign in` pill plus the 3px active rule).

**Honest caveat on "~7.1%".** I could not reproduce 7.1% as a pixel measurement.
That figure comes from `docs/research/current-state-audit.md` §3.2 and is a
_geometry estimate_, not a rendered-pixel count: `3.77%` (both header bars treated
as primary fill, each `height × 1440 / (2652 × 1440)`) + `3.31%` (12 × 263×40 CTA
_bounding boxes_). It over-counts for two reasons: the utility bar was
`--mantine-color-brand-8` (`#850046`), which is not `--app-brand` at all, and the
CTA bounding boxes include the white label/icon pixels that are not fill. I did not
re-run the pre-change render (the baseline screenshots are the only pre-change
evidence), so I cannot state a precise old→new "primary fill" percentage using the
audit's own definition. What I can state precisely: **rendered brand-fill coverage
on the audited page fell 5.21% → 3.20% and is now under the ceiling; the header's
brand fill fell 55.8% → 2.35%.** The claim's direction and its conclusion hold; its
quoted magnitude is an estimate and should be labelled as one.

---

## 4. Claim 3 — zero hex literals outside `src/theme` in this file (verified)

```console
$ grep -nE '#[0-9a-fA-F]{3,8}' src/components/layout/SiteHeader.module.css
exit=1                       # no match
$ git show c494365:src/components/layout/SiteHeader.module.css | grep -cE '#[0-9a-fA-F]{3,8}'
0
$ git show 21fe637:src/components/layout/SiteHeader.module.css | grep -cE '#[0-9a-fA-F]{3,8}'
22
```

All 22 removed literals were `#ffffff` **declarations**
(`40,58,80,92,123,128,173,180,186,208,232,237,242,250,260,268,272,273,277,287,291,300`),
matching the audit's list exactly. The file now contains no `#` except two markdown
headings in the leading comment (`## Why…`, `## Rules…`) — nothing to match.

**On the "reworded comment" probe.** I checked the premise and it does not hold
against the baseline: **no comment in `21fe637:SiteHeader.module.css` contained a
hex literal**, so nothing was reworded to hide a pre-existing violation. The one
place where the new comment could reasonably have quoted a value is
`SiteHeader.module.css:11-13` — it describes the dark-scheme brand as "the
dark-scheme light pink" and gives `3.06:1` rather than writing the literal
`#F25F97`. Writing the hex would have tripped the grep and made the "0 hex" claim
fail on a comment that is never compiled. Judgement: **acceptable, not gaming.**
The check's intent is "no hard-coded colour _values used as CSS_"; the comment stays
accurate and names the token it means (`--app-brand`). It is mildly less convenient
for a reader than an exact value, nothing more.

Sub-scope note: the audit's "28 hex literals outside `src/theme`" is now 6, all in
`src/components/layout/HomeHero.module.css` — untouched by this commit and outside
its stated scope. Not a regression; the P0-3 item is only 22/28 complete.

---

## 5. Claim 4 — the focus-ring exception is gone (verified in the browser)

I tabbed through the live page and read the computed `outline` of every header
focusable, in both schemes and both viewports. **Every one is `--app-focus-ring`,
none is `white`, and none removes focus:**

| element                                   | light                      | dark                         |
| ----------------------------------------- | -------------------------- | ---------------------------- |
| utility `Track an enquiry` / `Contact us` | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |
| Burger (`Open navigation menu`, 390 only) | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |
| brand link `Life Events — home`           | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |
| nav links (all 6, `outline-offset: -2px`) | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |
| search link `Search vendors`              | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |
| theme toggle `Switch to dark theme`       | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |
| account CTA `Sign in`                     | `2px solid rgb(214,0,110)` | `2px solid rgb(248,127,174)` |

`rgb(214,0,110)` is `lightSchemeTokens['--app-focus-ring']`; `rgb(248,127,174)` is
`darkSchemeTokens['--app-focus-ring']`. `SignOutButton` (signed-in state, not
reachable without a session) uses `Button`'s own `variant="ghost"` and inherits
`Button.module.css:215-218`, which is also `--app-focus-ring`; no white ring exists
anywhere in the header path. The skip link (`SiteShell.tsx:26`) also uses the token
(measured `2px solid rgb(214,0,110)`).

Visually the ring reads correctly on both grounds — see
`review/focus-1440-light-4.png` (inset ring around `All vendors` on white) and
`review/focus-390-dark-3.png` (ring around the burger on near-black).

---

## 6. Claim 5 — no functional or accessibility regression (verified, one maintainability defect)

**Accessible names / visible text.** `HeaderAccount.tsx` changes only the
`variant` prop; the label text (`Sign in`, or the user's first name), the
`leftSection` icons (`aria-hidden`), the `href`s and the `Link`/`Button` structure
are byte-identical. Read back from the live DOM: CTA text `"Sign in"`, `href`
`"/sign-in?next=%2Faccount"`, no `aria-label` (name comes from the text). Unchanged.

**`primary` is a real variant with complete states.** `Button.tsx:13` declares
`'primary'` in `ButtonVariant`, `Button.tsx:37-51` aliases it, and
`Button.module.css` defines rest (`:112`), hover (`:118`), active (`:124`),
focus-visible (`:215`) and disabled (`:223`). Measured in-page:
`data-variant="primary"`, `background rgb(214,0,110)` / `rgb(242,95,151)` — the
brand fill and `--app-brand-contrast` text, i.e. it inherits the primitive's
definition rather than a header-local one. This is a genuine de-duplication.

**Nothing semantic removed.** Landmarks present after the change on every page I
loaded: `HEADER`, `NAV[aria-label="Primary"]`, `MAIN`, `a[href="#main-content"]`
(skip link). Icon-only controls keep their names: `Open navigation menu`,
`Life Events — home`, `Search vendors`, `Switch to dark theme`/`Switch to light theme`.
The CSS-only diff cannot remove roles and the TSX diff touched only `variant`.

**No horizontal overflow.** `document.documentElement.scrollWidth − clientWidth`
measured `0` for `/`, `/vendors`, `/vendors?category=venues`, `/categories`,
`/about`, `/sign-in` at **1440 and 390**, both schemes — and the existing suite's
`no horizontal overflow` tests (9 public routes + a 320px case, ×2 schemes, 22
tests) all pass (§10).

**Exactly one `h1` per page** at the same six routes × two viewports × two schemes,
and the suite's `every page has exactly one level-one heading` passes in both
schemes.

**No `transition: all`** — `grep -n transition src/components/layout/SiteHeader.module.css`
returns nothing; the file has no transitions at all.

**Mobile Burger is visible.** Bar colour measured `rgb(29,25,23)` in light and
`rgb(255,255,255)` in dark, on `rgb(255,255,255)` / `rgb(34,23,25)` grounds; see
`review/header-390-light.png` / `-dark.png`. It is visible — **but not because of the
rule the diff added** (defect 2).

---

## 7. Screenshots

All under `docs/research/shots/review/`, captured from the production build at
`http://127.0.0.1:3501`. Note `docs/research/shots/` is gitignored (`.gitignore:63`),
so these PNGs live on disk only — same as the author's own `after-header-*.png` and
the `baseline-*.png` set they were compared against.

| file                                  | what it shows                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header-1440-light.png`               | Light desktop. Neutral white main bar, pale-pink utility strip, dark nav labels, magenta active rule under `All vendors`, magenta `Sign in` pill as the single primary fill. Legible; nothing washed out. |
| `header-1440-dark.png`                | Dark desktop. Near-black raised bar, slightly lighter utility strip, near-white labels, pink active rule, pink `Sign in` pill with near-black label. The dark-mode 3.06:1 failure is gone.                |
| `header-390-light.png`                | Light mobile. Burger + brand + search + theme + `Sign in`; tagline correctly dropped; no crowding, no overflow.                                                                                           |
| `header-390-dark.png`                 | Dark mobile. Same layout; burger lines white and visible; brand tile pink on near-black.                                                                                                                  |
| `focus-1440-light-4.png`              | `All vendors` focused: inset magenta ring, visible against the white bar.                                                                                                                                 |
| `focus-390-dark-3.png`                | Burger focused: magenta ring, visible against the near-black bar.                                                                                                                                         |
| `after-vendors-1440-{light,dark}.png` | Full-page captures used for the pixel-budget measurement in §3.                                                                                                                                           |

Visual read: nav is legible in both schemes; the active-state affordance (weight +
3px brand rule) is clear and not colour-alone; the account CTA is the most prominent
element in the bar, which is the intent; the utility strip and main bar are
distinguishable; nothing looks broken or washed out. The one visual complaint is
that in dark the utility strip sits only 1.09:1 above the main bar, so the two tiers
read as one surface unless you look for the seam.

---

## 8. Defects

1. **[Low — AA contrast regression, newly introduced]** `src/components/layout/SiteHeader.module.css:98`
   — `.utilityLink` hover sets `color: var(--app-brand)`. The utility link is
   12px/600 (normal text) on the unchanged `--app-surface-muted` ground, so the
   hover pair is `#D6006E` on `#FBE9EF` = **4.41:1**, below the required 4.5:1.
   Confirmed live: hover computed `color: rgb(214,0,110)`,
   `background: rgba(0,0,0,0)`, strip `rgb(251,233,239)`. The old code left the
   hover colour alone (white on `#850046` = 10.07:1), so this is a regression, and
   it is on the exact axis the branch claims to fix. Dark mode is fine (5.22:1).
   Fix: use `--app-text` (8.42:1, and consistent with the sibling `.navLink:hover`
   rule at `:192`) or `--app-brand-soft-text` (6.66:1).

2. **[Low — dead code / misleading]** `src/components/layout/SiteHeader.module.css:288-290`
   — `.burgerSlot :global(.mantine-Burger-root) { color: var(--app-text); }` does
   not colour the burger. Mantine's Burger draws its lines with
   `background-color: var(--burger-color)` (`@mantine/core/styles/Burger.css`), and
   `--burger-color` is set by Mantine per scheme from the theme's `black`/`white`
   (`theme.ts:69-70`). Verified empirically: setting `color: rgb(255,0,0)` on the
   burger root at runtime left the bar background at `rgb(29,25,23)`, and the
   computed `--burger-color` is `#1D1917`, not `--app-text` (`#1C1416`). The old
   white overrides were dead for the same reason. The control is visible (defect-free
   visually) but the rule advertises an intent it does not implement; a future
   `--app-text` change would silently not affect the burger. Fix: set
   `--burger-color: var(--app-text)` instead of `color`, or delete the rule and
   state that Mantine's scheme default is already correct.

3. **[Low — stale documentation]** `src/components/layout/SiteHeader.tsx:13-31`
   — the component docblock was not updated and now actively contradicts the CSS it
   documents: line 13 "two tiers on a magenta ground", lines 17-19 "the same hue at
   two depths", lines 26-31 "**Colour.** Both bars are the brand itself … the header
   is the single largest use of the accent budget on any page". None of that is true
   after `c494365`. This is the second-largest file in the change's blast radius and
   the first thing a reader sees. Fix: port the first half of the new CSS header
   comment into `SiteHeader.tsx`.

No defects found in: the token choices, the focus handling, the landmark/name
structure, the responsive behaviour, the `Button` variant resolution, or the build
and lint gates.

---

## 9. Scope and maintainability

- **Scope is clean.** No new dependency, no lockfile change, no business-logic edit,
  no unrelated file touched. `HeaderAccount.tsx`'s three `variant` flips are the
  change's own thesis ("one definition of what a primary button looks like"), not
  drive-by refactoring.
- **The diff is coherent.** Comments were rewritten to match the code rather than
  left to rot; the "Rules this file follows" block is accurate about tokens, the
  absent shadow and focus. The only inaccurate comment is in the _other_ file
  (defect 3).
- **Header height grew by 1px** (100 → 101px) because of the added hairline:
  measured header `height: 101px`, full-page height 2652 → 2653. `--app-header-height`
  is 64px and is consumed as a scroll/sticky offset in
  `src/app/globals.css:258` (`calc(var(--app-header-height) + 1rem)` = 80px) and
  `src/components/layout/SiteShell.module.css:38`. Those offsets were **already**
  ~21px short of the real header before this commit; the border makes them 22px
  short. Pre-existing, not introduced, and worth its own ticket rather than a
  change here.
- **Pre-existing, out of scope (flagging, not counting):** `HeaderNav.tsx:19` still
  says "a 2px brand indicator" while `SiteHeader.module.css:218` sets `rem(3px)`;
  `HomeHero.module.css` still holds the remaining 6 hex literals.
- `docs/research/shots/review/` and this file are reviewer artefacts, not product code.

---

## 10. E2E evidence

The "do not break what works" list was verified twice over: directly against the
running production build (§6), and by the existing suite. Focused run against the
seeded test database, `desktop-light` + `desktop-dark`:

```console
$ npx playwright test responsive-and-theme.spec.ts \
    --project=desktop-light --project=desktop-dark \
    --grep "no horizontal overflow|exactly one level-one heading|resolved colour scheme"
Running 24 tests using 1 worker
  ✓ 1–11  [desktop-light] no horizontal overflow on /, /categories, /vendors,
            /vendors?…, /vendors/gulmohar-…, /enquire?…, /track, /sign-in, /about,
            at 320px; resolved colour scheme applied to <html>
  ✓ 12    [desktop-light] accessibility basics › every page has exactly one level-one heading
  ✓ 13–24 [desktop-dark]  the same twelve
  24 passed (13.9s)
```

No failures, no retries. I did **not** run the whole suite — it needs
`TEST_DATABASE_URL`, re-seeds the isolated test DB in global setup (it ran that
seeding here), and boots its own server on port 3100. The subsets above are the ones
the header change can plausibly affect.
