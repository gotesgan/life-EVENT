/**
 * Colour-scheme persistence.
 *
 * The preference is stored **twice**:
 *
 * - in `localStorage`, which is what Mantine's `ColorSchemeScript` reads in the
 *   blocking `<head>` script, so the correct scheme is applied before first
 *   paint (no flash);
 * - in a `SameSite=Lax` cookie of the same name, which the **server** can read
 *   in the root layout, so the first HTML response already carries the right
 *   scheme for users who arrive with a preference set.
 *
 * `light | dark | auto` are all supported; `auto` defers to the OS.
 *
 * This module is deliberately framework-free and safe to import from a Server
 * Component — it only touches `document` inside guarded functions. The Mantine
 * `MantineColorSchemeManager` adapter lives in `./color-scheme-manager`.
 */

export const COLOR_SCHEME_COOKIE_NAME = 'liveenvt-color-scheme';
export const COLOR_SCHEME_STORAGE_KEY = 'liveenvt-color-scheme';
export const COLOR_SCHEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AppColorScheme = 'light' | 'dark' | 'auto';

export function isAppColorScheme(value: unknown): value is AppColorScheme {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * Normalises a raw cookie value into a scheme Mantine accepts.
 * Anything unrecognised or absent falls back to `auto` (OS preference).
 */
export function resolveColorScheme(value: string | null | undefined): AppColorScheme {
  return isAppColorScheme(value) ? value : 'auto';
}

/** Reads the persisted preference from `document.cookie`. Client-only. */
export function readColorSchemeCookie(): AppColorScheme | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COLOR_SCHEME_COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isAppColorScheme(value) ? value : undefined;
}

/** Writes the preference cookie. Client-only. */
export function writeColorSchemeCookie(value: AppColorScheme): void {
  if (typeof document === 'undefined') return;
  document.cookie = [
    `${COLOR_SCHEME_COOKIE_NAME}=${value}`,
    'path=/',
    `max-age=${COLOR_SCHEME_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ].join('; ');
}

/** Clears the preference cookie. Client-only. */
export function clearColorSchemeCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COLOR_SCHEME_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
