import type { ReactNode } from 'react';
import { cx } from './cx';
import classes from './EmptyState.module.css';

export interface EmptyStateProps {
  /** Icon slot. Rendered inside a tinted well; pass a 1.5px-stroke Tabler icon. */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  size?: 'sm' | 'md';
  /**
   * The title element. Defaults to `p`: an empty state is not part of the page
   * outline, and injecting a heading level here would break the document
   * hierarchy on pages where it appears mid-section.
   */
  titleAs?: 'p' | 'h2' | 'h3';
  className?: string;
}

/**
 * Empty-result surface, used both for "no results for these filters" and for
 * "this list has nothing in it yet".
 *
 * The two cases usually deserve different copy and different actions; this
 * component only owns the layout, so the caller supplies both.
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  size = 'md',
  titleAs: TitleTag = 'p',
  className,
}: EmptyStateProps) {
  const hasActions = Boolean(primaryAction || secondaryAction);

  return (
    <div className={cx(classes.root, classes[size], className)}>
      {icon ? (
        <span aria-hidden className={classes.iconWell}>
          {icon}
        </span>
      ) : null}

      <TitleTag className={classes.title}>{title}</TitleTag>
      {description ? <p className={classes.description}>{description}</p> : null}

      {hasActions ? (
        <div className={classes.actions}>
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
