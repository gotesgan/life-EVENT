'use client';

import { Button, Drawer, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { clearAllFilters } from '@/lib/filter-state';
import { FilterPanel, type FilterBounds, type FilterFacets } from './FilterPanel';
import { useFilterNavigation } from './useFilterNavigation';
import type { FilterDefinition } from '@/server/domain/search-filters';
import classes from './MobileFilterDrawer.module.css';

export interface MobileFilterDrawerProps {
  facets: FilterFacets;
  definitions: readonly FilterDefinition[];
  categoryName?: string | null;
  activeFilterCount: number;
  /** The exact number the results header shows, so the button cannot lie. */
  resultCount: number;
  /** Catalogue envelope for the budget and capacity range inputs. */
  bounds?: FilterBounds;
}

/**
 * The mobile filter surface: a bottom-sheet `Drawer`.
 *
 * Mantine's `Drawer` traps focus, closes on Escape, locks scroll and returns
 * focus to the trigger — all defaults, none disabled. "Show N results" only
 * closes the sheet: every control has already written its change to the URL, so
 * there is no separate "apply" state that could drift from what is displayed.
 */
export function MobileFilterDrawer({
  facets,
  definitions,
  categoryName,
  activeFilterCount,
  resultCount,
  bounds,
}: MobileFilterDrawerProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const nav = useFilterNavigation();

  return (
    <>
      <div className={classes.triggerRow}>
        <Button
          variant="default"
          onClick={open}
          leftSection={<IconAdjustmentsHorizontal size="1.125rem" stroke={1.5} aria-hidden />}
          aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
      </div>

      <Drawer
        opened={opened}
        onClose={close}
        position="bottom"
        size="min(85dvh, 620px)"
        radius="lg"
        offset={8}
        title="Filters"
        scrollAreaComponent={ScrollArea.Autosize}
        overlayProps={{ backgroundOpacity: 0.45, blur: 3 }}
        transitionProps={{ transition: 'slide-up', duration: 200 }}
        closeButtonProps={{ 'aria-label': 'Close filters' }}
      >
        <FilterPanel
          facets={facets}
          definitions={definitions}
          bounds={bounds}
          categoryName={categoryName}
          idPrefix="drawer"
          flush
        />

        <div className={classes.drawerFooter}>
          <Button
            variant="default"
            onClick={() => nav.update((params) => clearAllFilters(params, { keep: ['category'] }))}
          >
            Reset
          </Button>
          <Button onClick={close}>Show {resultCount} results</Button>
        </div>
      </Drawer>
    </>
  );
}
