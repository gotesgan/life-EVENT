import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { FOOTER_CATEGORIES, FOOTER_COMPANY, FOOTER_LEGAL, type NavLink } from './navigation';
import classes from './SiteFooter.module.css';

function LinkColumn({ title, links }: { title: string; links: readonly NavLink[] }) {
  return (
    <div>
      <h2 className={classes.columnTitle}>{title}</h2>
      <ul className={classes.linkList}>
        {links.map((link) => (
          <li key={link.href}>
            <Link className={classes.link} href={link.href}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Site footer.
 *
 * Every link here resolves to a page this codebase ships — no placeholder
 * anchors, no social accounts that do not exist. Deliberately no year in the
 * copyright line: `new Date()` is synchronous IO and would throw while the
 * static shell is prerendered under `cacheComponents`.
 */
export function SiteFooter() {
  return (
    <footer className={classes.footer}>
      <Container>
        <div className={classes.inner}>
          <div className={classes.intro}>
            {/* The full supplied lockup — monogram, wordmark and the "moments to
                cherish" line — is the one place its lettering is large enough to
                read as artwork. Gold on the footer surface is a logo, not body
                text; the wordmark the header needs is set as text. */}
            <Image
              className={classes.lockup}
              src="/brand/le-lockup.png"
              alt="Life Events — moments to cherish"
              width={1000}
              height={800}
              sizes="200px"
            />
            <p className={classes.tagline}>
              Browse wedding and event vendors with published prices, capacity and verification
              status. Send one enquiry to the businesses you choose and track every reply in one
              place.
            </p>
          </div>

          <LinkColumn title="Categories" links={FOOTER_CATEGORIES} />
          <LinkColumn title="Life Events" links={FOOTER_COMPANY} />
          <LinkColumn title="Legal" links={FOOTER_LEGAL} />
        </div>

        <div className={classes.baseline}>
          <p className={classes.baselineText}>Life Events — moments to cherish.</p>
          <p className={classes.baselineText}>
            Prices and availability are published by each business.
          </p>
        </div>
      </Container>
    </footer>
  );
}
