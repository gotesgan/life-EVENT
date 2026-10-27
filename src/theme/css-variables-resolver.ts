/**
 * `cssVariablesResolver` — where the semantic token layer is emitted.
 *
 * Mantine deep-merges this output over its own default resolver, so anything
 * returned here *overrides* a Mantine variable of the same name and anything
 * new is simply added. `variables` lands on `:root`; `light` and `dark` land
 * inside `[data-mantine-color-scheme='light'|'dark']` blocks. That is the whole
 * theming mechanism: `background: var(--app-surface)` in a CSS Module is
 * scheme-correct with no JavaScript, so there is nothing to hydrate-mismatch.
 *
 * Beyond the `--app-*` tokens this file does two things deliberately:
 *
 * 1. remaps Mantine's cool `gray` ramp to the warm `stone` ramp, so neutrals
 *    inside Mantine components (skeletons, table borders, dividers) match the
 *    surfaces they sit on;
 * 2. repoints Mantine's own semantic variables (`--mantine-color-body`,
 *    `-text`, `-dimmed`, `-default-border`, `-anchor`, …) at the app tokens, so
 *    a Mantine primitive used without a wrapper already looks like this system.
 */
import type { CSSVariablesResolver } from '@mantine/core';
import { darkSchemeTokens, grayRampTokens, lightSchemeTokens, sharedTokens } from './tokens';

/** Mantine variables that mean the same thing in both schemes. */
const mantineAliases = {
  '--mantine-color-body': 'var(--app-surface)',
  '--mantine-color-text': 'var(--app-text)',
  '--mantine-color-bright': 'var(--app-text)',
  '--mantine-color-dimmed': 'var(--app-text-muted)',
  '--mantine-color-placeholder': 'var(--app-text-subtle)',
  '--mantine-color-default-color': 'var(--app-text)',
  '--mantine-color-default-border': 'var(--app-border-strong)',
  '--mantine-color-error': 'var(--app-danger)',
  '--mantine-color-success': 'var(--app-success)',
  '--mantine-color-anchor': 'var(--app-brand)',
  '--mantine-color-disabled-color': 'var(--app-text-subtle)',
  '--mantine-color-disabled-border': 'var(--app-border)',
} as const;

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    ...sharedTokens,
    ...grayRampTokens,
  },

  light: {
    ...lightSchemeTokens,
    ...mantineAliases,
    '--mantine-color-default': 'var(--app-surface-raised)',
    '--mantine-color-default-hover': 'var(--app-surface-hover)',
    '--mantine-color-disabled': 'var(--app-surface-muted)',
  },

  dark: {
    ...darkSchemeTokens,
    ...mantineAliases,
    '--mantine-color-default': 'var(--app-surface-muted)',
    '--mantine-color-default-hover': 'var(--app-surface-hover)',
    '--mantine-color-disabled': 'var(--app-surface-muted)',

    /* Mantine derives the dark `light` variant by darkening shade 9 by 50%,
       which for the charcoal ramp is a near-black chip on a near-black canvas.
       Replace it with a real, desaturated stone tint and keep the chip label
       light enough to read on it. */
    '--mantine-color-brand-light': 'var(--app-brand-soft)',
    '--mantine-color-brand-light-hover': 'var(--app-brand-soft-hover)',
    '--mantine-color-brand-light-color': 'var(--app-brand-soft-text)',
  },
});
