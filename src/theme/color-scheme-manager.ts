/**
 * The hybrid colour-scheme manager.
 *
 * Mantine 9 ships `localStorageColorSchemeManager` and **no** cookie manager, so
 * this implements the verified `MantineColorSchemeManager` contract directly
 * (`{ get, set, subscribe, unsubscribe, clear }`) and writes to both stores on
 * every change.
 *
 * Read order matters and is deliberate:
 *  1. `localStorage` — the same source `ColorSchemeScript` reads in the
 *     blocking `<head>` script, so the manager can never disagree with what has
 *     already been painted;
 *  2. the cookie — used when localStorage is unavailable (private mode, cleared
 *     storage) or empty but the server saw a preference;
 *  3. the provider default.
 *
 * On the server, `window` and `document` are both absent, so `get` returns the
 * `defaultValue` the root layout resolved from the request cookie. Server and
 * client therefore agree on the first render for anything a crawler reads.
 */
'use client';

import type { MantineColorSchemeManager } from '@mantine/core';
import {
  COLOR_SCHEME_STORAGE_KEY,
  clearColorSchemeCookie,
  isAppColorScheme,
  readColorSchemeCookie,
  writeColorSchemeCookie,
} from './color-scheme';

export interface LiveEnvtColorSchemeManagerOptions {
  key?: string;
}

export function liveenvtColorSchemeManager({
  key = COLOR_SCHEME_STORAGE_KEY,
}: LiveEnvtColorSchemeManagerOptions = {}): MantineColorSchemeManager {
  let handleStorageEvent: ((event: StorageEvent) => void) | undefined;

  return {
    get: (defaultValue) => {
      if (typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem(key);
          if (isAppColorScheme(stored)) return stored;
        } catch {
          /* localStorage can throw in private mode — fall through to the cookie. */
        }
      }
      return readColorSchemeCookie() ?? defaultValue;
    },

    set: (value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Non-fatal: the cookie below still persists the choice for this browser. */
      }
      writeColorSchemeCookie(value);
    },

    subscribe: (onUpdate) => {
      handleStorageEvent = (event) => {
        if (event.storageArea !== window.localStorage || event.key !== key) return;
        if (!isAppColorScheme(event.newValue)) return;
        /* Another tab changed the scheme — keep the cookie in step so a hard
           reload renders the same scheme server-side. */
        writeColorSchemeCookie(event.newValue);
        onUpdate(event.newValue);
      };
      window.addEventListener('storage', handleStorageEvent);
    },

    unsubscribe: () => {
      if (handleStorageEvent) window.removeEventListener('storage', handleStorageEvent);
      handleStorageEvent = undefined;
    },

    clear: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      clearColorSchemeCookie();
    },
  };
}

/**
 * The manager instance handed to `MantineProvider`.
 *
 * It is created at module scope and exported as a **value**, never as a call.
 * This module is a client module, so its exports are client references: the
 * Server Component root layout can pass this object across the boundary, but it
 * must not invoke anything from it — calling a client function from the server
 * throws. Building the object once also keeps the `storage` event subscription
 * identity stable across renders.
 */
export const appColorSchemeManager = liveenvtColorSchemeManager();
