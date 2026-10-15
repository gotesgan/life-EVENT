import Link from 'next/link';
import { Suspense } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { Container } from '@/components/ui/Container';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { HeaderAccount, HeaderAccountFallback } from './HeaderAccount';
import { HeaderNav } from './HeaderNav';
import { MobileNav } from './MobileNav';
import classes from './SiteHeader.module.css';

/**
 * Site header — two tiers on a magenta ground.
 *
 * The shape is the Indian wedding-marketplace convention: a slim utility strip
 * for the things a returning visitor wants, above a tall brand bar carrying the
 * logo, the catalogue navigation and the account action. The two tiers are the
 * same hue at two depths, which is what makes the bar read as one object rather
 * than as two stacked toolbars.
 *
 * Server-rendered chrome: the brand, the primary nav (real catalogue links) and
 * the theme switch are all static. Only the account affordance reads the
 * session, so it is the one thing behind `<Suspense>` — the header paints
 * immediately and the sign-in/account button streams in a moment later.
 *
 * **Colour.** Both bars are the brand itself, so the header is the single
 * largest use of the accent budget on any page. That is deliberate: the header
 * is the one element present on every screen, and putting the brand there means
 * the rest of the page can stay a neutral wall with the magenta spent only on
 * actions. The utility strip uses the deeper shade so the eye reads the brand
 * bar as the nearer, more important surface.
 *
 * **No search field.** The homepage's `<form role="search">` is the only search
 * landmark in the product; a second one in the header would make
 * `getByRole('search').first()` ambiguous for the browse journey and for screen
 * readers. The search affordance here is therefore a *link* to the directory,
 * not a second search landmark — it looks like the reference's search control
 * because that is where a visitor looks for it, and it does the honest thing.
 *
 * **No shadow** (guide §5.3): a shadow under a bar that overlaps scrolling
 * content reads as a rendering artefact. Separation is the colour change from
 * the page plus a single hairline.
 */
export function SiteHeader() {
  return (
    <header className={classes.header}>
      {/*
       * Tier 1 — utility. Reference sites put a tagline and a city switcher here.
       * This product has no city switcher in the chrome (the directory owns
       * location filtering), so the strip carries the positioning line plus the
       * two links a returning visitor actually uses.
       */}
      <div className={classes.utilityBar}>
        <Container className={classes.utilityInner}>
          <p className={classes.tagline}>Wedding and event vendors, with prices on the page</p>
          <ul className={classes.utilityLinks}>
            <li>
              <Link href="/track" className={classes.utilityLink}>
                Track an enquiry
              </Link>
            </li>
            <li>
              <Link href="/contact" className={classes.utilityLink}>
                Contact us
              </Link>
            </li>
          </ul>
        </Container>
      </div>

      {/* Tier 2 — brand, catalogue navigation, account. */}
      <div className={classes.mainBar}>
        <Container className={classes.inner}>
          <div className={classes.burgerSlot}>
            <MobileNav />
          </div>

          <Link href="/" className={classes.brand} aria-label="Live Envt — home">
            <BrandMark size="md" />
          </Link>

          {/*
           * `HeaderNav` reads `usePathname()` to mark the active section, and the
           * category routes are statically prerendered — where a pathname does not
           * exist yet. Without this boundary the build fails with
           * CLIENT_HOOK_DYNAMIC on `/categories/[slug]`. The fallback reserves the
           * nav's exact box so nothing shifts when the active state streams in.
           */}
          <Suspense fallback={<div className={classes.navFallback} aria-hidden />}>
            <HeaderNav />
          </Suspense>

          <div className={classes.actions}>
            <Link href="/vendors" className={classes.iconAction} aria-label="Search vendors">
              <IconSearch size="1.125rem" stroke={1.5} aria-hidden />
            </Link>
            <ThemeToggle className={classes.iconAction} />
            <Suspense fallback={<HeaderAccountFallback />}>
              <HeaderAccount />
            </Suspense>
          </div>
        </Container>
      </div>
    </header>
  );
}
