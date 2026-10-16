import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Manrope } from 'next/font/google';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import { AppProviders } from '@/theme/app-providers';
import { darkSchemeTokens, lightSchemeTokens } from '@/theme/tokens';
import './globals.css';

/* One family, loaded once, exposed as a CSS variable so it is inherited by every
   element — public site, enquiry forms and admin tables alike. */
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: 'Live Envt',
  title: {
    default: 'Live Envt — wedding and event vendors, with real prices',
    template: '%s · Live Envt',
  },
  description:
    'Find banquet halls, photographers, decorators, caterers and more. Compare published prices, capacity and inclusions, then send one short enquiry — no phone-number chasing, no booking maze.',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Live Envt',
    title: 'Live Envt — wedding and event vendors, with real prices',
    description:
      'Compare published prices, capacity and inclusions across wedding and event vendors. One short enquiry form, sent to the vendors you choose.',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Envt — wedding and event vendors, with real prices',
    description:
      'Compare published prices, capacity and inclusions across wedding and event vendors.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  /**
   * The browser chrome colour is the scheme's **surface** colour, read from the
   * one colour source rather than duplicated here: `themeColor` used to spell
   * both surface values out as literals, the only colour literals outside
   * `src/theme`, so changing `--app-surface` would silently leave the browser
   * chrome behind.
   *
   * Why the media queries cannot follow the in-app toggle: Next renders this
   * object into a static `<meta name="theme-color" media="…">` pair in `<head>`.
   * A `<meta>` has no connection to `data-mantine-color-scheme`, which is what
   * `ColorSchemeScript` sets before first paint and what the toggle rewrites, so
   * following the manual preference would take client JS that patches the meta
   * tags after hydration — and the correct value would only appear once that JS
   * ran. `media` is therefore the OS preference, which is the closest a
   * server-rendered meta can get, and the page itself still renders in the
   * manually chosen scheme (see `src/theme/color-scheme-manager.ts`).
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: lightSchemeTokens['--app-surface'] },
    { media: '(prefers-color-scheme: dark)', color: darkSchemeTokens['--app-surface'] },
  ],
};

/**
 * Root layout — a Server Component.
 *
 * Props are typed explicitly rather than with the generated `LayoutProps<'/'>`
 * helper, so `pnpm typecheck` passes on a clean checkout without requiring a
 * prior `next build` to emit `.next/types`.
 *
 * ## Provider chain
 *
 * `MantineProvider` is a Client Component and needs two function-valued props
 * (`cssVariablesResolver`, `colorSchemeManager`) plus a theme object. A Server
 * Component cannot serialise functions across the RSC boundary — verified:
 * passing `cssVariablesResolver` here fails the build with "Functions cannot be
 * passed directly to Client Components". The whole chain therefore lives in
 * `AppProviders` (`src/theme/app-providers.tsx`, `'use client'`), and this
 * layout renders exactly one boundary.
 *
 * ## Colour scheme, and why this layout does not read the cookie
 *
 * `liveenvtColorSchemeManager` mirrors the preference into **both**
 * `localStorage` and a `SameSite=Lax` cookie named `liveenvt-color-scheme`, so
 * the cookie *is* written and *is* available server-side for anything that can
 * afford a dynamic read.
 *
 * This layout deliberately does not call `cookies()`. It was implemented that
 * way first and the production build failed, exactly as
 * `docs/nextjs-16-notes.md` §4 predicts:
 *
 *   Error: Route "/": Next.js encountered uncached or runtime data during
 *   prerendering. … accessed outside of `<Suspense>` prevents the route from
 *   being prerendered … [block] Set `export const instant = false` to allow a
 *   blocking route.
 *
 * `next.config.ts` sets `cacheComponents: true`, `cookies()` in the root layout
 * cannot sit inside a `<Suspense>` (the value is needed for an `<html>`
 * attribute, above every boundary), so the only ways to keep it are
 * `export const instant = false` — which opts the *entire* app out of the static
 * shell and PPR — or dropping `cacheComponents`. Both are app-wide
 * architectural changes, so they are left to the team.
 *
 * There is no flash of the wrong theme regardless: `ColorSchemeScript` renders a
 * blocking inline script in `<head>` that reads the same localStorage key this
 * system writes (`liveenvt-color-scheme`) and sets
 * `data-mantine-color-scheme` on `<html>` **before first paint**, resolving
 * `auto` against `prefers-color-scheme`. `mantineHtmlProps` supplies
 * `suppressHydrationWarning`, which is what makes that safe.
 *
 * Cost of this choice, stated plainly: the HTML source always ships
 * `data-mantine-color-scheme="light"`; a dark-preferring visitor's first painted
 * frame is already dark, but a non-JS client or a reader of raw HTML sees light.
 * Restoring a server-read scheme is a one-line change plus the `instant = false`
 * decision above. It is documented in `docs/design-system.md` §"Theming".
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} {...mantineHtmlProps}>
      <head>
        {/* Must match `COLOR_SCHEME_STORAGE_KEY` in src/theme/color-scheme.ts and
            the manager handed to MantineProvider in AppProviders. */}
        <ColorSchemeScript defaultColorScheme="auto" localStorageKey="liveenvt-color-scheme" />
      </head>
      <body>
        <AppProviders defaultColorScheme="auto">{children}</AppProviders>
      </body>
    </html>
  );
}
