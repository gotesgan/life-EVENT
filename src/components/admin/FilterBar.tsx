'use client';

import type { ReactNode } from 'react';
import { IconFilter, IconX } from '@tabler/icons-react';
import { Button, Group, Loader, Text } from '@mantine/core';
import classes from './FilterBar.module.css';

export interface FilterBarProps {
  children: ReactNode;
  onClear?: () => void;
  /** Number of applied filters, shown as a count next to the heading. */
  activeCount?: number;
  /** True while the filtered result is re-rendering on the server. */
  pending?: boolean;
  /** Small hint on the right, e.g. the result count. */
  summary?: ReactNode;
  label?: string;
}

/**
 * The filter strip that sits above every admin table.
 *
 * It renders immediately — it takes its values from props rather than from a
 * suspended data read — so the page never shows an empty band where the
 * controls belong. The pending spinner replaces nothing; it only adds a quiet
 * "updating" cue while the server re-renders the table beneath.
 */
export function FilterBar({
  children,
  onClear,
  activeCount = 0,
  pending = false,
  summary,
  label = 'Filters',
}: FilterBarProps) {
  return (
    <section className={classes.root} aria-label={label}>
      <div className={classes.head}>
        <Group gap="xs" wrap="nowrap">
          <IconFilter size={16} stroke={1.5} aria-hidden />
          <Text size="xs" fw={600} className={classes.heading}>
            {label}
          </Text>
          {activeCount > 0 ? (
            <Text size="xs" c="dimmed">
              {activeCount} applied
            </Text>
          ) : null}
          {pending ? (
            <Loader size={14} aria-label="Updating results" className={classes.loader} />
          ) : null}
        </Group>

        <Group gap="sm" wrap="nowrap">
          {summary ? (
            <Text size="xs" c="dimmed" visibleFrom="md">
              {summary}
            </Text>
          ) : null}
          {onClear && activeCount > 0 ? (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconX size={14} stroke={1.5} />}
              onClick={onClear}
            >
              Clear
            </Button>
          ) : null}
        </Group>
      </div>

      <div className={classes.grid}>{children}</div>
    </section>
  );
}

export interface FilterFieldProps {
  children: ReactNode;
  /** Optional second row content, e.g. a date pair inside one field slot. */
  hint?: ReactNode;
}

export function FilterField({ children, hint }: FilterFieldProps) {
  return (
    <div className={classes.field}>
      {children}
      {hint ? <div className={classes.hint}>{hint}</div> : null}
    </div>
  );
}

/**
 * Visible label for a control that has no `label` prop (a `SegmentedControl`, a
 * group of checkboxes). It exists so those controls are named by a real page
 * element and match the Mantine input labels beside them, instead of every
 * filter component hand-styling its own caption.
 */
export function FilterFieldLabel({ children }: { children: ReactNode }) {
  return <p className={classes.fieldLabel}>{children}</p>;
}
