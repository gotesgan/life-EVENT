import { Skeleton } from '@mantine/core';
import { cx } from './cx';
import classes from './Skeletons.module.css';

/**
 * Loading placeholders.
 *
 * Every skeleton here mirrors the *real* component's box model — same padding,
 * same aspect ratios, same row heights — so swapping a skeleton for content does
 * not move the page. The listing-card skeleton implements the fixed anatomy from
 * `docs/marketplace-styling-guide.md` §1.5 exactly, in order:
 *
 *   media 3:2 · title (2 lines reserved) · meta 18px · meta 18px ·
 *   anchor 26px · hairline 1px · action 40px
 *
 * The row heights come from the type tokens rather than from literals, so a
 * change to `--text-card-title-size` moves the skeleton and the card together.
 *
 * Skeletons are decorative (`aria-hidden`); the containers carry
 * `role="status"` and `aria-busy`, so a screen reader hears one "loading"
 * announcement instead of forty empty boxes.
 */

export interface SkeletonProps {
  className?: string;
}

/** Mirrors a listing card. Used by every vendor/venue grid. */
export function ListingCardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cx(classes.card, className)} aria-hidden>
      <div className={classes.cardMedia}>
        <Skeleton height="100%" width="100%" radius="sm" />
      </div>

      <div className={classes.cardBody}>
        {/* Title, in the reserved two-line box. */}
        <Skeleton className={classes.cardTitle} radius="sm" />
        <Skeleton className={classes.cardMetaFirst} height={18} width="52%" radius="sm" />
        <Skeleton className={classes.cardMeta} height={18} width="38%" radius="sm" />
        {/* The scan anchor: same 26px row the real card reserves. */}
        <Skeleton className={classes.cardAnchor} width="56%" radius="sm" />
        <div className={classes.cardDivider} />
        <Skeleton className={classes.cardAction} radius="md" />
      </div>
    </div>
  );
}

export interface ListingGridSkeletonProps extends SkeletonProps {
  /** Match the expected page size so the grid height does not jump. */
  count?: number;
}

/** Mirrors the responsive listing grid (`auto-fill`, min 280px, 16:10 media). */
export function ListingGridSkeleton({ count = 6, className }: ListingGridSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading listings"
      className={cx(classes.grid, className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Mirrors a listing detail page: 16:9 hero, title block, body + sticky rail. */
export function ListingDetailSkeleton({ className }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading listing"
      className={cx(classes.root, className)}
    >
      <div className={classes.detailHero}>
        <Skeleton height="100%" width="100%" radius="sm" />
      </div>

      <div className={classes.detailHead} aria-hidden>
        <Skeleton height={13} width={160} radius="sm" />
        <Skeleton height={30} width="58%" radius="sm" />
        <Skeleton height={16} width="34%" radius="sm" />
        <div className={classes.chipRow}>
          <Skeleton height={24} width={110} radius="xl" />
          <Skeleton height={24} width={96} radius="xl" />
          <Skeleton height={24} width={132} radius="xl" />
        </div>
      </div>

      <div className={classes.detailBody}>
        <div className={classes.detailMain} aria-hidden>
          <Skeleton height={20} width="36%" radius="sm" />
          <Skeleton height={14} width="100%" radius="sm" />
          <Skeleton height={14} width="94%" radius="sm" />
          <Skeleton height={14} width="88%" radius="sm" />
          <Skeleton height={20} width="42%" radius="sm" />
          <Skeleton height={14} width="96%" radius="sm" />
          <Skeleton height={14} width="72%" radius="sm" />
          <div className={classes.detailTiles}>
            <Skeleton height={88} radius="md" />
            <Skeleton height={88} radius="md" />
            <Skeleton height={88} radius="md" />
          </div>
        </div>

        <div className={classes.detailRail} aria-hidden>
          <div className={classes.railCard}>
            <Skeleton height={22} width="66%" radius="sm" />
            <Skeleton height={14} width="44%" radius="sm" />
            <Skeleton height={40} radius="md" />
            <Skeleton height={40} radius="md" />
          </div>
          <div className={classes.railCard}>
            <Skeleton height={16} width="52%" radius="sm" />
            <Skeleton height={13} width="80%" radius="sm" />
            <Skeleton height={13} width="68%" radius="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export interface TableSkeletonProps extends SkeletonProps {
  rows?: number;
  columns?: number;
}

/** Mirrors the admin `DataTable` density: 44px rows, 40px header. */
export function TableSkeleton({ rows = 8, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading table"
      className={cx(classes.table, className)}
      style={{ ['--table-columns' as string]: String(columns) }}
    >
      <div className={cx(classes.tableRow, classes.tableHead)} aria-hidden>
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} height={12} width={index === 0 ? '70%' : '55%'} radius="sm" />
        ))}
      </div>

      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className={classes.tableRow} aria-hidden>
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              height={14}
              width={colIndex === 0 ? '76%' : '60%'}
              radius="sm"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface FilterPanelSkeletonProps extends SkeletonProps {
  groups?: number;
  optionsPerGroup?: number;
}

/** Mirrors the filter rail: group label + checkbox rows. */
export function FilterPanelSkeleton({
  groups = 3,
  optionsPerGroup = 4,
  className,
}: FilterPanelSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading filters"
      className={cx(classes.filters, className)}
    >
      {Array.from({ length: groups }, (_, groupIndex) => (
        <div key={groupIndex} className={classes.filterGroup} aria-hidden>
          <Skeleton height={13} width="44%" radius="sm" />
          {Array.from({ length: optionsPerGroup }, (_, optionIndex) => (
            <div key={optionIndex} className={classes.filterOption}>
              <Skeleton height={16} width={16} radius="xs" />
              <Skeleton height={12} width={`${72 - optionIndex * 9}%`} radius="sm" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
