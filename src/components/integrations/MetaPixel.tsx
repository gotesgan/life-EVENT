'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CONSENT_EVENT,
  readAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics/meta-pixel';

interface FbqWindow extends Window {
  fbq?: (...args: unknown[]) => void;
  _fbq?: unknown;
}

/**
 * The Meta Pixel loader.
 *
 * Loaded only after the visitor grants analytics consent — no consent, no
 * request to Meta, no `_fbp`/`_fbc` cookies. The Pixel ID comes from the admin
 * settings through `/api/public-config` rather than from the environment, so an
 * operator can change it without a deploy and without exposing a secret.
 *
 * SPA navigations do not reload the page, so `PageView` is sent on each pathname
 * change after the first load.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const loadedId = useRef<string | null>(null);
  const lastPath = useRef<string | null>(null);
  const onAdminSurface = pathname.startsWith('/admin');

  useEffect(() => {
    /* Hydration-safe read of an external store; see ConsentBanner. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readAnalyticsConsent());

    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<AnalyticsConsent>).detail;
      setConsent(detail ?? readAnalyticsConsent());
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (consent !== 'granted' || onAdminSurface) return;

    let cancelled = false;
    fetch('/api/public-config')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled) return;
        const id = body?.data?.metaPixelId;
        if (typeof id === 'string' && id.length > 0) setPixelId(id);
      })
      .catch(() => {
        /* Analytics must never break the page. */
      });

    return () => {
      cancelled = true;
    };
  }, [consent, onAdminSurface]);

  useEffect(() => {
    if (consent !== 'granted' || onAdminSurface || !pixelId || loadedId.current === pixelId) return;

    const win = window as FbqWindow;
    if (!win.fbq) {
      const fbq: ((...args: unknown[]) => void) & {
        queue?: unknown[];
        loaded?: boolean;
        version?: string;
      } = function (...args: unknown[]) {
        fbq.queue?.push(args);
      } as never;
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      win.fbq = fbq as never;
      win._fbq = fbq;

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.onerror = () => {
        /* Blocked by an extension or the network: nothing more to do. */
      };
      document.head.appendChild(script);
    }

    win.fbq?.('init', pixelId);
    win.fbq?.('track', 'PageView');
    loadedId.current = pixelId;
    lastPath.current = pathname;
  }, [consent, pixelId, pathname, onAdminSurface]);

  useEffect(() => {
    if (onAdminSurface || !pixelId || loadedId.current !== pixelId) return;
    if (lastPath.current === pathname) return;
    (window as FbqWindow).fbq?.('track', 'PageView');
    lastPath.current = pathname;
  }, [pathname, pixelId, onAdminSurface]);

  return null;
}
