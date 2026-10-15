import type { ReactNode } from 'react';
import { cx } from './cx';
import classes from './Container.module.css';

export type ContainerSize = 'default' | 'wide' | 'prose';
export type ContainerElement =
  'div' | 'section' | 'main' | 'article' | 'header' | 'footer' | 'nav' | 'aside';

export interface ContainerProps {
  children: ReactNode;
  /**
   * `default` is `--app-max-width`; `wide` adds one gutter step on each side for
   * full-bleed-ish marketing rows; `prose` caps the measure at 68 characters so
   * long-form copy stays readable inside the same grid.
   */
  size?: ContainerSize;
  /** Drops the horizontal gutter — use only when the children manage their own. */
  bleed?: boolean;
  /** Renders a more semantic element than `div`. */
  as?: ContainerElement;
  className?: string;
  id?: string;
}

/**
 * Page-width wrapper. Every page-level block sits in one of these so gutters and
 * the maximum measure are defined in exactly one place.
 */
export function Container({
  children,
  size = 'default',
  bleed = false,
  as: Tag = 'div',
  className,
  id,
}: ContainerProps) {
  return (
    <Tag
      id={id}
      className={cx(classes.container, classes[size], bleed && classes.bleed, className)}
    >
      {children}
    </Tag>
  );
}
