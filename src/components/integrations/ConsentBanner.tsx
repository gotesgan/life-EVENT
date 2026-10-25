'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@mantine/core';
import {
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics/meta-pixel';
import classes from './ConsentBanner.module.css';

/**
 * Analytics consent.
 *
 * Deliberately small and honest: the only thing behind "Allow" is measurement —
 * the Meta Pixel and its Conversions API events. It is not a marketing popup, and
 * declining leaves every feature on the site working. The choice is stored in
 * `localStorage` and a custom event tells the pixel loader to start immediately,
 * without a reload.
 */
export function ConsentBanner() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<AnalyticsConsent | 'unset' | null>(null);

  useEffect(() => {
    /* Hydration-safe: the server cannot know the stored choice, so it renders
       nothing and the client reads storage once after mount. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readAnalyticsConsent() ?? 'unset');
  }, []);

  /* The back office is an operator surface, not a visitor: no marketing consent. */
  if (pathname.startsWith('/admin')) return null;

  /* `null` means "not read yet" — rendering nothing avoids a hydration mismatch. */
  if (choice === null || choice !== 'unset') return null;

  function decide(value: AnalyticsConsent) {
    writeAnalyticsConsent(value);
    setChoice(value);
  }

  return (
    <div className={classes.banner} role="region" aria-label="Analytics consent">
      <p className={classes.text}>
        We use analytics cookies to measure which listings and searches lead to enquiries. Nothing
        is measured unless you allow it. <Link href="/privacy">Privacy policy</Link>
      </p>
      <div className={classes.actions}>
        <Button size="xs" variant="default" onClick={() => decide('denied')}>
          No thanks
        </Button>
        <Button size="xs" onClick={() => decide('granted')}>
          Allow analytics
        </Button>
      </div>
    </div>
  );
}
