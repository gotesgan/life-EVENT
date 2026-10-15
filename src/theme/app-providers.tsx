/**
 * Client provider boundary.
 *
 * `MantineProvider` is a Client Component, and `theme` carries a
 * `cssVariablesResolver` function. A Server Component cannot serialise a
 * function prop across the RSC boundary, so the provider chain must be created
 * *inside* a client module — this one. The root layout renders
 * `<AppProviders>{children}</AppProviders>` and nothing else crosses the
 * boundary.
 *
 * Keeping the chain here also means `appColorSchemeManager` (a client module
 * export) is used where it is defined, rather than being passed from the server.
 */
'use client';

import type { ReactNode } from 'react';
import { MantineProvider, type MantineColorScheme } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';
import { cssVariablesResolver } from './css-variables-resolver';
import { appColorSchemeManager } from './color-scheme-manager';

export interface AppProvidersProps {
  children: ReactNode;
  /** Must match the `defaultColorScheme` given to `ColorSchemeScript`. */
  defaultColorScheme?: MantineColorScheme;
}

export function AppProviders({ children, defaultColorScheme = 'auto' }: AppProvidersProps) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={defaultColorScheme}
      colorSchemeManager={appColorSchemeManager}
      cssVariablesResolver={cssVariablesResolver}
    >
      {/* `settings` is required by DatesProvider in Mantine 9. */}
      <DatesProvider settings={{ locale: 'en', firstDayOfWeek: 1, consistentWeeks: true }}>
        <ModalsProvider>
          <Notifications position="bottom-right" limit={5} />
          {children}
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
