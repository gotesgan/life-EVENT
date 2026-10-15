/**
 * Theme barrel.
 *
 * `color-scheme-manager` is intentionally exported from its own module rather
 * than re-exported here: it is a `'use client'` module, and the root layout is a
 * Server Component. Import it directly (`@/theme/color-scheme-manager`) where a
 * client boundary is correct.
 */
export { theme, LUMINANCE_THRESHOLD } from './theme';
export { cssVariablesResolver } from './css-variables-resolver';
export {
  palette,
  brand,
  accent,
  plum,
  success,
  warning,
  danger,
  dark,
  lightSchemeTokens,
  darkSchemeTokens,
  sharedTokens,
  type AppTokenName,
} from './tokens';
export {
  COLOR_SCHEME_COOKIE_NAME,
  COLOR_SCHEME_STORAGE_KEY,
  COLOR_SCHEME_COOKIE_MAX_AGE,
  isAppColorScheme,
  resolveColorScheme,
  readColorSchemeCookie,
  writeColorSchemeCookie,
  clearColorSchemeCookie,
  type AppColorScheme,
} from './color-scheme';
