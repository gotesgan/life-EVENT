'use client';

import { Pagination, Text } from '@mantine/core';
import { useUrlFilters, type UrlParams } from './use-url-filters';
import classes from './Pagination.module.css';

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  /** Current URL filters, so paging preserves every applied filter. */
  params: UrlParams;
  /** Plural noun for the count line, e.g. "listings". */
  itemLabel: string;
}

/**
 * Result count plus page controls.
 *
 * Paging is a URL write like every other filter, which is what keeps the filter
 * set intact across pages and makes page 4 of a filtered list shareable. The
 * controls are Mantine's real pagination (a `nav` of buttons with generated
 * labels), so arrow keys and Enter work without re-implementing them.
 *
 * The control is **controlled, not uncontrolled**: Mantine's uncontrolled
 * `Pagination` keeps the page it was clicked on, and the filter hook drops
 * `page` from the URL when it merges the patch — so the selection and the URL
 * could disagree until the server round-trip landed. Reading the active page
 * back from the same URL state the page was rendered from keeps the two in step.
 *
 * When there is only one page the strip still renders its count: "Showing 1–8 of
 * 8" is useful, and a footer that sometimes disappears makes the table height
 * jump. Only the controls are conditional.
 */
export function TablePagination({
  page,
  pageSize,
  totalItems,
  params,
  itemLabel,
}: TablePaginationProps) {
  const { navigate } = useUrlFilters(params);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const requestedPage = Number(params.page ?? '');
  const activePage =
    Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages
      ? requestedPage
      : page;

  return (
    <div className={classes.footer}>
      <Text component="p" className={classes.count}>
        {totalItems === 0
          ? `No ${itemLabel}`
          : `Showing ${from}–${to} of ${totalItems} ${itemLabel}`}
      </Text>

      {totalPages > 1 ? (
        <div className={classes.controls}>
          <Pagination
            value={activePage}
            total={totalPages}
            size="sm"
            radius="md"
            siblings={1}
            boundaries={1}
            withEdges
            getControlProps={(control) => ({ 'aria-label': `Go to ${control} page` })}
            onChange={(next) => navigate({ page: String(next) }, { keepPage: true })}
          />
        </div>
      ) : null}
    </div>
  );
}
