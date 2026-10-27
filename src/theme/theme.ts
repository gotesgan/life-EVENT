/**
 * The Mantine theme.
 *
 * Design rules encoded here, all of which pages can rely on without restating
 * them:
 *
 * - two families with fixed jobs: Bodoni Moda for display headings and the
 *   wordmark, Jost for body, controls, tables and admin (the maximum the style
 *   guide allows is two);
 * - `brand` is the primary colour — warm ink, not a hue — with
 *   `primaryShade` 6 in light and 3 in dark;
 * - `autoContrast` is on and `luminanceThreshold` is 0.22, which is what makes
 *   a filled brand button legible in *both* schemes (see the measured ratios
 *   below);
 * - reduced motion is respected by Mantine's own transitions;
 * - `stone` is the warm neutral ramp and Mantine's `gray` ramp is remapped to it in
 *   `cssVariablesResolver`, so no second neutral family can appear anywhere.
 *
 * `createTheme` returns a plain, serialisable object — `cssVariablesResolver` is
 * a **`MantineProvider` prop**, not a theme field (passing it here is a type
 * error in 9.7.2), and no component overrides in this theme are functions.
 */
import { createTheme } from '@mantine/core';
import { palette } from './tokens';

const FONT_BODY = 'var(--font-body), ui-sans-serif, system-ui, sans-serif';
const FONT_DISPLAY = 'var(--font-display), ui-serif, Georgia, serif';

/**
 * Why 0.22.
 *
 * `getContrastColor` puts dark text on a fill when `luminance(fill) > theme.luminanceThreshold`,
 * and white text otherwise. The marketplace palette inverts its action colour
 * between schemes — warm ink in light, warm bone in dark — so the
 * threshold has to classify both correctly with a single number:
 *
 *   light `brand[6]` #191512  luminance 0.0079 → white  18.15:1
 *   light `brand[7]` #2A2520  luminance 0.0192 → white  15.17:1
 *   dark  `brand[3]` #E3DACA  luminance 0.7074 → dark   13.70:1
 *   dark  `brand[4]` #C9C2B6  luminance 0.5438 → dark   10.74:1
 *
 * 0.22 sits between 0.0192 and 0.5438, so every one of those takes the readable
 * direction. Mantine's default of 0.3 would put *white* on the dark-scheme bone
 * fill (1.39:1, an AA failure). The same threshold is correct for the semantic
 * fills: light danger #8E1B1B (0.0661 → white, 9.04:1) and dark danger #F08A82
 * (0.3831 → dark, 7.84:1).
 */
export const LUMINANCE_THRESHOLD = 0.22;

export const theme = createTheme({
  fontFamily: FONT_BODY,
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
  fontSmoothing: true,

  headings: {
    fontFamily: FONT_DISPLAY,
    fontWeight: '600',
    textWrap: 'balance',
    sizes: {
      h1: { fontSize: 'var(--text-h1-size)', lineHeight: 'var(--text-h1-leading)' },
      h2: { fontSize: 'var(--text-h2-size)', lineHeight: 'var(--text-h2-leading)' },
      h3: { fontSize: 'var(--text-h3-size)', lineHeight: 'var(--text-h3-leading)' },
      h4: { fontSize: 'var(--text-card-title-size)', lineHeight: 'var(--text-card-title-leading)' },
      h5: { fontSize: 'var(--text-label-size)', lineHeight: 'var(--text-label-leading)' },
      h6: { fontSize: 'var(--text-caption-size)', lineHeight: 'var(--text-caption-leading)' },
    },
  },

  colors: palette,
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 3 },
  white: '#FFFFFF',
  black: '#12100D',
  autoContrast: true,
  luminanceThreshold: LUMINANCE_THRESHOLD,

  defaultRadius: 'md',
  focusRing: 'auto',
  respectReducedMotion: true,
  cursorType: 'pointer',

  /* Type scale. `md` is the default body size and matches `--text-body`. */
  fontSizes: {
    xs: '0.75rem',
    sm: '0.8125rem',
    md: '0.9375rem',
    lg: '1.0625rem',
    xl: '1.25rem',
  },
  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.6',
    lg: '1.55',
    xl: '1.5',
  },

  /* Spacing keeps Mantine's xs…xl names; the product-specific rhythm lives in
     `--app-gutter`, `--app-section-gap`, `--app-stack-gap`. */
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.25rem',
  },

  /* Controls get `md` (8px), panels get `lg` (14px). Nothing is pill-shaped
     except status chips and badges, which ask for `radius="xl"`/`--app-radius-pill`. */
  radius: {
    xs: '0.25rem',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.875rem',
    xl: '1.25rem',
  },

  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
    sm: '0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px -6px rgba(15, 23, 42, 0.12)',
    md: 'var(--app-shadow-card)',
    lg: '0 12px 32px -16px rgba(15, 23, 42, 0.22)',
    xl: 'var(--app-shadow-overlay)',
  },

  components: {
    Button: { defaultProps: { radius: 'md', autoContrast: true } },
    ActionIcon: { defaultProps: { radius: 'md' } },
    TextInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { radius: 'lg', withBorder: true } },
    Paper: { defaultProps: { radius: 'lg' } },
    Modal: { defaultProps: { radius: 'lg', centered: true } },
    Drawer: { defaultProps: { radius: 'lg' } },
    Badge: { defaultProps: { radius: 'md' } },
    Tooltip: { defaultProps: { radius: 'md' } },
    Table: { defaultProps: { horizontalSpacing: 'md', verticalSpacing: 'sm' } },
  },
});

export type AppTheme = typeof theme;
