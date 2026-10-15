import type { ReactNode } from 'react';
import { Badge } from '@mantine/core';
import { cx } from './cx';
import classes from './StatusBadge.module.css';

/**
 * Semantic tones, not colour names. Every tone resolves to a token pair
 * (`--app-<tone>` and `--app-<tone>-soft`) so a page never names a hue.
 *
 * `info` is an alias of `brand`: the palette is six ramps by design and contains
 * no blue, so inventing one for a single badge would break the system. An
 * informational state that must be visually distinct from brand should use
 * `accent` or `neutral` — but those carry different meaning, so prefer rewording
 * the status over recolouring it.
 */
export type StatusTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export type StatusVariant = 'solid' | 'soft' | 'outline';
export type StatusSize = 'sm' | 'md';

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  variant?: StatusVariant;
  size?: StatusSize;
  /** Leading dot: a second, non-colour channel for status (WCAG 1.4.1). */
  dot?: boolean;
  className?: string;
}

/**
 * A typed status pill.
 *
 * Built on Mantine's `Badge` with `unstyled` so the DOM, polymorphic `component`
 * prop and ref forwarding stay Mantine's, while colour comes only from app
 * tokens. Colour is never the sole carrier of meaning — pass `dot` when the
 * status matters without its label.
 */
export function StatusBadge({
  children,
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      unstyled
      component="span"
      className={cx(classes.badge, classes[tone], classes[variant], classes[size], className)}
      leftSection={dot ? <span aria-hidden className={classes.dot} /> : undefined}
    >
      {children}
    </Badge>
  );
}
