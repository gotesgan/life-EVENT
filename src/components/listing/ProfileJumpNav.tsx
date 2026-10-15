import classes from './ProfileJumpNav.module.css';

export interface JumpNavItem {
  /** Target id of a section rendered on the same page. */
  id: string;
  label: string;
}

export interface ProfileJumpNavProps {
  items: readonly JumpNavItem[];
}

/**
 * In-page jump navigation for a long profile.
 *
 * Competitor profile pages run to twenty-plus stacked sections and the lower
 * half is effectively unreachable; this is a plain anchor list (no JavaScript),
 * sticky beneath the header. It is only rendered with sections that actually
 * exist on the page, so a link can never point at nothing.
 */
export function ProfileJumpNav({ items }: ProfileJumpNavProps) {
  if (items.length < 3) return null;

  return (
    <nav className={classes.nav} aria-label="Sections on this page">
      <ul className={classes.list}>
        {items.map((item) => (
          <li key={item.id}>
            <a className={classes.link} href={`#${item.id}`}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
