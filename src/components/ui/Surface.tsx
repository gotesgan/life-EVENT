import type { ReactNode } from 'react';
import { Paper } from '@mantine/core';
import { cx } from './cx';
import classes from './Surface.module.css';

/**
 * The HTML elements a `Surface` may render as.
 *
 * Deliberately a closed union rather than `ElementType`: a Surface must be a
 * plain box, and allowing an arbitrary component would let a caller smuggle in
 * styles this primitive is supposed to own.
 */
export type SurfaceElement =
  | 'div'
  | 'section'
  | 'article'
  | 'aside'
  | 'main'
  | 'header'
  | 'footer'
  | 'nav'
  | 'form'
  | 'figure'
  | 'li';

export type SurfaceTone =
  'base' | 'raised' | 'muted' | 'sunken' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';
export type SurfaceRadius = 'control' | 'card';

export interface SurfaceProps {
  children: ReactNode;
  /** Surface elevation step, or a tinted panel for callouts and summaries. */
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  bordered?: boolean;
  /** Applies `--app-shadow-card`. Shadow is for *raised* content only. */
  elevated?: boolean;
  /** Polymorphic element, e.g. `'article'`, `'aside'`, `'section'`. */
  as?: SurfaceElement;
  className?: string;
  id?: string;
  /**
   * Optional `data-tour` anchor for the guided tours. Surfaces do not spread
   * arbitrary props by design, so the one attribute the product needs to address
   * a panel from outside is declared explicitly.
   */
  'data-tour'?: string;
}

/**
 * The panel primitive. Pages compose this instead of restyling `Card`/`Paper`
 * by hand, which is what keeps border colour, radius and elevation consistent.
 *
 * `Paper` is used with `unstyled` so the DOM, `component` polymorphism and ref
 * handling stay Mantine's while every visual decision comes from app tokens —
 * including the background, which must **not** be Mantine's
 * `--mantine-color-body` (that is the page canvas, one step *below* a panel).
 */
export function Surface({
  children,
  tone = 'raised',
  padding = 'md',
  radius = 'card',
  bordered = true,
  elevated = false,
  as,
  className,
  id,
  'data-tour': dataTour,
}: SurfaceProps) {
  return (
    <Paper
      unstyled
      component={as}
      id={id}
      data-tour={dataTour}
      className={cx(
        classes.root,
        classes[`tone-${tone}`],
        classes[`pad-${padding}`],
        classes[`shape-${radius}`],
        bordered && classes.bordered,
        elevated && classes.elevated,
        className,
      )}
    >
      {children}
    </Paper>
  );
}
