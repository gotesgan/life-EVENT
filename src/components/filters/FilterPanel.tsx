'use client';

import { Checkbox, Select } from '@mantine/core';
import { cx } from '@/components/ui/cx';
import {
  readList,
  resetPage,
  setSingleValue,
  toggleFlag,
  toggleListValue,
  type QueryParams,
} from '@/lib/filter-state';
import { ATTRIBUTE_FILTER_PREFIX } from '@/lib/validation/search';
import type { FilterDefinition } from '@/server/domain/search-filters';
import { BudgetRange } from './BudgetRange';
import { CheckboxOptionList, FilterControl, FilterFieldset } from './FilterControl';
import { GuestCapacityRange } from './GuestCapacityRange';
import { useFilterNavigation } from './useFilterNavigation';
import classes from './FilterPanel.module.css';

export interface FilterFacets {
  categories: ReadonlyArray<{ slug: string; name: string; listingCount?: number }>;
  locations: ReadonlyArray<{ slug: string; name: string }>;
  eventTypes: ReadonlyArray<{ slug: string; name: string }>;
  amenities: ReadonlyArray<{ code: string; label: string; groupLabel: string | null }>;
}

export interface FilterPanelProps {
  facets: FilterFacets;
  /**
   * The active category's declared filters. Empty when no category is selected,
   * in which case only the universal filters render and no `f.` parameter can
   * be produced.
   */
  definitions: readonly FilterDefinition[];
  /** Category name, used to label the attribute section honestly. */
  categoryName?: string | null;
  /**
   * `false` renders the panel without its own labels' `htmlFor` collisions in
   * mind — used when the same panel is mounted twice (desktop + drawer).
   */
  idPrefix: string;
  /**
   * Drops the panel's own border and background. The mobile drawer already is
   * the surface, so the same panel must not render card-in-card inside it.
   */
  flush?: boolean;
  /**
   * The catalogue's price and capacity envelope, shown as the opening values of
   * the two range inputs so the scale of what is available is visible without a
   * query. Both default to "no bound".
   */
  bounds?: FilterBounds;
}

export interface FilterBounds {
  priceMin?: number | null;
  priceMax?: number | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
}

/**
 * Removes every `f.<code>` parameter.
 *
 * Category attribute filters only mean something against the category that
 * declared them, so switching category must drop them; sending a stale
 * `f.style` for a category that has no such attribute is a 400 by design. Only
 * attribute keys are removed — location, budget and the rest survive the switch.
 */
function withoutAttributeFilters(params: QueryParams): QueryParams {
  const next: QueryParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith(ATTRIBUTE_FILTER_PREFIX)) continue;
    next[key] = value;
  }
  return resetPage(next);
}

/**
 * The filter surface, rendered from metadata rather than from a hard-coded form.
 *
 * Universal filters (category, location, event type, budget, guests, verified,
 * featured, amenities) always appear. Category attribute filters appear only
 * when a category is active, because they come from that category's bindings.
 *
 * Nothing here keeps local filter state: every control writes to the URL through
 * `useFilterNavigation`, so the URL is the state container and the server-rendered
 * grid is always consistent with what the controls show.
 */
export function FilterPanel({
  facets,
  definitions,
  categoryName,
  idPrefix,
  flush = false,
  bounds,
}: FilterPanelProps) {
  const nav = useFilterNavigation();
  const category = nav.params.category ?? '';
  const location = nav.params.location ?? '';
  const eventTypes = readList(nav.params, 'eventType');
  const amenities = readList(nav.params, 'amenity');

  const amenityGroups = new Map<string, Array<{ code: string; label: string }>>();
  for (const amenity of facets.amenities) {
    const key = amenity.groupLabel ?? 'Other facilities';
    const bucket = amenityGroups.get(key) ?? [];
    bucket.push({ code: amenity.code, label: amenity.label });
    amenityGroups.set(key, bucket);
  }

  const categoryCounts = new Map(
    facets.categories.map((item) => [item.slug, item.listingCount ?? null]),
  );

  return (
    <div className={cx(classes.panel, flush && classes.flush)}>
      <div className={classes.field}>
        <Select
          id={`${idPrefix}-category`}
          label="Category"
          placeholder="All categories"
          data={facets.categories.map((item) => ({ value: item.slug, label: item.name }))}
          value={category || null}
          onChange={(value) =>
            nav.update((params) => {
              const stripped = withoutAttributeFilters(params);
              return setSingleValue(stripped, 'category', value ?? undefined);
            })
          }
          clearable
          searchable
          nothingFoundMessage="No category found"
          radius="md"
          /* The count is real (`COUNT(*)` from the catalogue) and part of the
             scan, so a visitor can see that a category is empty before clicking
             it. It is `aria-hidden`, so the option's accessible name stays
             exactly the category name. */
          renderOption={({ option }) => {
            const count = categoryCounts.get(option.value);
            return (
              <span className={classes.optionLabel}>
                {option.label}
                {typeof count === 'number' ? (
                  <span className={classes.count} aria-hidden>
                    ({count})
                  </span>
                ) : null}
              </span>
            );
          }}
        />
      </div>

      <div className={classes.field}>
        <Select
          id={`${idPrefix}-location`}
          label="City or locality"
          placeholder="Anywhere"
          data={facets.locations.map((item) => ({ value: item.slug, label: item.name }))}
          value={location || null}
          onChange={(value) =>
            nav.update((params) => setSingleValue(params, 'location', value ?? undefined))
          }
          clearable
          searchable
          nothingFoundMessage="No location found"
          radius="md"
        />
      </div>

      {facets.eventTypes.length > 0 ? (
        <FilterFieldset legend="Event type">
          <CheckboxOptionList
            options={facets.eventTypes.map((eventType) => ({
              value: eventType.slug,
              label: eventType.name,
            }))}
            selected={eventTypes}
            onToggle={(value) =>
              nav.update((params) => toggleListValue(params, 'eventType', value))
            }
          />
        </FilterFieldset>
      ) : null}

      <BudgetRange defaultMin={bounds?.priceMin ?? null} defaultMax={bounds?.priceMax ?? null} />
      <GuestCapacityRange
        defaultMin={bounds?.capacityMin ?? null}
        defaultMax={bounds?.capacityMax ?? null}
      />

      <FilterFieldset legend="Show only">
        <div className={classes.switchRow}>
          {/* Checkboxes rather than switches: these are filter criteria that
              combine with the rest of the rail, and every other criterion is a
              tick — one control idiom for one kind of decision. */}
          <Checkbox
            label="Top picks only"
            checked={nav.params.verified === 'true'}
            onChange={() => nav.update((params) => toggleFlag(params, 'verified'))}
          />
          <Checkbox
            label="Featured listings only"
            checked={nav.params.featured === 'true'}
            onChange={() => nav.update((params) => toggleFlag(params, 'featured'))}
          />
        </div>
      </FilterFieldset>

      {amenityGroups.size > 0 ? (
        <FilterFieldset legend="Amenities">
          <div>
            {[...amenityGroups.entries()].map(([groupLabel, items]) => (
              <div key={groupLabel} className={classes.amenityGroup}>
                <p className={classes.amenityLegend}>{groupLabel}</p>
                <CheckboxOptionList
                  options={items.map((amenity) => ({
                    value: amenity.code,
                    label: amenity.label,
                  }))}
                  selected={amenities}
                  onToggle={(value) =>
                    nav.update((params) => toggleListValue(params, 'amenity', value))
                  }
                />
              </div>
            ))}
          </div>
        </FilterFieldset>
      ) : null}

      {category && definitions.length > 0 ? (
        <div className={classes.attributeSection}>
          <p className={classes.sectionTitle}>
            {categoryName ? `${categoryName} filters` : 'Category filters'}
          </p>
          {definitions.map((definition) => (
            <FilterControl key={definition.id} definition={definition} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
