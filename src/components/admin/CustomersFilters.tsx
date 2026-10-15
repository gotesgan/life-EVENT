'use client';

import { useEffect, useRef, useState } from 'react';
import { Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { FilterBar, FilterField } from './FilterBar';
import { CUSTOMER_FILTER_KEYS } from './filter-keys';
import { useUrlFilters, type UrlParams } from './use-url-filters';

export interface CustomersFiltersProps {
  current: UrlParams;
  resultCount: number;
}

/**
 * Customer moderation filters, persisted in the URL.
 *
 * Same debounce rule as the other admin filter strips: the text field writes
 * only when the debounced value actually differs from the URL's.
 */
export function CustomersFilters({ current, resultCount }: CustomersFiltersProps) {
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

  const activeCount = CUSTOMER_FILTER_KEYS.filter((key) => current[key]).length;

  return (
    <FilterBar
      activeCount={activeCount}
      pending={isPending}
      summary={`${resultCount} matching ${resultCount === 1 ? 'account' : 'accounts'}`}
      onClear={() => {
        setQuery('');
        const cleared: UrlParams = {};
        for (const key of CUSTOMER_FILTER_KEYS) cleared[key] = undefined;
        navigate(cleared);
      }}
    >
      <FilterField>
        <TextInput
          label="Search"
          placeholder="Name or email"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          maxLength={120}
          leftSection={<IconSearch size={16} stroke={1.5} aria-hidden />}
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Status"
          placeholder="Any status"
          data={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'DEACTIVATED', label: 'Deactivated' },
          ]}
          value={current.status ?? null}
          onChange={(value) => setValue('status', value ?? undefined)}
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Role"
          placeholder="Any role"
          data={[
            { value: 'CUSTOMER', label: 'Customer' },
            { value: 'ADMIN', label: 'Administrator' },
          ]}
          value={current.role ?? null}
          onChange={(value) => setValue('role', value ?? undefined)}
          clearable
          size="xs"
        />
      </FilterField>
    </FilterBar>
  );
}
