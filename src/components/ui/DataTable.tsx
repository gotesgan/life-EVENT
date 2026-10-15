import type { CSSProperties, Key, ReactNode } from 'react';
import {
  Skeleton,
  Table,
  TableCaption,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
} from '@mantine/core';
import { cx } from './cx';
import classes from './DataTable.module.css';

export interface DataTableColumn<Row> {
  /** Stable identity for the column; must be unique within `columns`. */
  key: string;
  header: ReactNode;
  /** Number (px) or any CSS width. Numbers also feed the scroll `minWidth`. */
  width?: number | string;
  align?: 'start' | 'center' | 'end';
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  getRowKey: (row: Row, index: number) => Key;
  /**
   * Rendered inside a full-width cell, so the column headers stay visible.
   * Pass an `EmptyState` for an actionable empty result.
   */
  emptyState?: ReactNode;
  isLoading?: boolean;
  /** Visible table caption, also the accessible description of the table. */
  caption?: string;
  /** Skeleton row count while `isLoading`. Defaults to 6. */
  skeletonRowCount?: number;
  /** Overrides the computed `min-width` of the scroll container. */
  minWidth?: number | string;
  stickyHeader?: boolean;
  className?: string;
}

const ALIGN_CLASS: Record<'start' | 'center' | 'end', string> = {
  start: classes.alignStart,
  center: classes.alignCenter,
  end: classes.alignEnd,
};

function alignClass(align: DataTableColumn<unknown>['align']): string | undefined {
  return align ? ALIGN_CLASS[align] : undefined;
}

function cellStyle(width?: number | string): CSSProperties | undefined {
  return width === undefined
    ? undefined
    : { width: typeof width === 'number' ? `${width}px` : width };
}

/**
 * Generic admin table.
 *
 * Mantine 9 has no data-grid package, so this is a thin, typed composition of
 * `Table` primitives — no sorting or filtering state, which stays with the page.
 *
 * Built on **named** `Table*` exports rather than `Table.Thead`-style statics:
 * compound components cannot be used from a Server Component, and this component
 * must work in both. It also means `render(row)` can be a plain function defined
 * inline by a Server Component (a function prop cannot cross into a Client
 * Component).
 *
 * Three states, all handled here so no page re-implements them:
 *  - `isLoading` → skeleton rows shaped like the real columns;
 *  - no rows → `emptyState` inside the table body, headers intact;
 *  - rows → normal rendering.
 *
 * `th` always carries `scope="col"`, and the whole table is wrapped in
 * `TableScrollContainer`, so a wide admin table scrolls inside its own box and
 * can never push the page sideways.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyState,
  isLoading = false,
  caption,
  skeletonRowCount = 6,
  minWidth,
  stickyHeader = false,
  className,
}: DataTableProps<Row>) {
  const showSkeleton = isLoading;
  const showEmpty = !showSkeleton && rows.length === 0;

  const computedMinWidth =
    minWidth ??
    columns.reduce(
      (total, column) => total + (typeof column.width === 'number' ? column.width : 160),
      0,
    );

  return (
    <div className={cx(classes.root, className)}>
      <TableScrollContainer minWidth={computedMinWidth} type="native" className={classes.scroller}>
        <Table
          withTableBorder
          withRowBorders
          borderColor="var(--app-border)"
          horizontalSpacing="md"
          verticalSpacing="sm"
          highlightOnHover={!showEmpty && !showSkeleton}
          highlightOnHoverColor="var(--app-surface-muted)"
          stickyHeader={stickyHeader}
          tabularNums
          className={classes.table}
        >
          {caption ? <TableCaption className={classes.caption}>{caption}</TableCaption> : null}

          <TableThead className={classes.thead}>
            <TableTr>
              {columns.map((column) => (
                <TableTh
                  key={column.key}
                  scope="col"
                  className={cx(classes.th, alignClass(column.align))}
                  style={cellStyle(column.width)}
                >
                  {column.header}
                </TableTh>
              ))}
            </TableTr>
          </TableThead>

          <TableTbody>
            {showSkeleton
              ? Array.from({ length: skeletonRowCount }, (_, rowIndex) => (
                  <TableTr key={rowIndex}>
                    {columns.map((column) => (
                      <TableTd
                        key={column.key}
                        className={cx(classes.td, alignClass(column.align))}
                      >
                        <Skeleton height={14} width="72%" radius="sm" />
                      </TableTd>
                    ))}
                  </TableTr>
                ))
              : null}

            {showEmpty ? (
              <TableTr>
                <TableTd colSpan={columns.length} className={classes.stateCell}>
                  {emptyState ?? <p className={classes.defaultEmpty}>Nothing to show yet.</p>}
                </TableTd>
              </TableTr>
            ) : null}

            {!showSkeleton && !showEmpty
              ? rows.map((row, index) => (
                  <TableTr key={getRowKey(row, index)}>
                    {columns.map((column) => (
                      <TableTd
                        key={column.key}
                        className={cx(classes.td, alignClass(column.align))}
                      >
                        {column.render(row)}
                      </TableTd>
                    ))}
                  </TableTr>
                ))
              : null}
          </TableTbody>
        </Table>
      </TableScrollContainer>
    </div>
  );
}
