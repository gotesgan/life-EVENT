'use client';

import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { setSingleValue } from '@/lib/filter-state';
import { useFilterNavigation } from './useFilterNavigation';
import classes from './SearchBar.module.css';

export interface SearchBarProps {
  idPrefix?: string;
  placeholder?: string;
}

/**
 * Free-text search for the results page.
 *
 * Typing is debounced by 350ms and pushed with `router.replace`, so a
 * twelve-character query creates one history entry rather than twelve. Pressing
 * Enter flushes the pending debounce immediately instead of waiting it out.
 */
export function SearchBar({
  idPrefix = 'results',
  placeholder = 'Photographer, banquet hall, decorator…',
}: SearchBarProps) {
  const nav = useFilterNavigation();
  const current = nav.params.q ?? '';
  const [value, setValue] = useState(current);
  const [syncedFrom, setSyncedFrom] = useState(current);

  // Sync the input to the URL when it changes underneath us (back/forward, a
  // removed chip, or another control committing). React's documented pattern for
  // "adjusting state when a prop changes" compares against the previous value
  // during render; doing it in an effect would add a cascading render pass and
  // is rejected by the react-hooks rules.
  if (current !== syncedFrom) {
    setSyncedFrom(current);
    setValue(current);
  }

  const commit = useDebouncedCallback((next: string) => {
    nav.update((params) => setSingleValue(params, 'q', next.trim() || undefined), {
      replace: true,
    });
  }, 350);

  return (
    <form
      className={classes.form}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        commit.flush();
      }}
    >
      <TextInput
        id={`${idPrefix}-search`}
        label="Search vendors"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setValue(next);
          commit(next);
        }}
        leftSection={<IconSearch size="1.125rem" stroke={1.5} aria-hidden />}
        // Mirrors the server's `q` limit, so the common failure cannot be typed:
        // a longer value would otherwise be committed, rejected by validation and
        // reported as a dead-end error instead of simply not being enterable.
        maxLength={120}
        radius="md"
        size="md"
      />
    </form>
  );
}
