import type { ReactNode } from 'react';
import { Surface, type SurfaceElement, type SurfaceTone } from './Surface';
import { cx } from './cx';
import classes from './Card.module.css';

export interface CardProps {
  children: ReactNode;
  /** `raised` is the default panel; the tinted tones are callouts, not cards. */
  tone?: SurfaceTone;
  /**
   * Hover border + `--app-shadow-raised`, and a brand ring when focus enters.
   * Use only when the whole card is one navigable object.
   */
  interactive?: boolean;
  /**
   * Drop the outer padding when the first child is a full-bleed media well, so
   * the image meets the card's radius instead of sitting inside an inset box.
   */
  padded?: boolean;
  as?: SurfaceElement;
  className?: string;
  id?: string;
}

/**
 * The panel a page composes instead of restyling `Paper` by hand.
 *
 * `Surface` owns the fill, border and radius; `Card` adds the one behaviour a
 * panel needs that a plain surface does not — a hover/focus affordance that
 * lifts it to E1 *without* animating position. A resting card is a 1px border
 * on a raised surface; the shadow appears only while the pointer or focus is on
 * it, which is what keeps a 24-tile grid from looking like it floats.
 */
export function Card({
  children,
  tone = 'raised',
  interactive = false,
  padded = true,
  as = 'article',
  className,
  id,
}: CardProps) {
  return (
    <Surface
      as={as}
      id={id}
      tone={tone}
      radius="card"
      padding={padded ? 'md' : 'none'}
      className={cx(classes.card, interactive && classes.interactive, className)}
    >
      {children}
    </Surface>
  );
}

export interface CardSectionProps {
  children: ReactNode;
  /** Draws the hairline that separates this band from the previous one. */
  divided?: boolean;
  className?: string;
}

/** A padded band at the top of a card, above the scroll-critical body. */
export function CardHeader({ children, divided = false, className }: CardSectionProps) {
  return (
    <div className={cx(classes.section, divided && classes.divided, className)}>{children}</div>
  );
}

/** The card's main band. Padding is `--app-card-padding`, so a `surface--dense`
 * ancestor tightens every card body at once. */
export function CardBody({ children, divided = false, className }: CardSectionProps) {
  return (
    <div className={cx(classes.section, divided && classes.divided, className)}>{children}</div>
  );
}

/** The trailing band — usually one full-width action. */
export function CardFooter({ children, divided = true, className }: CardSectionProps) {
  return (
    <div className={cx(classes.section, divided && classes.divided, className)}>{children}</div>
  );
}

export interface CardTitleProps {
  children: ReactNode;
  /** `h3` by default: a card is a section, and 24 cards must not emit 24 `h2`s. */
  as?: 'h2' | 'h3' | 'h4' | 'p' | 'span';
  /** Reserves the two-line box so cards in a row keep a level anchor. Default. */
  clamp?: boolean;
  className?: string;
  id?: string;
}

/**
 * A card heading in a reserved two-line box.
 *
 * The reservation is the point: without it a one-line title and a two-line
 * title in the same grid push their price rows to different heights, and the
 * column stops being scannable.
 */
export function CardTitle({
  children,
  as: Tag = 'h3',
  clamp = true,
  className,
  id,
}: CardTitleProps) {
  return (
    <Tag id={id} className={cx(classes.title, clamp && classes.clamp, className)}>
      {children}
    </Tag>
  );
}

/** A full-bleed media well. Clips its own content to the card's top radius. */
export function CardMedia({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(classes.media, className)}>{children}</div>;
}
