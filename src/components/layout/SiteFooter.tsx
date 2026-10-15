import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
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
            <BrandMark size="sm" />
            <p className={classes.tagline}>
              Browse wedding and event vendors with published prices, capacity and verification
              status. Send one enquiry to the businesses you choose and track every reply in one
              place.
            </p>
          </div>

          <LinkColumn title="Categories" links={FOOTER_CATEGORIES} />
          <LinkColumn title="Live Envt" links={FOOTER_COMPANY} />
          <LinkColumn title="Legal" links={FOOTER_LEGAL} />
        </div>

        <div className={classes.baseline}>
          <p className={classes.baselineText}>
            Live Envt — vendor discovery for weddings and events.
          </p>
          <p className={classes.baselineText}>
            Prices and availability are published by each business.
          </p>
        </div>
      </Container>
    </footer>
  );
}
