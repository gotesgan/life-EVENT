'use client';

import { useEffect, useRef, useState } from 'react';
import { SegmentedControl, Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { FilterBar, FilterField, FilterFieldLabel } from './FilterBar';
import { ENQUIRY_FILTER_KEYS } from './filter-keys';
import { useUrlFilters, type UrlParams } from './use-url-filters';
import { ADMIN_STATUS_ORDER } from '@/server/domain/enquiry-status';
import { ENQUIRY_LABELS, labelFor } from './status';

export interface EnquiryFiltersProps {
  current: UrlParams;
  categoryOptions: Array<{ value: string; label: string }>;
  listingOptions: Array<{ value: string; label: string }>;
  eventTypeOptions: Array<{ value: string; label: string }>;
  assigneeOptions: Array<{ value: string; label: string }>;
  resultCount: number;
}

const STATUS_OPTIONS = ADMIN_STATUS_ORDER.map((status) => ({
  value: status,
  label: labelFor(ENQUIRY_LABELS, status),
}));

/**
 * Enquiry inbox filters, all persisted in the URL.
 *
 * Same contract as the listings filters: the free-text field is debounced and
 * only writes when the value genuinely changed, every other control writes
 * immediately, and "Clear" removes every filter key rather than only the ones
 * this component happens to know about.
 */
export function EnquiryFilters({
  current,
  categoryOptions,
  listingOptions,
  eventTypeOptions,
  assigneeOptions,
  resultCount,
}: EnquiryFiltersProps) {
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

  const duplicate = current.flaggedDuplicate ?? 'all';
  const sort = current.sort ?? 'newest';
  const activeCount = ENQUIRY_FILTER_KEYS.filter((key) => current[key]).length;

  // The inbox filter matches the enquiry-level owner (the same value the
  // "Assignee" column shows), not per-provider-lead assignment. The label says
  // so, because the overview tile counts unassigned *provider leads* and the two
  // figures legitimately differ.
  const assigneeOptionsWithUnassigned = [
    { value: 'unassigned', label: 'Unassigned owner' },
    ...assigneeOptions,
  ];

  return (
    <FilterBar
      activeCount={activeCount}
      pending={isPending}
      summary={`${resultCount} matching ${resultCount === 1 ? 'enquiry' : 'enquiries'}`}
      onClear={() => {
        setQuery('');
        const cleared: UrlParams = {};
        for (const key of ENQUIRY_FILTER_KEYS) cleared[key] = undefined;
        cleared.sort = undefined;
        navigate(cleared);
      }}
    >
      <FilterField>
        <TextInput
          label="Search"
          placeholder="Reference, name, email or phone"
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
          data={STATUS_OPTIONS}
          value={current.status ?? null}
          onChange={(value) => setValue('status', value ?? undefined)}
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Assignee"
          placeholder="Anyone"
          data={assigneeOptionsWithUnassigned}
          value={current.assignedAdminId ?? null}
          onChange={(value) => setValue('assignedAdminId', value ?? undefined)}
          searchable
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
          label="Business"
          placeholder="Any business"
          data={listingOptions}
          value={current.listingId ?? null}
          onChange={(value) => setValue('listingId', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Event type"
          placeholder="Any event type"
          data={eventTypeOptions}
          value={current.eventTypeId ?? null}
          onChange={(value) => setValue('eventTypeId', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <div>
          <FilterFieldLabel>Possible duplicate</FilterFieldLabel>
          <SegmentedControl
            fullWidth
            size="xs"
            value={duplicate}
            onChange={(value) => setValue('flaggedDuplicate', value === 'all' ? undefined : value)}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Flagged', value: 'true' },
              { label: 'Not flagged', value: 'false' },
            ]}
          />
        </div>
      </FilterField>

      <FilterField>
        <TextInput
          type="date"
          label="Created from"
          value={current.createdFrom ?? ''}
          onChange={(event) => setValue('createdFrom', event.currentTarget.value || undefined)}
          size="xs"
        />
      </FilterField>

      <FilterField>
        <TextInput
          type="date"
          label="Created to"
          value={current.createdTo ?? ''}
          onChange={(event) => setValue('createdTo', event.currentTarget.value || undefined)}
          size="xs"
        />
      </FilterField>

      <FilterField>
        <div>
          <FilterFieldLabel>Order</FilterFieldLabel>
          <SegmentedControl
            fullWidth
            size="xs"
            value={sort}
            onChange={(value) => setValue('sort', value === 'newest' ? undefined : value)}
            data={[
              { label: 'Newest', value: 'newest' },
              { label: 'Oldest', value: 'oldest' },
            ]}
          />
        </div>
      </FilterField>
    </FilterBar>
  );
}
