import type { ReactNode } from 'react';
import Link from 'next/link';
import { cx } from './cx';
import classes from './PageHeader.module.css';

export interface Breadcrumb {
  label: string;
  /** Omit on the final crumb — it renders as the current page. */
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small label above the title, e.g. a listing count or a category name. */
  eyebrow?: ReactNode;
  /** Buttons or links, right-aligned on wide screens and stacked on narrow ones. */
  actions?: ReactNode;
  breadcrumbs?: ReadonlyArray<Breadcrumb>;
  className?: string;
  id?: string;
}

/**
 * Page title block: optional breadcrumbs, an eyebrow, one `<h1>`, an optional
 * description and an actions slot.
 *
 * Exactly one `PageHeader` per page — it owns the `h1`.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
  className,
  id,
}: PageHeaderProps) {
  const hasBreadcrumbs = Boolean(breadcrumbs && breadcrumbs.length > 0);

  return (
    <header id={id} className={cx(classes.root, className)}>
      {hasBreadcrumbs ? (
        <nav className={classes.breadcrumbs} aria-label="Breadcrumb">
          <ol className={classes.crumbList}>
            {breadcrumbs?.map((crumb, index) => {
              const isLast = index === (breadcrumbs?.length ?? 0) - 1;
              return (
                <li key={`${crumb.label}-${index}`} className={classes.crumb}>
                  {crumb.href && !isLast ? (
                    <Link className={classes.crumbLink} href={crumb.href}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? 'page' : undefined}
                      className={classes.crumbCurrent}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className={classes.row}>
        <div className={classes.text}>
          {eyebrow ? <p className={classes.eyebrow}>{eyebrow}</p> : null}
          <h1 className={classes.title}>{title}</h1>
          {description ? <p className={classes.description}>{description}</p> : null}
        </div>

        {actions ? <div className={classes.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
