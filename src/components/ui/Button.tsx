'use client';

import { forwardRef, type ForwardedRef } from 'react';
import { Button as MantineButton, type ButtonProps as MantineButtonProps } from '@mantine/core';
import { cx } from './cx';
import classes from './Button.module.css';

/**
 * The canonical variants. A page should name an *intent*, not a colour:
 * `primary` is the one action a section is for, `secondary` is a supporting
 * action beside it, `ghost` is row/card chrome, `danger` destroys something.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'link';

/** Four steps, all on the 4px rhythm. `md` is the default 40px action height. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export type ButtonProps = MantineButtonProps & {
  /**
   * Canonical variant name, or any Mantine variant for backwards compatibility.
   * Mantine's names are normalised at render time, so `variant="default"` and
   * `variant="secondary"` produce the identical button.
   */
  variant?: ButtonVariant | (string & {});
  /** Canonical size. Mantine's `compact-*` names are normalised onto these. */
  size?: ButtonSize | (string & {});
};

/**
 * Why Mantine's variant names are still accepted: 90-odd call sites across the
 * product already pass `variant="default"` / `"subtle"` / `color="red"`. Rather
 * than fork every one of them, the wrapper translates the historical name onto
 * a canonical variant here, so the visual language is decided in exactly one
 * place and the call sites keep compiling. New code should use the canonical
 * names.
 */
const VARIANT_ALIAS: Record<string, ButtonVariant> = {
  filled: 'primary',
  primary: 'primary',
  gradient: 'primary',
  default: 'secondary',
  outline: 'secondary',
  white: 'secondary',
  secondary: 'secondary',
  light: 'soft',
  soft: 'soft',
  subtle: 'ghost',
  transparent: 'ghost',
  ghost: 'ghost',
  link: 'link',
};

/** `red`, `danger` and `error` are the only colours a button may carry: a
 * filled button is an action, and the palette has one action colour. */
const DANGER_COLORS = new Set(['red', 'danger', 'error', 'critical']);

const SIZE_ALIAS: Record<string, ButtonSize> = {
  'compact-xs': 'xs',
  xs: 'xs',
  'compact-sm': 'sm',
  sm: 'sm',
  'compact-md': 'md',
  md: 'md',
  'compact-lg': 'lg',
  lg: 'lg',
  xl: 'lg',
};

function resolveVariant(variant: string | undefined, color: unknown): ButtonVariant {
  if (typeof color === 'string' && DANGER_COLORS.has(color)) return 'danger';
  if (variant && variant in VARIANT_ALIAS) return VARIANT_ALIAS[variant];
  // A filled button is Mantine's default, so a missing variant is the primary
  // action here too; an unrecognised one falls back rather than rendering bare.
  return 'primary';
}

function resolveSize(size: string | undefined): ButtonSize {
  return (size && SIZE_ALIAS[size]) || 'md';
}

function ButtonImpl(
  { variant, size, color, className, classNames, ...rest }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const resolvedVariant = resolveVariant(typeof variant === 'string' ? variant : undefined, color);
  const resolvedSize = resolveSize(typeof size === 'string' ? size : undefined);

  return (
    <MantineButton
      {...rest}
      ref={ref}
      // Every visual decision is made by this library, so Mantine's own theme
      // classes must not compete with ours at equal specificity.
      unstyled
      variant={resolvedVariant}
      size={resolvedSize}
      color={undefined}
      className={cx(classes.root, className)}
      classNames={{
        inner: classes.inner,
        label: classes.label,
        section: classes.section,
        loader: classes.loader,
        ...classNames,
      }}
    />
  );
}

/**
 * The one button.
 *
 * `unstyled` on Mantine's `Button` keeps the polymorphic `component` prop, the
 * `leftSection`/`rightSection` slots and the `loading` overlay, while every
 * colour, height and state comes from this library. The state set is complete
 * and identical for every variant: hover shifts the fill one step, active adds
 * a press, focus-visible draws the app ring, disabled is a muted surface, and
 * loading keeps the label's box while replacing its paint with a spinner.
 */
export const Button = Object.assign(forwardRef(ButtonImpl), {
  Group: MantineButton.Group,
  GroupSection: MantineButton.GroupSection,
  classes: MantineButton.classes,
  varsResolver: MantineButton.varsResolver,
  displayName: 'Button',
}) as unknown as typeof MantineButton;
