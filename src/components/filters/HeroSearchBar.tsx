'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { buildQuery } from '@/lib/filter-state';
import classes from './HeroSearchBar.module.css';

export interface HeroSearchBarProps {
  categories: ReadonlyArray<{ slug: string; name: string }>;
  locations: ReadonlyArray<{ slug: string; name: string }>;
}

/**
 * The homepage search: category, city and a free-text query.
 *
 * Deliberately *not* a filter wall — it collects the three things a visitor
 * already knows and hands them to the results page, which owns the full filter
 * surface. Only the free-text field is optional; a visitor who picks nothing
 * still lands on `/vendors` with all results.
 *
 * It holds local state (rather than reading the URL) because the homepage has no
 * filter state to read; the URL is authored once, on submit.
 */
export function HeroSearchBar({ categories, locations }: HeroSearchBarProps) {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  function submit() {
    const href = `/vendors${buildQuery({
      q: query.trim() || undefined,
      category: category ?? undefined,
      location: location ?? undefined,
    })}`;
    router.push(href);
  }

  return (
    <form
      className={classes.form}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Select
        label="Category"
        placeholder="All categories"
        data={categories.map((item) => ({ value: item.slug, label: item.name }))}
        value={category}
        onChange={setCategory}
        searchable
        clearable
        nothingFoundMessage="No category found"
        radius="md"
        size="md"
      />

      <Select
        label="City or locality"
        placeholder="Anywhere"
        data={locations.map((item) => ({ value: item.slug, label: item.name }))}
        value={location}
        onChange={setLocation}
        searchable
        clearable
        nothingFoundMessage="No location found"
        radius="md"
        size="md"
      />

      <TextInput
        label="What are you looking for?"
        placeholder="Banquet hall, candid photographer…"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        leftSection={<IconSearch size="1.125rem" stroke={1.5} aria-hidden />}
        radius="md"
        size="md"
      />

      <Button type="submit" className={classes.submit} size="md">
        Search vendors
      </Button>
    </form>
  );
}
