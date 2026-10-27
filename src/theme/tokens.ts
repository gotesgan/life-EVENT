/**
 * Design tokens — the single source of truth for colour, surface, motion and
 * rhythm.
 *
 * Two layers:
 *
 * 1. `palette` — seven Mantine colour tuples (10 shades each, lightest →
 *    darkest). Nothing else in the codebase may define a hex value.
 * 2. `lightSchemeTokens` / `darkSchemeTokens` / `sharedTokens` — semantic CSS
 *    custom properties consumed by components. They are emitted by
 *    `cssVariablesResolver`, so `var(--app-surface)` is already scheme-correct
 *    with no JavaScript and no hydration risk.
 *
 * ## The visual world
 *
 * **Ink & vermilion.** The reference is an editorial photography house: a
 * near-black ground, warm bone type, and one deep vermilion mark — the colour is
 * spent almost entirely on action, "featured" and "verified", never on
 * decoration. The neutrals are a warm stone family rather than the previous cool
 * slate, so photographs sit on paper rather than on a screen. The single accent
 * is sindoor/vermilion, which carries the Indian wedding register without the
 * candy-pink cast the earlier plum ramp produced.
 *
 * Coverage budget, enforced by review rather than by code: neutrals ≥90% of
 * painted area, ink ≤9%, primary (ink fill) ≤4%, accent (vermilion) ≤1.5%, and
 * semantic tones ≤3% combined.
 *
 * ## Measured contrast
 *
 * Every pair below was computed from relative luminance, not estimated. The rule
 * that shapes the palette: in the light scheme the action colour is near-black
 * and takes **bone/white** text; in the dark scheme it is light warm stone and
 * takes **near-black** text. Both directions clear 4.5:1 with the same
 * `luminanceThreshold` of 0.22 — see `theme.ts`.
 */
import type { MantineColorsTuple } from '@mantine/core';

/* -------------------------------------------------------------------------- */
/* Palette                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Primary. **Warm ink** — links, primary actions, active navigation.
 *
 * One action colour for the whole product, and it is deliberately neutral: a
 * marketplace needs the eye to learn a single "this does something" signal, and
 * spending it on a hue (headings, badges, borders) spends the affordance itself.
 * The ramp is role-keyed rather than a smooth sweep because Mantine reads it in
 * two directions:
 *
 *   * `primaryShade.light = 6` → #191512: white text, 18.15:1.
 *   * `primaryShade.dark  = 3` → #E3DACA: near-black text, 13.70:1.
 *   * shade 7 is deliberately **lighter** than shade 6, so the filled-button
 *     hover raises the fill (#191512 → #2A2520) instead of deepening it.
 */
export const brand: MantineColorsTuple = [
  '#FBF9F6',
  '#F4F0E9',
  '#E7E1D6',
  '#E3DACA',
  '#C9C2B6',
  '#8A7F6E',
  '#191512',
  '#2A2520',
  '#3B342C',
  '#4C4338',
];

/**
 * Secondary. **Vermilion** (sindoor red) — the wedding register, featured and
 * verified marks, and the hero stage's accent.
 *
 * Never a large fill: the tint steps carry badges and soft callouts, and shade 6
 * is the only step used as text (measured 6.81:1 on the canvas). The previous
 * accent was amber; vermilion reads as an Indian wedding material rather than a
 * generic "premium" gold, and it is the one hue in a warm-neutral system.
 */
export const accent: MantineColorsTuple = [
  '#FDF3F0',
  '#FBE4DE',
  '#F6C8BC',
  '#F0987F',
  '#E57C68',
  '#D4563F',
  '#A8201A',
  '#8A1A15',
  '#6E1511',
  '#520F0C',
];

/**
 * **Warm stone** neutral. Replaces Mantine's `gray` ramp everywhere, so no second
 * neutral family leaks in. This is the wall: ≥90% of the painted area.
 *
 * The previous ramp was cool slate (`#F8FAFC`, `#F1F5F9`), which made every
 * surface read as a screen; warm stone makes photographs and paper-like type sit
 * on a page instead. A white card separates from the canvas by luminance alone.
 */
export const stone: MantineColorsTuple = [
  '#FBF9F6',
  '#F6F2EC',
  '#ECE6DD',
  '#DCD4C8',
  '#BCB2A3',
  '#948A7B',
  '#6E6456',
  '#4E463B',
  '#2B2721',
  '#1A1714',
];

/** Success. Signal green for confirmed and verified states. */
export const success: MantineColorsTuple = [
  '#EFFAF4',
  '#D6F2E3',
  '#A9E5C6',
  '#5FC98F',
  '#4FBE84',
  '#2FA46B',
  '#1B7F4B',
  '#166742',
  '#145436',
  '#0E3C27',
];

/** Warning. Ochre — "needs attention", never "error". */
export const warning: MantineColorsTuple = [
  '#FDF6EA',
  '#F9EACB',
  '#F1D397',
  '#E0A046',
  '#C4842C',
  '#A66A12',
  '#8A5A00',
  '#6E4700',
  '#553700',
  '#3A2500',
];

/**
 * Danger. Deep crimson — destructive actions and failures.
 *
 * Deliberately darker and less orange than the vermilion accent so a rejection
 * badge cannot be mistaken for a "featured" mark; it is never used as decoration.
 */
export const danger: MantineColorsTuple = [
  '#FDF2F2',
  '#FDE0E0',
  '#FAC2C3',
  '#F08A82',
  '#E46363',
  '#C43A38',
  '#A02020',
  '#8E1B1B',
  '#701414',
  '#521010',
];

/** Dark-theme surfaces and primary dark text, lightest → deepest. Warm, never cool. */
export const dark: MantineColorsTuple = [
  '#F7F3EC',
  '#D8CFC0',
  '#B4A896',
  '#948878',
  '#7A6F60',
  '#5C5347',
  '#403A32',
  '#2A2521',
  '#1A1714',
  '#12100D',
];

/**
 * The complete palette handed to `createTheme`. `stone` deliberately replaces
 * Mantine's `gray` ramp (see `css-variables-resolver.ts`) so every neutral in
 * the product comes from one family.
 */
export const palette = { brand, accent, stone, success, warning, danger, dark } as const;

/*
 * Scheme-dependent surface ramp, kept here as comments because these four
 * values are the ones a reviewer will want to sanity-check:
 *
 *              darkest ──────────────────────────────► lightest
 *   light:  sunken #E7E0D5 · muted #F2EDE5 · surface #FAF7F2 · raised #FFFFFF
 *   dark:   sunken #0B0A08 · surface #12100D · raised #1A1714 · muted #24201B
 *
 * In light mode the canvas is a warm bone off-white and cards are pure white,
 * so elevation reads as "brighter is higher" and a white card separates from the
 * wall without needing a shadow. In dark mode elevation reads as "lighter is
 * higher" on the palette steps 9 → 8 → 7, with one derived step below the canvas
 * for recessed wells.
 */

/* -------------------------------------------------------------------------- */
/* Semantic tokens — light                                                     */
/* -------------------------------------------------------------------------- */

export const lightSchemeTokens = {
  /* Surfaces: the wall is warm bone (#FAF7F2) and cards are pure white, so
     elevation reads as "brighter is higher" and a photograph is the only colour
     on a browse grid. The muted/sunken steps are the same paper family one and
     two tones down. */
  '--app-surface': '#FAF7F2',
  '--app-surface-raised': '#FFFFFF',
  '--app-surface-muted': '#F2EDE5',
  '--app-surface-sunken': '#E7E0D5',
  '--app-surface-hover': '#F2EDE5',

  /* Borders. `border` is a decorative hairline and carries no contrast duty.
     `border-strong` outlines an actual control, so it must clear the 3:1
     non-text requirement of WCAG 1.4.11 — measured 3.68:1 on the canvas and
     3.37:1 on the muted step. */
  '--app-border': '#E7E0D5',
  '--app-border-strong': '#8A7F6E',

  /* Text. All three clear 4.5:1 on the canvas, the muted step and white.
     Measured on canvas: text 16.70:1, muted 7.06:1, subtle 4.97:1; worst case
     is subtle on muted at 4.56:1. */
  '--app-text': '#1A1714',
  '--app-text-muted': '#5C5347',
  '--app-text-subtle': '#746A5B',

  /* Brand — the action colour. Warm ink, not a hue: `brand-soft` is a tint for
     quiet emphasis (selected filter, active nav row), never a large fill. */
  '--app-brand': '#191512',
  '--app-brand-soft': 'rgba(25, 21, 18, 0.06)',
  '--app-brand-soft-hover': 'rgba(25, 21, 18, 0.11)',
  '--app-brand-soft-text': '#2A2520',
  '--app-brand-contrast': '#FFFFFF',

  /* Accent — vermilion, for featured and the wedding register. Text-safe on the
     canvas (measured 6.81:1), and the soft-tint text clears 8.19:1 on its own
     tint. It is the only chromatic hue in the system. */
  '--app-accent': '#A8201A',
  '--app-accent-soft': 'rgba(168, 32, 26, 0.12)',
  '--app-accent-soft-hover': 'rgba(168, 32, 26, 0.18)',
  '--app-accent-soft-text': '#7A1712',

  /* Success */
  '--app-success': '#1B7F4B',
  '--app-success-soft': 'rgba(27, 127, 75, 0.12)',
  '--app-success-soft-hover': 'rgba(27, 127, 75, 0.18)',
  '--app-success-soft-text': '#145436',

  /* Warning */
  '--app-warning': '#8A5A00',
  '--app-warning-soft': 'rgba(138, 90, 0, 0.12)',
  '--app-warning-soft-hover': 'rgba(138, 90, 0, 0.18)',
  '--app-warning-soft-text': '#613900',

  /* Danger. Deep crimson, deliberately darker than the vermilion accent so a
     rejection cannot read as a "featured" mark. Measured 8.46:1 on the canvas. */
  '--app-danger': '#8E1B1B',
  '--app-danger-soft': 'rgba(142, 27, 27, 0.12)',
  '--app-danger-soft-hover': 'rgba(142, 27, 27, 0.18)',
  '--app-danger-soft-text': '#6E1414',

  /* The colour to set on a *saturated* fill in this scheme. In light every
     semantic tone is a dark colour, so it is white; in dark every semantic tone
     is a light colour, so it is the near-black below. One token instead of six
     per-tone contrast tokens. */
  '--app-contrast': '#FFFFFF',

  /* Focus + overlays */
  '--app-focus-ring': '#191512',
  '--app-overlay': 'rgba(26, 23, 20, 0.60)',

  /* Elevation. E0 is the default and is *not* a shadow — a resting card is a 1px
     border on a white surface. Shadows are reserved for things that float above
     the page, so 95% of the app paints none. Tinted with the warm ink rather than
     pure black, so a shadow never adds a cold cast. */
  '--app-shadow-raised': '0 1px 2px rgba(26, 23, 20, 0.06), 0 2px 8px -3px rgba(26, 23, 20, 0.10)',
  '--app-shadow-overlay':
    '0 1px 2px rgba(26, 23, 20, 0.05), 0 10px 28px -14px rgba(26, 23, 20, 0.16)',
  '--app-shadow-card': '0 1px 2px rgba(26, 23, 20, 0.05), 0 10px 28px -14px rgba(26, 23, 20, 0.16)',
  '--app-shadow-top': '0 28px 72px -18px rgba(26, 23, 20, 0.30)',
  '--app-shadow-overlay-strong': '0 28px 72px -18px rgba(26, 23, 20, 0.3)',
} as const;

/* -------------------------------------------------------------------------- */
/* Semantic tokens — dark                                                      */
/* -------------------------------------------------------------------------- */

export const darkSchemeTokens = {
  '--app-surface': '#12100D',
  '--app-surface-raised': '#1A1714',
  '--app-surface-muted': '#24201B',
  '--app-surface-sunken': '#0B0A08',
  '--app-surface-hover': '#221E19',

  /* Raised, not lowered: on dark ground a hairline must be *lighter* than the
     surface to be perceptible, and a control outline must still clear 3:1 —
     `border-strong` measures 4.83:1 on the canvas and 4.12:1 on the muted step. */
  '--app-border': '#302A24',
  '--app-border-strong': '#8A7F6E',

  /* Re-tuned so muted and subtle hold ≥4.5:1 on the canvas, the muted step and
     raised surfaces. Measured on canvas: text 17.17:1, muted 9.91:1, subtle
     7.03:1; worst case is subtle on muted at 5.99:1. */
  '--app-text': '#F7F3EC',
  '--app-text-muted': '#C4BAAB',
  '--app-text-subtle': '#A79C8B',

  /* The action colour inverts: a warm bone fill with near-black text, because a
     dark fill is invisible against a near-black canvas. Measured 13.70:1. */
  '--app-brand': '#E3DACA',
  '--app-brand-soft': 'rgba(227, 218, 202, 0.14)',
  '--app-brand-soft-hover': 'rgba(227, 218, 202, 0.22)',
  '--app-brand-soft-text': '#EDE6DA',
  '--app-brand-contrast': '#12100D',

  '--app-accent': '#F0987F',
  '--app-accent-soft': 'rgba(240, 152, 127, 0.18)',
  '--app-accent-soft-hover': 'rgba(240, 152, 127, 0.26)',
  '--app-accent-soft-text': '#F8C3B4',

  '--app-success': '#5FC98F',
  '--app-success-soft': 'rgba(95, 201, 143, 0.18)',
  '--app-success-soft-hover': 'rgba(95, 201, 143, 0.26)',
  '--app-success-soft-text': '#A9E5C6',

  '--app-warning': '#E0A046',
  '--app-warning-soft': 'rgba(224, 160, 70, 0.18)',
  '--app-warning-soft-hover': 'rgba(224, 160, 70, 0.26)',
  '--app-warning-soft-text': '#F0C684',

  '--app-danger': '#F08A82',
  '--app-danger-soft': 'rgba(240, 138, 130, 0.18)',
  '--app-danger-soft-hover': 'rgba(240, 138, 130, 0.26)',
  '--app-danger-soft-text': '#FAC2C3',

  /* Every dark-scheme semantic tone is a light colour, so a saturated fill takes
     the near-black. */
  '--app-contrast': '#12100D',

  '--app-focus-ring': '#E3DACA',
  '--app-overlay': 'rgba(8, 6, 4, 0.72)',

  /* Dark alphas are far higher than light ones on purpose: a 5%-black shadow on
     a near-black canvas is invisible, so elevation has to be bought with depth
     rather than with subtlety. */
  '--app-shadow-raised': '0 1px 2px rgba(0, 0, 0, 0.55), 0 2px 10px -3px rgba(0, 0, 0, 0.62)',
  '--app-shadow-overlay': '0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 32px -16px rgba(0, 0, 0, 0.72)',
  '--app-shadow-card': '0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 32px -16px rgba(0, 0, 0, 0.72)',
  '--app-shadow-top': '0 32px 80px -20px rgba(0, 0, 0, 0.80)',
  '--app-shadow-overlay-strong': '0 32px 80px -20px rgba(0, 0, 0, 0.8)',
} as const;

/* -------------------------------------------------------------------------- */
/* Scheme-independent tokens                                                   */
/* -------------------------------------------------------------------------- */

export const sharedTokens = {
  /* A light success tint for content that sits on a *dark* scrim regardless of
     the active scheme. Without it the light scheme's `--app-success` (#1B7F4B)
     would be a dark green on a dark scrim, and the alternative is a hex literal
     outside this file. */
  '--app-success-on-dark': '#7AD3A1',

  /* Text drawn on the same dark scrim. These do not flip with the scheme — the
     photograph and its `--app-overlay` are dark in both — so they are a
     three-step white ramp rather than `--app-text` and friends. Two nearly
     identical alphas (90% and 85%) were folded into one muted step; the link
     underline moved up to the subtle step so the affordance is perceivable. */
  '--app-text-on-dark': '#FBF8F2',
  '--app-text-on-dark-muted': 'rgb(251 248 242 / 90%)',
  '--app-text-on-dark-subtle': 'rgb(251 248 242 / 75%)',

  /* The homepage hero's cinematic stage. It is dark in *both* schemes — a band of
     film under the page, not a themed surface — so it cannot use `--app-surface`
     (which flips with the scheme), and `--app-overlay` is a translucent scrim
     rather than a fill. The hairline is the frame edge that separates the video
     from the band. */
  '--app-stage-surface': '#0E0C0A',
  '--app-stage-border': 'rgb(250 246 239 / 12%)',

  /* Scrims for the hero stage. The base overlay alone leaves a bright clip's
     centre too light for 14px white text, and its foot too light for the tracked
     link line, so the stage adds a soft vignette behind the copy block plus a
     short gradient under the foot line. They are shared because the stage is dark
     in both schemes. */
  '--app-stage-vignette':
    'radial-gradient(ellipse 95% 75% at 50% 42%, rgb(12 10 8 / 46%) 0%, rgb(12 10 8 / 0%) 72%)',
  '--app-stage-foot-scrim':
    'linear-gradient(to top, rgb(12 10 8 / 72%) 0%, rgb(12 10 8 / 38%) 55%, rgb(12 10 8 / 0%) 100%)',

  /* Radii. Radius cost scales with how many times it is drawn: 24 tiles at a
     generous 16px reads as a field of lozenges and the grid edges stop
     registering, so dense browse surfaces step *down*, not up. */
  '--app-radius-1': '0.25rem',
  '--app-radius-control': '0.5rem',
  '--app-radius-card-dense': '0.75rem',
  '--app-radius-card': '0.875rem',
  '--app-radius-pill': '999px',

  '--app-max-width': '1280px',
  '--app-header-height': '4rem',
  '--app-header-utility-height': '2.25rem',
  '--app-tab-bar-height': '3.25rem',
  '--app-sidebar-width': '16.5rem',

  /* Component-level rhythm. These are the only spacing values a component should
     hard-code beyond Mantine's xs…xl scale. */
  '--app-gutter': 'clamp(1rem, 0.25rem + 2.5vw, 2.5rem)',
  '--app-section-gap': 'clamp(2.5rem, 1.5rem + 3vw, 4.5rem)',
  '--app-stack-gap': '1rem',
  '--app-card-padding': 'clamp(1rem, 0.75rem + 0.75vw, 1.5rem)',
  '--app-grid-gap': '1.25rem',

  /* Motion. Five durations, three easings, and an exit that is always shorter
     than its enter — a dismissal that takes as long as an arrival feels stuck.
     Nothing in the product exceeds 280ms. */
  '--app-duration-instant': '0ms',
  '--app-duration-micro': '90ms',
  '--app-duration-fast': '140ms',
  '--app-duration-base': '200ms',
  '--app-duration-slow': '280ms',
  '--app-duration-exit': '140ms',

  '--app-ease-out': 'cubic-bezier(0.2, 0, 0, 1)',
  '--app-ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  '--app-ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/** Mantine's own neutral ramp is remapped to `stone` so no second family leaks in. */
export const grayRampTokens = Object.fromEntries(
  stone.map((shade, index) => [`--mantine-color-gray-${index}`, shade]),
) as Record<`--mantine-color-gray-${number}`, string>;

/** Every colour-bearing semantic token, in emission order. */
export type AppTokenName = keyof typeof lightSchemeTokens | keyof typeof sharedTokens;
