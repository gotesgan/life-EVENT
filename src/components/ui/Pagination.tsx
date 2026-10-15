'use client';

import { useMemo } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { cx } from './cx';
import classes from './Pagination.module.css';

const DOTS = 'dots' as const;

export interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Pages either side of the current one. */
  siblings?: number;
  /** Pages pinned at each end. */
  boundaries?: number;
  /** Renders first/last controls in addition to previous/next. */
  withEdges?: boolean;
  /** Renders previous/next controls. */
  withControls?: boolean;
  /**
   * Accessible name of the containing landmark. Defaults to "Pagination"; pass
   * something more specific ("Listing pages") when a page has two lists.
   */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

type Item = number | typeof DOTS;

/**
 * The page-window algorithm: boundaries at the ends, `siblings` either side of
 * the current page, and a single ellipsis wherever a gap is left. The ellipsis
 * is a real gap in the sequence, which is why it is one unlabelled item rather
 * than a truncated pile of numbers.
 */
function buildRange(page: number, total: number, siblings: number, boundaries: number): Item[] {
  const windowSize = siblings * 2 + 3 + boundaries * 2;
  if (windowSize >= total) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const leftSibling = Math.max(page - siblings, boundaries + 1);
  const rightSibling = Math.min(page + siblings, total - boundaries);
  const showLeftDots = leftSibling > boundaries + 2;
  const showRightDots = rightSibling < total - boundaries - 1;

  const items: Item[] = [];
  for (let index = 1; index <= boundaries; index += 1) items.push(index);

  if (showLeftDots) {
    items.push(DOTS);
  } else {
    for (let index = boundaries + 1; index < leftSibling; index += 1) items.push(index);
  }

  for (let index = leftSibling; index <= rightSibling; index += 1) items.push(index);

  if (showRightDots) {
    items.push(DOTS);
  } else {
    for (let index = rightSibling + 1; index <= total - boundaries; index += 1) items.push(index);
  }

  for (let index = total - boundaries + 1; index <= total; index += 1) items.push(index);

  return items;
}

/**
 * Offset pagination for any list.
 *
 * Deliberately callback-driven rather than URL-driven: the browse grid needs
 * crawlable `<a>` elements and owns its own link-building, while an account or
 * admin table just needs to change state. This primitive is the shared *look*
 * and state set, and the caller decides what a page change means.
 *
 * Every control is a real `<button>` carrying `aria-current="page"` on the
 * active page, so the control is reachable, announced and operable by keyboard
 * without re-implementing button semantics.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  siblings = 1,
  boundaries = 1,
  withEdges = false,
  withControls = true,
  label = 'Pagination',
  size = 'md',
  className,
}: PaginationProps) {
  const items = useMemo(
    () => buildRange(page, Math.max(totalPages, 1), siblings, boundaries),
    [page, totalPages, siblings, boundaries],
  );

  if (totalPages <= 1) return null;

  const go = (next: number) => {
    if (next < 1 || next > totalPages || next === page) return;
    onChange(next);
  };

  return (
    <nav aria-label={label} className={cx(classes.nav, size === 'sm' && classes.sm, className)}>
      <ul className={classes.list}>
        {withEdges ? (
          <li>
            <button
              type="button"
              className={classes.control}
              onClick={() => go(1)}
              disabled={page === 1}
              aria-label="Go to first page"
            >
              <span aria-hidden>«</span>
            </button>
          </li>
        ) : null}

        {withControls ? (
          <li>
            <button
              type="button"
              className={classes.control}
              onClick={() => go(page - 1)}
              disabled={page === 1}
              aria-label="Go to previous page"
            >
              <IconChevronLeft size={16} stroke={1.5} aria-hidden />
            </button>
          </li>
        ) : null}

        {items.map((item, index) =>
          item === DOTS ? (
            <li key={`dots-${index}`} className={classes.dots} aria-hidden>
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={classes.control}
                onClick={() => go(item)}
                aria-label={item === page ? `Page ${item}, current page` : `Go to page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            </li>
          ),
        )}

        {withControls ? (
          <li>
            <button
              type="button"
              className={classes.control}
              onClick={() => go(page + 1)}
              disabled={page === totalPages}
              aria-label="Go to next page"
            >
              <IconChevronRight size={16} stroke={1.5} aria-hidden />
            </button>
          </li>
        ) : null}

        {withEdges ? (
          <li>
            <button
              type="button"
              className={classes.control}
              onClick={() => go(totalPages)}
              disabled={page === totalPages}
              aria-label="Go to last page"
            >
              <span aria-hidden>»</span>
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
