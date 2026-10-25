# Independent re-review — `fix/p0-header-contrast-and-tokens` @ `7a505fb`

**Reviewer role:** independent. I did not write this change. Every contrast figure below
was recomputed from `src/theme/tokens.ts` with the WCAG 2.1 relative-luminance formula and
then re-checked against the live DOM of a fresh production build; every burger claim was
measured in Chromium by mutating the page at runtime. Nothing is taken from the commit
message.

**Round 1:** `c494365` → REQUEST CHANGES (3 defects).
**Round 2 (this review):** `7a505fb` — "fix(header): address independent review findings".
**Baseline of the branch:** `21fe637`. Working tree clean at `7a505fb`; `.next` rebuilt from
these sources before any test or screenshot was taken.

---

## Verdict: **APPROVE**

All three reported defects are genuinely fixed, and I could not falsify any of them:

1. **Contrast regression — fixed.** `.utilityLink:hover` moved from `--app-brand`
   (**4.41:1** light, measured false) to `--app-text` (**15.51:1** light / **14.15:1**
   dark, recomputed from tokens **and** read back from computed styles). AA for normal text
   is 4.5.
2. **Dead override — fixed.** The burger now paints from `--burger-color`. Proven live:
   overriding `--burger-color` turns all three bars red; overriding `color` (the old
   declaration) leaves them unchanged.
3. **Stale docblock — fixed.** It now describes neutral surfaces and the 3.06:1 dark-mode
   failure, and matches the CSS.

The correction introduced **no** new functional, contrast, focus, or layout defect. Four
comment-level imprecisions remain — all **Low**, three documentation-only and one
commit-message-only, and one of those is pre-existing. They are listed in §9 and none of
them blocks the branch.

---

## 1. Commands run, real output

```console
$ git show 7a505fb --name-status
A       docs/research/review-header-branch.md
M       src/components/layout/HeaderNav.tsx
M       src/components/layout/SiteHeader.module.css
M       src/components/layout/SiteHeader.tsx

$ npx tsc --noEmit
tsc exit: 0                                  # no diagnostics

$ npx eslint .
eslint exit: 0                               # no output

$ npx prettier --check .
Checking formatting...
All matched files use Prettier code style!
prettier exit: 0

$ grep -cE '#[0-9a-fA-F]{3,8}' src/components/layout/SiteHeader.module.css
0
grep exit: 1                                 # zero matches (grep -c exits 1 on no match)
```

Build freshness (the repo's `.next` was stale, so a rebuild was required):

```console
$ stat -f "%Sm %N" .next/BUILD_ID src/components/layout/SiteHeader.module.css
Oct 16 01:20:55 2026 .next/BUILD_ID
Oct 16 01:35:47 2026 src/components/layout/SiteHeader.module.css        # newer than BUILD_ID → stale

$ rm -rf .next && npx next build
✓ Compiled successfully … (exit 0)
$ cat .next/BUILD_ID
qT-topi6FkVHTExxWRLbj
```

Built CSS confirms the two fixes survive the CSS-module/minifier pipeline (this is the
shipped artefact, not the authored file):

```css
.burgerSlot .mantine-Burger-root{--burger-color:var(--app-text)}
.utilityLink:hover{color:var(--app-text);text-underline-offset:calc(.1875rem * var(--mantine-scale));text-decoration:underline}
.utilityLink:active{color:var(--app-text);…}
```

Server used for all browser work (own port, as instructed):

```console
$ BETTER_AUTH_SECRET='rereview-secret-…' IP_HASH_SALT='rereview-ip-salt-…' \
  ALLOW_LOCAL_MEDIA_STORAGE='true' NEXT_PUBLIC_APP_URL='http://127.0.0.1:3502' \
  BETTER_AUTH_URL='http://127.0.0.1:3502' npx next start -p 3502
▲ Next.js 16.4.0  ✓ Ready
$ curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3502/vendors?category=venues   → 200
```

---

## 2. Defect 1 — contrast regression, recomputed

The utility link is 12px/600 normal text (`getComputedStyle` → `font-size: 12px;
font-weight: 600`), so it needs **4.5:1**. Its ground is `--app-surface-muted` — confirmed
live, `rgb(251,233,239)` light / `rgb(44,30,33)` dark; the link's own background is
`rgba(0,0,0,0)`, so the strip is the effective ground, not white.

### Old vs new, both schemes (recomputed from `src/theme/tokens.ts`)

| scheme | ground (`--app-surface-muted`) | **old** `.utilityLink:hover` = `--app-brand` | ratio        | **new** = `--app-text` | ratio       | AA 4.5 |
| ------ | ------------------------------ | -------------------------------------------- | ------------ | ---------------------- | ----------- | ------ |
| light  | `#FBE9EF`                      | `#D6006E`                                    | **4.41:1** ✗ | `#1C1416`              | **15.51:1** | pass   |
| dark   | `#2C1E21`                      | `#F25F97`                                    | 5.22:1       | `#FBEEF1`              | **14.15:1** | pass   |

The old light figure reproduces the previous review's **4.41:1** exactly, and the new value
clears AA by a factor of 3.4. Live computed styles agree to the byte:

```
light  hover color rgb(28,20,22)  on rgb(251,233,239)   →  15.51:1   (--app-text on --app-surface-muted)
dark   hover color rgb(251,238,241) on rgb(44,30,33)    →  14.15:1
```

**"Hover of hover" check.** There is no second nested surface: hovering the `.utilityLink`
sets only `color` and `text-decoration`; the parent `.utilityBar` and `.utilityInner` take
no `:hover` background. I re-read the ancestor chain at hover time in both schemes and the
effective ground stayed `--app-surface-muted` (`rgb(251,233,239)` / `rgb(44,30,33)`). The
link also has an `:active` rule (emitted alongside `:hover` by Mantine's mixin) with the
same `--app-text` colour, so the pressed state is covered by the same 15.51:1 / 14.15:1.

### Every other header hover/focus/active colour (no remaining AA failure)

All values recomputed from tokens and spot-checked live in the browser:

| state                                     | colour / ground                                   | light              | dark               | needs |
| ----------------------------------------- | ------------------------------------------------- | ------------------ | ------------------ | ----- |
| `.utilityLink` rest                       | `--app-text-muted` on muted                       | 8.42:1             | 7.35:1             | 4.5   |
| `.tagline`                                | `--app-text-muted` on muted                       | 8.42:1             | 7.35:1             | 4.5   |
| `.navLink` rest                           | `--app-text-muted` on raised                      | 9.83:1             | 8.02:1             | 4.5   |
| `.navLink:hover`                          | `--app-text` on `--app-surface-hover`             | 16.39:1            | 13.15:1            | 4.5   |
| `.navLink[data-active]`                   | `--app-text` on raised                            | 18.09:1            | 15.44:1            | 4.5   |
| active rule `::after`                     | `--app-brand` on raised                           | 5.14:1             | 5.69:1             | 3     |
| `.iconAction` rest / hover                | muted → `--app-text` on hover surface             | 9.83 / 16.39       | 8.02 / 13.15       | 4.5   |
| `.mantine-ActionIcon-root` rest / hover   | same                                              | 9.83 / 16.39       | 8.02 / 13.15       | 4.5   |
| burger bars                               | `--app-text` on raised                            | 18.09:1            | 15.44:1            | 3     |
| focus ring (all 12 header focusables)     | `--app-focus-ring` on raised / muted / hover      | 5.14 / 4.41 / 4.66 | 7.17 / 6.57 / 6.11 | 3     |
| primary CTA rest                          | `--app-brand-contrast` on `--app-brand`           | 5.14:1             | 5.91:1             | 4.5   |
| primary CTA hover                         | `--app-brand-contrast` on `--app-brand-soft-text` | 7.76:1             | 11.13:1            | 4.5   |
| brand wordmark full stop (`--app-accent`) | on raised                                         | 4.88:1             | 7.71:1             | 4.5   |

Focus ring, live tab-walk over the production build (element names read from the DOM):

```
light  Track an enquiry / Contact us / Life Events — home / All vendors / Venues /
       Photography & Film / Planning & Decor / Catering / All categories /
       Search vendors / Switch to dark theme / Sign in
       → all: 2px solid rgb(214,0,110)   (--app-focus-ring, light)
dark   the same twelve
       → all: 2px solid rgb(248,127,174) (--app-focus-ring, dark)
```

No white ring survives anywhere, and no header colour is below AA. The one number that is
below 4.5 in the whole table — focus ring on the light muted strip, 4.41:1 — is a
non-text/graphical indicator governed by 1.4.11 (3:1), so it passes.

**Footnote — the commit message quotes 16.94:1 for the new hover; that figure is not
reproducible.** The true token pair is **15.51:1** (`#1C1416` on `#FBE9EF`). I searched
every token value and no pair yields 16.94 (nearest: `--app-text` on `--app-surface-hover`
= 16.39, on `--app-surface` = 17.16). This is a commit-message-only inaccuracy; the code is
correct and the authored CSS comment quotes no figure. See §9, finding L-2.

---

## 3. Defect 2 — the burger override is now live (browser proof)

Mantine paints the bars from `background-color: var(--burger-color)`
(`node_modules/@mantine/core/styles/Burger.css`, `.m_d4fb9cad` and its `::before`/`::after`;
the var is set per scheme by a zero-specificity `:where([data-mantine-color-scheme=…])
.m_fea6bf1a` rule, so the header's two-class selector wins). Measured at **390×844**, both
themes, site-header `<header>` only. Bar colours are the middle bar plus the `::before` and
`::after` pseudo-elements of `.mantine-Burger-burger`:

| mutation at runtime                      | `--burger-color` | middle bar         | top bar            | bottom bar         |
| ---------------------------------------- | ---------------- | ------------------ | ------------------ | ------------------ |
| **light, as shipped**                    | `#1C1416`        | `rgb(28,20,22)`    | `rgb(28,20,22)`    | `rgb(28,20,22)`    |
| light, `--burger-color: rgb(255,0,0)`    | `rgb(255,0,0)`   | `rgb(255,0,0)`     | `rgb(255,0,0)`     | `rgb(255,0,0)`     |
| light, reset                             | `#1C1416`        | `rgb(28,20,22)`    | `rgb(28,20,22)`    | `rgb(28,20,22)`    |
| light, **old fix** `color: rgb(0,255,0)` | `#1C1416`        | `rgb(28,20,22)`    | `rgb(28,20,22)`    | `rgb(28,20,22)`    |
| **dark, as shipped**                     | `#FBEEF1`        | `rgb(251,238,241)` | `rgb(251,238,241)` | `rgb(251,238,241)` |
| dark, `--burger-color: rgb(255,0,0)`     | `rgb(255,0,0)`   | `rgb(255,0,0)`     | `rgb(255,0,0)`     | `rgb(255,0,0)`     |
| dark, **old fix** `color: rgb(0,255,0)`  | `#FBEEF1`        | `rgb(251,238,241)` | `rgb(251,238,241)` | `rgb(251,238,241)` |

(450ms waits after each write — Mantine transitions `background-color` over 300ms, and an
immediate read returns the pre-transition frame.)

Conclusions, all empirically established:

- **The property is live.** Setting the deliberately wrong value `rgb(255,0,0)` turns all
  three bars red in both themes (`burger-mutated-var-390-{light,dark}.png`, where the burger
  is visibly red next to the unchanged brand tile).
- **The old declaration was inert.** Setting `color: rgb(0,255,0)` — exactly the removed
  declaration — leaves every bar at its previous colour.
- **The shipped value is the intended one.** `--burger-color` resolves to `--app-text`
  (`#1C1416` light / `#FBEEF1` dark), not Mantine's `--mantine-color-black`/`-white`. The
  bars are visible in both themes (`header-390-{light,dark}.png`): near-black on white,
  near-white on near-black, 18.09:1 / 15.44:1.
- **The rule is scoped correctly**: overriding it via a `[class*="burgerSlot"]
[class*="mantine-Burger-root"]` rule also recolours the bars to lime, then removing that
  rule restores `--app-text`. Nothing else in the header sets `--burger-color`.

---

## 4. Defect 3 — stale docblock

`src/components/layout/SiteHeader.tsx:13-31` now reads:

- `"two tiers on neutral surfaces, with the brand reserved for action"` — matches the CSS
  (`.header`/`.mainBar` `--app-surface-raised`, `.utilityBar` `--app-surface-muted`). ✅
- `"The two tiers are separated by a surface step — a muted strip above a raised bar"`
  — matches `.utilityBar` vs `.mainBar`. ✅
- `"An earlier revision filled both bars with it, which measured as a WCAG AA failure in
dark mode (white nav text on the dark-scheme light pink, 3.06:1)"` — reproduces the round-1
  figure exactly. ✅
- `"See the header comment in SiteHeader.module.css for the measurements."` — the CSS header
  comment does carry them. ✅
- The old claims ("magenta ground", "the same hue at two depths", "the header is the single
  largest use of the accent budget") are gone. ✅

Two imprecisions remain in the rewritten block; both are Low and documentation-only — see
§9 findings L-1 and L-3. Neither contradicts the CSS; one is an internal inconsistency with
the CSS header comment, the other is an undercount of the brand's appearances.

---

## 5. Defect 4 — the "2px" comment

`src/components/layout/HeaderNav.tsx:16` now says **"a 3px brand indicator under the tab"**.
The rule it describes is:

```css
.navLink[data-active]::after {
  /* SiteHeader.module.css:219 */
  inset-inline: rem(6px);
  inset-block-end: 0;
  height: rem(3px); /* :224 */
  background-color: var(--app-brand);
}
```

Measured live on `/vendors?category=venues` in both schemes: `::after` box =
**`height: 3px`**, `width: 82.55px`, `background-color: rgb(214,0,110)` (light) /
`rgb(242,95,151)` (dark), on the raised bar. The comment matches the implementation. ✅

---

## 6. Diff review — `git show 7a505fb`

Diff is **4 files, +442/−14**, and the 418-line addition is a document.

| file                                          | change                                                                                                           | assessment                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/components/layout/SiteHeader.module.css` | +13/−4: `.utilityLink:hover` colour swap (with comment); `.burgerSlot` `color` → `--burger-color` (with comment) | On-thesis, minimal, exactly the two reported defects |
| `src/components/layout/SiteHeader.tsx`        | +23/−12: docblock rewrite                                                                                        | Exactly defect 3                                     |
| `src/components/layout/HeaderNav.tsx`         | +1/−1: comment "2px" → "3px"                                                                                     | Exactly defect 4                                     |
| `docs/research/review-header-branch.md`       | +418 new                                                                                                         | Round-1 reviewer report, committed verbatim          |

- **No scope creep in code.** No dependency, no lockfile, no unrelated file, no
  business-logic edit, no behaviour change beyond the two CSS declarations. The only
  executable deltas are `.utilityLink`'s hover `color` and `.burgerSlot`'s variable name.
- **No dead code introduced.** The removed `color` declaration was dead; the replacement is
  live (proved in §3). No new selectors, no `!important`, no orphaned rules.
- **Comments accurate.** The two new inline comments state verifiable facts: the 4.41:1/0.09
  figure checks out (§2), and the claim about Mantine's bar mechanism checks out (§3).
- **The 418-line doc is a reviewer artifact** committed into `docs/research/`. It is not
  product code and has zero runtime effect. `.gitignore:60-63` says the markdown reports in
  `docs/research/` _are_ committed (only `shots/` and `tools/` are ignored), so this follows
  the repository's own stated convention. I record it as a scope observation, not a defect:
  the correction commit is 97% report by line count, which makes the functional change look
  smaller in `git log --stat` than it is.

---

## 7. Regression suite — exact count

Rebuilt first (`.next` was stale, §1), then run against the seeded test database with the
config's own server:

```console
$ source .dev-env.sh
$ npx playwright test tests/e2e/responsive-and-theme.spec.ts \
    --project=desktop-light --project=desktop-dark
Running 42 tests using 1 worker
  …
  ✓ 21 [desktop-light] › signed-in surfaces › the account area renders on a phone without overflow
  ✓ 42 [desktop-dark]  › signed-in surfaces › the account area renders on a phone without overflow

  42 passed (28.3s)
```

**Exact result: 42 passed, 0 failed, 0 flaky, 0 skipped (exit code 0)** — 21 tests × 2
projects. (Round 1 ran a `--grep` subset and reported 24; this is the full spec as
instructed, hence 42.)

---

## 8. Visual confirmation — 1440 and 390, both themes

Captured from `http://127.0.0.1:3502` (the fresh build) at 1440×900 and 390×844, scheme
forced via Mantine's storage key; files under `docs/research/shots/review2/` (gitignored).
Header is **101px** tall at both widths (100px of bars + the 1px hairline).

| file                        | read                                                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header-1440-light.png`     | Pale-pink utility strip over a white bar; dark nav labels; magenta 3px active rule under **All vendors**; magenta `Sign in` pill. Nothing washed out.                |
| `header-1440-dark.png`      | Near-black raised bar, slightly lighter utility strip, near-white labels, pink active rule, pink pill with near-black label. The old 3.06:1 failure is visibly gone. |
| `header-390-light.png`      | Burger (near-black bars) + brand tile + search + theme + `Sign in`; tagline correctly dropped; no crowding.                                                          |
| `header-390-dark.png`       | Same layout; burger bars near-white and clearly visible; pink pill with dark label.                                                                                  |
| `full-390-{light,dark}.png` | Whole homepage, 390×5445, no horizontal overflow, no broken tiles, footer and cards legible in both schemes.                                                         |

The burger is unambiguously visible in both themes, which is the visual precondition for
the §3 mutation result to mean anything.

---

## 9. Remaining findings (all Low, none blocking)

**L-1 — `docs`/comment undercount.** `src/components/layout/SiteHeader.tsx:30` says "The
brand now appears three times: the active-section underline, the single primary account CTA,
and the focus ring." The brand mark tile is a fourth, and it is the largest: `BrandMark.tsx`
paints its `<rect>` with `fill="var(--app-brand)"`. The same three-item list appears in
`SiteHeader.module.css:19`. The underlying change is still directionally correct (no
full-bleed fill), but the enumeration is not exhaustive. Severity **Low** (documentation).

**L-2 — commit-message figure not reproducible.** The `7a505fb` message says the new hover
is "`--app-text` = **16.94:1**". Computed from the tokens, `#1C1416` on `#FBE9EF` is
**15.51:1**; no token pair I tested yields 16.94. Both are far above AA, so the fix stands,
but the quoted number is wrong. Severity **Low** (commit message only; no code or CSS comment
quotes it).

**L-3 — internal inconsistency about the old budget figure.** `SiteHeader.tsx:29` says the
old header "spent **~5%** of the whole page's pixels on primary fills", while
`SiteHeader.module.css:14` (unchanged by this commit) still claims "**~7.1%** of the painted
area". Round 1 established that 7.1% is an unreproducible geometry estimate and the rendered
figure was 5.21%, so the new ~5% is the better number — but the two comments now disagree
and a reader sees 5% next to 7.1% on the same change. Severity **Low** (documentation,
pre-existing half).

**L-4 — pre-existing Suspense claim.** `SiteHeader.tsx:24` says the account affordance
"is the one thing behind `<Suspense>`". There are two boundaries: `SiteHeader.tsx:90-92`
wraps `HeaderNav` (for `usePathname` / `CLIENT_HOOK_DYNAMIC`) as well as `HeaderAccount`
(`SiteHeader.tsx:99-101`). This sentence is unchanged from `21fe637` and predates the
branch, so it is not a regression — but it is still inaccurate and directly contradicted by
the inline comment at `SiteHeader.tsx:84-88`. Severity **Low** (documentation, pre-existing).

**Explicitly not defects** (checked, passing): the sticky/scroll offset being ~22px short of
the 101px header (`globals.css:258`, `SiteShell.module.css:38`) — pre-existing, correctly
declared out of scope by the author; the 6 remaining hex literals in
`HomeHero.module.css` — outside this file's remit; the dark-surface step of 1.09:1 between
the two bars — a design judgement above the 3:1 requirement only for text, and the bars do
carry text at 15.44:1, so nothing fails.

---

## 10. Artifacts and cleanup

- Screenshots: `docs/research/shots/review2/` (gitignored) — `header-1440-*.png`,
  `header-390-*.png`, `full-390-*.png`, `burger-mutated-var-390-*.png`,
  `burger-lime-390-*.png`, plus the raw probe dumps `probe.json` / `probe2.json`.
- The `3502` server was killed and the probe scripts
  (`docs/research/tools/probe-burger.mjs`, `docs/research/tools/probe-states.mjs`,
  `/tmp/*-probe.mjs`) were deleted after the run. `git status` was clean at `7a505fb` before
  and after.
