import Link from 'next/link';
import { buildQuery, setPage, setSingleValue, type QueryParams } from '@/lib/filter-state';
import { CUSTOMER_STATUS_LABELS } from '@/server/domain/enquiry-status';
import type { CustomerEnquirySummary } from '@/server/dto/enquiry.dto';
import { cx } from '@/components/ui';
import classes from './EnquiryFilters.module.css';

type EnquiryStatusValue = CustomerEnquirySummary['status'];

/**
 * The statuses a customer can filter by.
 *
 * `DUPLICATE` and `SPAM` are deliberately absent: both map to the single
 * customer-facing label "Closed", so offering them would present two identical
 * filters distinguished only by an internal code.
 */
const FILTERABLE: ReadonlyArray<{ value: EnquiryStatusValue; label: string }> = [
  { value: 'NEW', label: CUSTOMER_STATUS_LABELS.NEW },
  { value: 'CONTACTED', label: CUSTOMER_STATUS_LABELS.CONTACTED },
  { value: 'QUALIFIED', label: CUSTOMER_STATUS_LABELS.QUALIFIED },
  { value: 'SHARED_WITH_PROVIDER', label: CUSTOMER_STATUS_LABELS.SHARED_WITH_PROVIDER },
  { value: 'CONVERTED', label: CUSTOMER_STATUS_LABELS.CONVERTED },
  { value: 'LOST', label: CUSTOMER_STATUS_LABELS.LOST },
  { value: 'CANCELLED', label: CUSTOMER_STATUS_LABELS.CANCELLED },
];

export function isFilterableStatus(value: string | undefined): value is EnquiryStatusValue {
  return FILTERABLE.some((option) => option.value === value);
}

export interface EnquiryStatusFiltersProps {
  /** Current query state, so every change preserves the other parameters. */
  params: QueryParams;
  active: EnquiryStatusValue | null;
}

/**
 * Status filter chips, as links.
 *
 * Filter state lives entirely in the URL and is edited with the shared
 * `filter-state` helpers, so a status change resets pagination the same way it
 * does on the vendor search. No client JavaScript is involved: each chip is an
 * anchor the browser can open in a new tab.
 */
export function EnquiryStatusFilters({ params, active }: EnquiryStatusFiltersProps) {
  return (
    <nav className={classes.filters} aria-label="Filter enquiries by status">
      <ul className={classes.chipList}>
        <li>
          <Link
            href={`/account/enquiries${buildQuery(setSingleValue(params, 'status', undefined))}`}
            className={cx(classes.chip, active === null && classes.chipActive)}
            aria-current={active === null ? 'page' : undefined}
          >
            All
          </Link>
        </li>
        {FILTERABLE.map((option) => {
          const isActive = active === option.value;
          return (
            <li key={option.value}>
              <Link
                href={`/account/enquiries${buildQuery(
                  setSingleValue(params, 'status', option.value),
                )}`}
                className={cx(classes.chip, isActive && classes.chipActive)}
                aria-current={isActive ? 'page' : undefined}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface EnquiryPaginationProps {
  params: QueryParams;
  page: number;
  totalPages: number;
}

/** Previous/next links built from the same query object, so filters survive. */
export function EnquiryPagination({ params, page, totalPages }: EnquiryPaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className={classes.pagination} aria-label="Enquiry pages">
      {hasPrevious ? (
        <Link
          className={classes.pageLink}
          href={`/account/enquiries${buildQuery(setPage(params, page - 1))}`}
          rel="prev"
        >
          Previous
        </Link>
      ) : (
        <span className={cx(classes.pageLink, classes.pageLinkDisabled)} aria-disabled="true">
          Previous
        </span>
      )}

      <p className={classes.pageStatus} aria-live="polite">
        Page {page} of {totalPages}
      </p>

      {hasNext ? (
        <Link
          className={classes.pageLink}
          href={`/account/enquiries${buildQuery(setPage(params, page + 1))}`}
          rel="next"
        >
          Next
        </Link>
      ) : (
        <span className={cx(classes.pageLink, classes.pageLinkDisabled)} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
