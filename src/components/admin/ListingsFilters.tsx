'use client';

import { useEffect, useRef, useState } from 'react';
import { SegmentedControl, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { FilterBar, FilterField } from './FilterBar';
import { LISTING_FILTER_KEYS } from '@/app/admin/_lib/listing-filter-keys';
import { useUrlFilters, type UrlParams } from './use-url-filters';

export interface Option {
  value: string;
  label: string;
}

export interface ListingsFiltersProps {
  current: UrlParams;
  categoryOptions: ReadonlyArray<Option>;
  locationOptions: ReadonlyArray<Option>;
  resultCount: number;
}

const PUBLICATION_OPTIONS: Option[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'UNPUBLISHED', label: 'Unpublished' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const VERIFICATION_OPTIONS: Option[] = [
  { value: 'UNVERIFIED', label: 'Unverified' },
  { value: 'PENDING', label: 'Verification pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Verification rejected' },
];

/**
 * Listing filters, all persisted in the URL.
 *
 * The free-text field is debounced and only writes when the value actually
 * differs from the URL, because every keystroke would otherwise push a
 * navigation. The remaining controls write immediately on change.
 */
export function ListingsFilters({
  current,
  categoryOptions,
  locationOptions,
  resultCount,
}: ListingsFiltersProps) {
  const { setValue, navigate, isPending } = useUrlFilters(current);

  const [query, setQuery] = useState(current.q ?? '');
  const [debouncedQuery] = useDebouncedValue(query, 350);
  const appliedQuery = current.q ?? '';
  const lastApplied = useRef(appliedQuery);

  useEffect(() => {
    if (debouncedQuery === lastApplied.current) return;
    if (debouncedQuery === appliedQuery) {
      lastApplied.current = debouncedQuery;
      return;
    }
    lastApplied.current = debouncedQuery;
    setValue('q', debouncedQuery.length > 0 ? debouncedQuery : undefined);
  }, [appliedQuery, debouncedQuery, setValue]);

  const featured = current.isFeatured ?? 'all';

  const activeCount = LISTING_FILTER_KEYS.filter((key) => current[key]).length;

  return (
    <FilterBar
      activeCount={activeCount}
      pending={isPending}
      summary={`${resultCount} matching ${resultCount === 1 ? 'listing' : 'listings'}`}
      onClear={() => {
        setQuery('');
        const cleared: UrlParams = {};
        for (const key of LISTING_FILTER_KEYS) cleared[key] = undefined;
        navigate(cleared);
      }}
    >
      <FilterField>
        <TextInput
          label="Search"
          placeholder="Name, tagline or description"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          maxLength={120}
          leftSection={<IconSearch size={16} stroke={1.5} aria-hidden />}
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Publication"
          placeholder="Any status"
          data={PUBLICATION_OPTIONS}
          value={current.publicationStatus ?? null}
          onChange={(value) => setValue('publicationStatus', value ?? undefined)}
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Verification"
          placeholder="Any status"
          data={VERIFICATION_OPTIONS}
          value={current.verificationStatus ?? null}
          onChange={(value) => setValue('verificationStatus', value ?? undefined)}
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Category"
          placeholder="Any category"
          data={categoryOptions}
          value={current.categoryId ?? null}
          onChange={(value) => setValue('categoryId', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Location"
          placeholder="Any location"
          data={locationOptions}
          value={current.locationId ?? null}
          onChange={(value) => setValue('locationId', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <div>
          <p
            style={{
              margin: 0,
              marginBottom: 4,
              fontSize: 'var(--mantine-font-size-xs)',
              fontWeight: 600,
            }}
          >
            Featured
          </p>
          <SegmentedControl
            fullWidth
            size="xs"
            value={featured}
            onChange={(value) => setValue('isFeatured', value === 'all' ? undefined : value)}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Featured', value: 'true' },
              { label: 'Not featured', value: 'false' },
            ]}
          />
        </div>
      </FilterField>
    </FilterBar>
  );
}
