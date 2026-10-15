'use client';

import type { ReactNode } from 'react';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { Button } from './Button';
import { cx } from './cx';
import classes from './ErrorState.module.css';

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  /** Renders a "Try again" button. Omit when retrying is not possible. */
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: ReactNode;
  /**
   * The title element. Defaults to `p`, matching `EmptyState`: the failure is
   * announced by `role="alert"`, and a repeated heading would either duplicate
   * the page `h1` (on the error boundary) or break the outline mid-section.
   */
  titleAs?: 'p' | 'h2' | 'h3';
  className?: string;
}

/**
 * Failure surface. Always renders `role="alert"`, so a failed fetch announced
 * after page load is spoken by assistive technology rather than only shown.
 *
 * `onRetry` is a real callback, so this is a Client Component; a Server
 * Component can still render it, it just cannot pass a function.
 */
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
  titleAs: TitleTag = 'p',
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cx(classes.root, className)}>
      <span aria-hidden className={classes.iconWell}>
        <IconAlertTriangle className={classes.icon} size={22} stroke={1.5} />
      </span>

      <TitleTag className={classes.title}>{title}</TitleTag>
      {description ? <p className={classes.description}>{description}</p> : null}

      {onRetry || secondaryAction ? (
        <div className={classes.actions}>
          {onRetry ? (
            <Button
              variant="secondary"
              leftSection={<IconRefresh size={16} stroke={1.5} aria-hidden />}
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
