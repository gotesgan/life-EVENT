import Link from 'next/link';
import classes from './LocationLinks.module.css';

export interface LocationLink {
  slug: string;
  name: string;
  /** Overrides the `/cities/<slug>` default — used for category × city links. */
  href?: string;
}

export interface LocationLinksProps {
  locations: readonly LocationLink[];
  /** Accessible name for the list, e.g. "Cities". */
  label?: string;
  /** Renders a category-scoped heading or different aria label. */
  className?: string;
}

/**
 * A compact strip of location links.
 *
 * The research found that a ~70-city selector breaks a rail; this is a wrapped
 * chip strip rather than a scrolling checkbox wall, and each chip is a real link
 * so it is crawlable and openable in a new tab.
 */
export function LocationLinks({ locations, label, className }: LocationLinksProps) {
  if (locations.length === 0) return null;

  return (
    <ul className={className ?? classes.strip} aria-label={label}>
      {locations.map((location) => (
        <li key={location.slug}>
          <Link className={classes.chip} href={location.href ?? `/cities/${location.slug}`}>
            {location.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
