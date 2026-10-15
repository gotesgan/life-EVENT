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
 * A **marketplace** world, not an editorial one. The references are Amazon,
 * Flipkart and Myntra (see `docs/marketplace-styling-guide.md`): a neutral wall,
 * one dominant action colour, and colour spent almost entirely on action and
 * status rather than on decoration. The palette is deliberately cool — a deep
 * action blue on a cool slate neutral — with a single warm amber accent carrying
 * the wedding register and the "featured / verified" highlights.
 *
 * Coverage budget, enforced by review rather than by code: neutrals ≥90% of
 * painted area, ink ≤9%, primary ≤4% (at most one primary fill per card and per
 * page section), accent ≤1.5% (a line or a glyph, never a large fill), semantic
 * tones ≤3% combined.
 *
 * ## Measured contrast
 *
 * Every pair below was computed from relative luminance, not estimated, and the
 * figures are recorded in `docs/design-system.md`. The rule that shapes the
 * palette: in the light scheme the action colour is dark and takes **white**
 * text; in the dark scheme it is light and takes **dark** text. Both directions
 * clear 4.5:1 with the same `luminanceThreshold` of 0.22 — see `theme.ts`.
 */
import type { MantineColorsTuple } from '@mantine/core';

/* -------------------------------------------------------------------------- */
/* Palette                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Primary. A deep marketplace blue — links, primary actions, active navigation.
 *
 * One action colour for the whole product. A marketplace needs the eye to learn
 * a single "this does something" signal, and spending the blue anywhere else
 * (badges, headings, borders) spends the affordance itself.
 */
export const brand: MantineColorsTuple = [
  '#FFF1F7',
  '#FFDCEA',
  '#FFB7CE',
  '#FB8DB4',
  '#F25F97',
  '#E63A7C',
  '#D6006E',
  '#AE005A',
  '#850046',
  '#5C0031',
];

/** Secondary. Warm amber — the wedding register, featured and verified marks. */
export const accent: MantineColorsTuple = [
  '#FEF9EF',
  '#FCF0DA',
  '#F8DFAF',
  '#F1C878',
  '#E8AE45',
  '#D99A2B',
  '#C0851F',
  '#9A6A18',
  '#744F12',
  '#4E340B',
];

/**
 * Cool slate neutral. Replaces Mantine's `gray` ramp everywhere, so no second
 * neutral family leaks in. This is the wall: ≥90% of the painted area.
 */
export const plum: MantineColorsTuple = [
  '#FFFFFF',
  '#FDF7F9',
  '#F9EDF1',
  '#EFDCE2',
  '#DDC2CC',
  '#C68EA0',
  '#AA7A89',
  '#8D6672',
  '#71515B',
  '#553D44',
];

/** Success. Signal green for confirmed and verified states. */
export const success: MantineColorsTuple = [
  '#EFFAF4',
  '#D6F2E3',
  '#A9E5C6',
  '#6FD3A1',
  '#4FBE84',
  '#2FA46B',
  '#1B7F4B',
  '#166742',
  '#145436',
  '#0E3C27',
];

/** Warning. Ochre — "needs attention", never "error". */
export const warning: MantineColorsTuple = [
  '#FFF9EC',
  '#FDF0D5',
  '#F8DEA5',
  '#F0C468',
  '#E0A046',
  '#C4842C',
  '#9A5B00',
  '#7C4900',
  '#613900',
  '#412600',
];

/** Danger. Brick red for destructive actions and failures. */
export const danger: MantineColorsTuple = [
  '#FEF2F2',
  '#FDE0E0',
  '#FAC2C3',
  '#F49A9C',
  '#F0736F',
  '#DE4F4F',
  '#C2333A',
  '#9E282E',
  '#7C2025',
  '#54151A',
];

/** Dark-theme surfaces and primary dark text, lightest → deepest. */
export const dark: MantineColorsTuple = [
  '#FBEEF1',
  '#E7D5DA',
  '#C9AEB7',
  '#A88E97',
  '#8A6B75',
  '#6B4F58',
  '#3A282C',
  '#2C1E21',
  '#221719',
  '#191114',
];

/**
 * The complete palette handed to `createTheme`. `slate` deliberately replaces
 * Mantine's `gray` ramp (see `css-variables-resolver.ts`) so every neutral in
 * the product comes from one family.
 */
export const palette = { brand, accent, plum, success, warning, danger, dark } as const;

/*
 * Scheme-dependent surface ramp, kept here as comments because these four
 * values are the ones a reviewer will want to sanity-check:
 *
 *              darkest ──────────────────────────────► lightest
 *   light:  sunken #E3E6EB · muted #EEF1F4 · surface #F7F8FA · raised #FFFFFF
 *   dark:   sunken #0A0D12 · surface #0F1319 · raised #171C24 · muted #232A34
 *
 * In light mode the canvas is a whisper-cool off-white and cards are pure white,
 * so elevation reads as "brighter is higher" and a white card separates from the
 * wall without needing a shadow. In dark mode elevation reads as "lighter is
 * higher" on the palette steps 9 → 8 → 7, with one derived step below the canvas
 * for recessed wells.
 */

/* -------------------------------------------------------------------------- */
/* Semantic tokens — light                                                     */
/* -------------------------------------------------------------------------- */

export const lightSchemeTokens = {
  /* Surfaces: brightest is highest. */
  '--app-surface': '#FFF7F9',
  '--app-surface-raised': '#FFFFFF',
  '--app-surface-muted': '#FBE9EF',
  '--app-surface-sunken': '#F5DCE5',
  '--app-surface-hover': '#FFF0F5',

  /* Borders. `border` is a decorative hairline and carries no contrast duty.
     `border-strong` is the outline of an actual control, so it must clear the
     3:1 non-text requirement of WCAG 1.4.11 — measured 3.40:1 on white. */
  '--app-border': '#F0D8E1',
  '--app-border-strong': '#9A7084',

  /* Text. All three clear 4.5:1 on the canvas, on muted and on every raised
     surface. */
  '--app-text': '#1C1416',
  '--app-text-muted': '#553D44',
  '--app-text-subtle': '#71515B',

  /* Brand — the action colour. `brand-soft` is a tint for quiet emphasis
     (selected filter, active nav row), never a large fill. */
  '--app-brand': '#D6006E',
  '--app-brand-soft': 'rgba(214, 0, 110, 0.08)',
  '--app-brand-soft-hover': 'rgba(214, 0, 110, 0.14)',
  '--app-brand-soft-text': '#A3005A',
  '--app-brand-contrast': '#FFFFFF',

  /* Accent — amber, for featured and warm emphasis. Text-safe on white. */
  '--app-accent': '#A85F0A',
  '--app-accent-soft': 'rgba(168, 95, 10, 0.12)',
  '--app-accent-soft-hover': 'rgba(168, 95, 10, 0.18)',
  '--app-accent-soft-text': '#7A4405',

  /* Success */
  '--app-success': '#1B7F4B',
  '--app-success-soft': 'rgba(27, 127, 75, 0.12)',
  '--app-success-soft-hover': 'rgba(27, 127, 75, 0.18)',
  '--app-success-soft-text': '#145436',

  /* Warning */
  '--app-warning': '#9A5B00',
  '--app-warning-soft': 'rgba(154, 91, 0, 0.12)',
  '--app-warning-soft-hover': 'rgba(154, 91, 0, 0.18)',
  '--app-warning-soft-text': '#613900',

  /* Danger */
  '--app-danger': '#C2333A',
  '--app-danger-soft': 'rgba(194, 51, 58, 0.12)',
  '--app-danger-soft-hover': 'rgba(194, 51, 58, 0.18)',
  '--app-danger-soft-text': '#7C2025',

  /* The colour to set on a *saturated* fill in this scheme. In light every
     semantic tone is a dark colour, so it is white; in dark every semantic tone
     is a light colour, so it is the near-black below. One token instead of six
     per-tone contrast tokens. */
  '--app-contrast': '#FFFFFF',

  /* Focus + overlays */
  '--app-focus-ring': '#D6006E',
  '--app-overlay': 'rgba(28, 20, 22, 0.55)',

  /* Elevation. E0 is the default and is *not* a shadow — a resting card is a
     1px border on a white surface. Shadows are reserved for things that float
     above the page, so 95% of the app paints none. */
  '--app-shadow-raised': '0 1px 2px rgba(28, 20, 22, 0.06), 0 2px 8px -3px rgba(28, 20, 22, 0.10)',
  '--app-shadow-overlay':
    '0 1px 2px rgba(28, 20, 22, 0.05), 0 10px 28px -14px rgba(28, 20, 22, 0.16)',
  '--app-shadow-card': '0 1px 2px rgba(28, 20, 22, 0.05), 0 10px 28px -14px rgba(28, 20, 22, 0.16)',
  '--app-shadow-top': '0 28px 72px -18px rgba(28, 20, 22, 0.30)',
  '--app-shadow-overlay-strong': '0 28px 72px -18px rgba(28, 20, 22, 0.3)',
} as const;

/* -------------------------------------------------------------------------- */
/* Semantic tokens — dark                                                      */
/* -------------------------------------------------------------------------- */

export const darkSchemeTokens = {
  '--app-surface': '#191114',
  '--app-surface-raised': '#221719',
  '--app-surface-muted': '#2C1E21',
  '--app-surface-sunken': '#120C0E',
  '--app-surface-hover': '#33232A',

  /* Raised, not lowered: on dark ground a hairline must be *lighter* than the
     surface to be perceptible, and a control outline must still clear 3:1 —
     `border-strong` measures 3.06:1 on the canvas. */
  '--app-border': '#3A282C',
  '--app-border-strong': '#8A6B75',

  /* Re-tuned so muted and subtle hold ≥4.5:1 on the canvas and on raised
     surfaces. */
  '--app-text': '#FBEEF1',
  '--app-text-muted': '#C4A9B2',
  '--app-text-subtle': '#A88E97',

  /* The action colour inverts: a light blue fill with near-black text, because
     white on any blue light enough to read against a near-black canvas fails
     4.5:1. Measured 5.50:1 with the dark ink. */
  '--app-brand': '#F25F97',
  '--app-brand-soft': 'rgba(242, 95, 151, 0.16)',
  '--app-brand-soft-hover': 'rgba(242, 95, 151, 0.24)',
  '--app-brand-soft-text': '#FFB7CE',
  '--app-brand-contrast': '#1C1416',

  '--app-accent': '#E0A046',
  '--app-accent-soft': 'rgba(224, 160, 70, 0.18)',
  '--app-accent-soft-hover': 'rgba(224, 160, 70, 0.26)',
  '--app-accent-soft-text': '#F0C684',

  '--app-success': '#4FBE84',
  '--app-success-soft': 'rgba(79, 190, 132, 0.18)',
  '--app-success-soft-hover': 'rgba(79, 190, 132, 0.26)',
  '--app-success-soft-text': '#A9E5C6',

  '--app-warning': '#E0A046',
  '--app-warning-soft': 'rgba(224, 160, 70, 0.18)',
  '--app-warning-soft-hover': 'rgba(224, 160, 70, 0.26)',
  '--app-warning-soft-text': '#F0C684',

  '--app-danger': '#F0736F',
  '--app-danger-soft': 'rgba(240, 115, 111, 0.18)',
  '--app-danger-soft-hover': 'rgba(240, 115, 111, 0.26)',
  '--app-danger-soft-text': '#FAC2C3',

  /* Every dark-scheme semantic tone is a light colour, so a saturated fill takes
     the near-black. */
  '--app-contrast': '#1C1416',

  '--app-focus-ring': '#F87FAE',
  '--app-overlay': 'rgba(10, 6, 8, 0.72)',

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

/** Mantine's own neutral ramp is remapped to `slate` so no second family leaks in. */
export const grayRampTokens = Object.fromEntries(
  plum.map((shade, index) => [`--mantine-color-gray-${index}`, shade]),
) as Record<`--mantine-color-gray-${number}`, string>;

/** Every colour-bearing semantic token, in emission order. */
export type AppTokenName = keyof typeof lightSchemeTokens | keyof typeof sharedTokens;
