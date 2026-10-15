'use client';

import { useEffect, useRef, useState } from 'react';
import { Select, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { FilterBar, FilterField } from './FilterBar';
import { AUDIT_FILTER_KEYS } from './filter-keys';
import { useUrlFilters, type UrlParams } from './use-url-filters';

export interface AuditFiltersProps {
  current: UrlParams;
  /** Closed list of actions the platform can record. */
  actionOptions: ReadonlyArray<string>;
  /** Entity types the audit log writes. */
  entityTypeOptions: ReadonlyArray<string>;
  actorOptions: Array<{ value: string; label: string }>;
  resultCount: number;
}

/**
 * Audit log filters, persisted in the URL.
 *
 * The free-text fields (entity id and the debounced entity search) are the only
 * ones that can be partial matches; `action`, `entityType` and `actorUserId` are
 * exact, so they are selects over known values rather than text boxes that would
 * silently return nothing for a typo.
 */
export function AuditFilters({
  current,
  actionOptions,
  entityTypeOptions,
  actorOptions,
  resultCount,
}: AuditFiltersProps) {
  const { setValue, navigate, isPending } = useUrlFilters(current);

  const [entityId, setEntityId] = useState(current.entityId ?? '');
  const [debouncedEntityId] = useDebouncedValue(entityId, 350);
  const appliedEntityId = current.entityId ?? '';
  const lastApplied = useRef(appliedEntityId);

  useEffect(() => {
    if (debouncedEntityId === lastApplied.current) return;
    if (debouncedEntityId === appliedEntityId) {
      lastApplied.current = debouncedEntityId;
      return;
    }
    lastApplied.current = debouncedEntityId;
    setValue('entityId', debouncedEntityId.length > 0 ? debouncedEntityId : undefined);
  }, [appliedEntityId, debouncedEntityId, setValue]);

  const activeCount = AUDIT_FILTER_KEYS.filter((key) => current[key]).length;

  return (
    <FilterBar
      activeCount={activeCount}
      pending={isPending}
      summary={`${resultCount} matching ${resultCount === 1 ? 'entry' : 'entries'}`}
      onClear={() => {
        setEntityId('');
        const cleared: UrlParams = {};
        for (const key of AUDIT_FILTER_KEYS) cleared[key] = undefined;
        navigate(cleared);
      }}
    >
      <FilterField>
        <Select
          label="Action"
          placeholder="Any action"
          data={actionOptions.map((action) => ({ value: action, label: action }))}
          value={current.action ?? null}
          onChange={(value) => setValue('action', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Entity type"
          placeholder="Any entity"
          data={entityTypeOptions.map((type) => ({ value: type, label: type }))}
          value={current.entityType ?? null}
          onChange={(value) => setValue('entityType', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>

      <FilterField>
        <TextInput
          label="Entity id"
          placeholder="Exact record id"
          value={entityId}
          onChange={(event) => setEntityId(event.currentTarget.value)}
          maxLength={64}
          leftSection={<IconSearch size={16} stroke={1.5} aria-hidden />}
          size="xs"
        />
      </FilterField>

      <FilterField>
        <Select
          label="Actor"
          placeholder="Anyone"
          data={actorOptions}
          value={current.actorUserId ?? null}
          onChange={(value) => setValue('actorUserId', value ?? undefined)}
          searchable
          clearable
          size="xs"
        />
      </FilterField>
    </FilterBar>
  );
}
