'use client';

import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { cx } from './cx';
import classes from './ThemeToggle.module.css';

export type ThemeToggleSize = 'sm' | 'md' | 'lg';

export interface ThemeToggleProps {
  size?: ThemeToggleSize;
  className?: string;
}

const ACTION_ICON_SIZE: Record<ThemeToggleSize, 'md' | 'lg' | 'xl'> = {
  sm: 'md',
  md: 'lg',
  lg: 'xl',
};

/**
 * Light/dark switch.
 *
 * `getInitialValueInEffect: true` is required, not optional: the server has no
 * storage, so the scheme must not be read during SSR or hydration would differ.
 * With this option the computed value starts at the default and settles after
 * mount, and the two icons are swapped purely by the `light-dark` CSS mixins.
 *
 * Flipping writes `light`/`dark` explicitly (never back to `auto`) because the
 * user asking for a scheme is an explicit choice; `auto` remains the default
 * until they make one.
 */
export function ThemeToggle({ size = 'md', className }: ThemeToggleProps) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  const isLight = computedColorScheme === 'light';

  return (
    <ActionIcon
      variant="default"
      size={ACTION_ICON_SIZE[size]}
      className={cx(classes.root, className)}
      onClick={() => setColorScheme(isLight ? 'dark' : 'light')}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      <IconSun aria-hidden className={cx(classes.icon, classes.lightIcon)} size={18} stroke={1.5} />
      <IconMoon aria-hidden className={cx(classes.icon, classes.darkIcon)} size={18} stroke={1.5} />
    </ActionIcon>
  );
}
