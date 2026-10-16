/**
 * The Mantine theme.
 *
 * Design rules encoded here, all of which pages can rely on without restating
 * them:
 *
 * - one font family (Manrope) for every element, including admin tables;
 * - `brand` is the primary colour — charcoal slate, not a hue — with
 *   `primaryShade` 6 in light and 3 in dark;
 * - `autoContrast` is on and `luminanceThreshold` is 0.22, which is what makes
 *   a filled brand button legible in *both* schemes (see the measured ratios
 *   below);
 * - reduced motion is respected by Mantine's own transitions;
 * - `slate` is the neutral ramp and Mantine's `gray` ramp is remapped to it in
 *   `cssVariablesResolver`, so no second neutral family can appear anywhere.
 *
 * `createTheme` returns a plain, serialisable object — `cssVariablesResolver` is
 * a **`MantineProvider` prop**, not a theme field (passing it here is a type
 * error in 9.7.2), and no component overrides in this theme are functions.
 */
import { createTheme } from '@mantine/core';
import { palette } from './tokens';

const FONT_STACK = 'var(--font-manrope), ui-sans-serif, system-ui, sans-serif';

/**
 * Why 0.22.
 *
 * `getContrastColor` puts dark text on a fill when `luminance(fill) > theme.luminanceThreshold`,
 * and white text otherwise. The marketplace palette inverts its action colour
 * between schemes — a deep charcoal in light, a light slate in dark — so the
 * threshold has to classify both correctly with a single number:
 *
 *   light `brand[6]` #0F172A  luminance 0.009  → white  17.85:1
 *   light `brand[7]` #1E293B  luminance 0.022  → white  14.63:1
 *   dark  `brand[3]` #CBD5E1  luminance 0.657  → dark   12.02:1
 *   dark  `brand[4]` #94A3B8  luminance 0.360  → dark    6.96:1
 *
 * 0.22 sits between 0.022 and 0.360, so every one of those takes the readable
 * direction. Mantine's default of 0.3 would put *white* on the dark-scheme
 * slate (1.79:1, an AA failure). The same threshold is correct for the semantic
 * fills: light danger #C2333A (0.141 → white, 5.49:1) and dark danger #F0736F
 * (0.319 → dark, 6.59:1).
 */
export const LUMINANCE_THRESHOLD = 0.22;

export const theme = createTheme({
  fontFamily: FONT_STACK,
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
  fontSmoothing: true,

  headings: {
    fontFamily: FONT_STACK,
    fontWeight: '700',
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
  black: '#0F172A',
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
    Button: { defaultProps: { radius: 'md' } },
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
