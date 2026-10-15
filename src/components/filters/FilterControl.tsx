'use client';

import { useState, type ReactNode } from 'react';
import { Checkbox, NumberInput, Radio, Switch, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedCallback } from '@mantine/hooks';
import {
  attributeKey,
  readAttributeRange,
  readList,
  setListValue,
  setSingleValue,
  toggleListValue,
  writeNumericRange,
} from '@/lib/filter-state';
import type { FilterDefinition } from '@/server/domain/search-filters';
import { useFilterNavigation } from './useFilterNavigation';
import classes from './FilterControl.module.css';

/** Legend + optional help text for a group of related inputs. */
export function FilterFieldset({
  legend,
  help,
  children,
}: {
  legend: string;
  help?: string | null;
  children: ReactNode;
}) {
  return (
    <fieldset className={classes.group}>
      <legend className={classes.legend}>{legend}</legend>
      {help ? <p className={classes.help}>{help}</p> : null}
      {children}
    </fieldset>
  );
}

export interface FilterOptionItem {
  value: string;
  label: string;
}

/**
 * Collapsing checkbox list — guide §1.8.
 *
 * Eight options is the collapse point: below it everything is visible, above it
 * the group shows eight and a "Show N more" control. The rail never scrolls a
 * group internally, because a scroll region inside a sticky rail fights the
 * page scroll and hides the option the visitor is looking for behind a gesture.
 */
const COLLAPSE_THRESHOLD = 8;

export function CheckboxOptionList({
  options,
  selected,
  onToggle,
}: {
  options: readonly FilterOptionItem[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = options.length > COLLAPSE_THRESHOLD;
  const visible = collapsible && !expanded ? options.slice(0, COLLAPSE_THRESHOLD) : options;

  return (
    <>
      <div className={classes.options}>
        {visible.map((option) => (
          <Checkbox
            key={option.value}
            className={classes.option}
            label={option.label}
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
        ))}
      </div>

      {collapsible ? (
        <button
          type="button"
          className={classes.showMore}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show fewer' : `Show ${options.length - COLLAPSE_THRESHOLD} more`}
        </button>
      ) : null}
    </>
  );
}

/** 350ms typing debounce, committed with `router.replace`. */
function TextFilter({ definition }: { definition: FilterDefinition }) {
  const nav = useFilterNavigation();
  const key = attributeKey(definition.code);
  const current = nav.params[key] ?? '';
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

  // A text filter needs at least two characters to be meaningful, and the server
  // rejects anything shorter. Committing one pressed character therefore produced
  // a validation failure that replaced the entire results page — sidebar, filters
  // and the text the user was still typing — with an error. The guard below is
  // deliberately *not* a validation error: one character simply is not yet a
  // filter, so it is not committed, and the value is committed as soon as it
  // becomes a usable one.
  const MIN_TEXT_FILTER_LENGTH = 2;

  const commit = useDebouncedCallback((next: string) => {
    const trimmed = next.trim();

    // Below the minimum: not yet a filter, so do not commit it. An empty value
    // still commits, because clearing the box must remove the filter.
    if (trimmed.length > 0 && trimmed.length < MIN_TEXT_FILTER_LENGTH) return;

    nav.update((params) => setSingleValue(params, key, trimmed || undefined), {
      replace: true,
    });
  }, 350);

  return (
    <TextInput
      label={definition.label}
      placeholder={definition.helpText ? undefined : 'Type to filter'}
      description={
        definition.helpText ??
        (value.trim().length === 1 ? 'Type one more character to filter' : undefined)
      }
      value={value}
      onChange={(event) => {
        const next = event.currentTarget.value;
        setValue(next);
        commit(next);
      }}
      radius="md"
    />
  );
}

/** Numeric min/max, committed on blur, Enter, or a 500ms pause. */
function NumericRangeFilter({ definition }: { definition: FilterDefinition }) {
  const nav = useFilterNavigation();
  const key = attributeKey(definition.code);
  const range = readAttributeRange(nav.params, definition.code);

  const externalMin = range.min === null ? '' : String(range.min);
  const externalMax = range.max === null ? '' : String(range.max);
  const [min, setMin] = useState(externalMin);
  const [max, setMax] = useState(externalMax);
  const [syncedFrom, setSyncedFrom] = useState(`${externalMin}|${externalMax}`);

  // Sync the input to the URL when it changes underneath us (back/forward, a
  // removed chip, or another control committing). React's documented pattern for
  // "adjusting state when a prop changes" compares against the previous value
  // during render; doing it in an effect would add a cascading render pass and
  // is rejected by the react-hooks rules.
  if (`${externalMin}|${externalMax}` !== syncedFrom) {
    setSyncedFrom(`${externalMin}|${externalMax}`);
    setMin(externalMin);
    setMax(externalMax);
  }

  const commit = useDebouncedCallback((nextMin: string, nextMax: string) => {
    const parsedMin = nextMin.trim() === '' ? null : Number(nextMin);
    const parsedMax = nextMax.trim() === '' ? null : Number(nextMax);
    nav.update(
      (params) =>
        writeNumericRange(params, key, {
          min: parsedMin !== null && Number.isFinite(parsedMin) ? parsedMin : null,
          max: parsedMax !== null && Number.isFinite(parsedMax) ? parsedMax : null,
        }),
      { replace: true },
    );
  }, 500);

  const unit = definition.unit ? ` (${definition.unit})` : '';

  return (
    <FilterFieldset legend={`${definition.label}${unit}`} help={definition.helpText}>
      <div className={classes.range}>
        <NumberInput
          label="Minimum"
          value={min}
          min={definition.bounds?.min}
          max={definition.bounds?.max}
          onChange={(value) => {
            const next = value === '' ? '' : String(value);
            setMin(next);
            commit(next, max);
          }}
          onBlur={() => commit.flush()}
          clampBehavior="none"
          radius="md"
        />
        <NumberInput
          label="Maximum"
          value={max}
          min={definition.bounds?.min}
          max={definition.bounds?.max}
          onChange={(value) => {
            const next = value === '' ? '' : String(value);
            setMax(next);
            commit(min, next);
          }}
          onBlur={() => commit.flush()}
          clampBehavior="none"
          radius="md"
        />
      </div>
    </FilterFieldset>
  );
}

/**
 * A single date range, stored as `YYYY-MM-DD..YYYY-MM-DD` — exactly the encoding
 * `parseDateRange` in the search domain reads back.
 *
 * Mantine 9 date values are **strings**, and `onChange` always emits strings,
 * so the tuple is written straight into the query without a `Date` round trip.
 */
function DateRangeFilter({ definition }: { definition: FilterDefinition }) {
  const nav = useFilterNavigation();
  const key = attributeKey(definition.code);
  const raw = nav.params[key] ?? '';
  const [from, to] = raw.includes('..') ? raw.split('..') : [raw, ''];
  const value: [string | null, string | null] = [from || null, to || null];

  return (
    <DatePickerInput
      type="range"
      label={definition.label}
      description={definition.helpText ?? undefined}
      placeholder="Any dates"
      value={value}
      onChange={(next) => {
        const [nextFrom, nextTo] = next;
        const encoded = nextFrom || nextTo ? `${nextFrom ?? ''}..${nextTo ?? ''}` : undefined;
        nav.update((params) => setSingleValue(params, key, encoded));
      }}
      valueFormat="D MMM YYYY"
      clearable
      radius="md"
    />
  );
}

/**
 * Renders one category attribute filter from its declared definition.
 *
 * The switch is on `control` first and `dataType` second, because an
 * administrator may override the control (a `MULTI_SELECT` shown as a
 * `RADIO`) — the data type is the fallback, never the other way round. Nothing
 * here decides *which* filters exist: that comes from
 * `getFilterDefinitionsForCategory`, so a new filter is an admin data change.
 */
export function FilterControl({ definition }: { definition: FilterDefinition }) {
  const nav = useFilterNavigation();
  const key = attributeKey(definition.code);
  const control = definition.control;

  const isMulti =
    control === 'CHECKBOX' || control === 'MULTI_SELECT' || definition.dataType === 'MULTI_SELECT';
  const isSingle =
    control === 'RADIO' || control === 'SINGLE_SELECT' || definition.dataType === 'SINGLE_SELECT';

  if (isMulti) {
    const selected = readList(nav.params, key);
    return (
      <FilterFieldset legend={definition.label} help={definition.helpText}>
        <CheckboxOptionList
          options={definition.options}
          selected={selected}
          onToggle={(value) => nav.update((params) => toggleListValue(params, key, value))}
        />
      </FilterFieldset>
    );
  }

  if (isSingle) {
    const [selected = ''] = readList(nav.params, key);
    const name = `filter-${definition.code}`;
    return (
      <FilterFieldset legend={definition.label} help={definition.helpText}>
        <div className={classes.options}>
          {/* Native radios sharing a `name` inside a fieldset: arrow-key
              navigation and the group's accessible name come from HTML. */}
          {definition.options.map((option) => (
            <Radio
              key={option.value}
              className={classes.option}
              name={name}
              label={option.label}
              checked={selected === option.value}
              onChange={() => nav.update((params) => setListValue(params, key, option.value))}
            />
          ))}
        </div>
      </FilterFieldset>
    );
  }

  if (control === 'RANGE' || control === 'SLIDER' || definition.dataType === 'NUMBER') {
    return <NumericRangeFilter definition={definition} />;
  }

  if (control === 'DATE' || definition.dataType === 'DATE') {
    return <DateRangeFilter definition={definition} />;
  }

  if (control === 'BOOLEAN' || definition.dataType === 'BOOLEAN') {
    const isOn = nav.params[key] === 'true';
    return (
      <Switch
        label={definition.label}
        description={definition.helpText ?? undefined}
        checked={isOn}
        onChange={(event) =>
          nav.update((params) =>
            setSingleValue(params, key, event.currentTarget.checked ? 'true' : undefined),
          )
        }
      />
    );
  }

  return <TextFilter definition={definition} />;
}
