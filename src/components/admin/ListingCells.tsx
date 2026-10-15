import Link from '@/components/ui/ClientLink';
import { Text } from '@mantine/core';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { AspectImage, StatusBadge } from '@/components/ui';
import { formatDateTime, formatPriceRange } from '@/lib/format';
import { RowStack, Truncated } from './AdminTable';
import classes from './AdminPage.module.css';
import {
  PUBLICATION_LABELS,
  PUBLICATION_TONES,
  VERIFICATION_LABELS,
  VERIFICATION_TONES,
  labelFor,
} from './status';

/**
 * Shared listing presentation for the admin tables.
 *
 * Keeping these in one module means the "manage listings" table and the
 * overview's recent-listings table can never disagree about what "Unpublished"
 * looks like. Nothing here names a colour: tones come from `status.ts`, which
 * maps to the shared `StatusBadge` tone tokens.
 */

export interface AdminListingRow {
  id: string;
  slug: string;
  name: string;
  publicationStatus: string;
  verificationStatus: string;
  isFeatured: boolean;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  updatedAt: Date;
  publishedAt: Date | null;
  primaryCategory: { name: string; slug: string } | null;
  primaryLocation: { name: string; slug: string } | null;
  _count: { media: number; enquiryListings: number };
  media: Array<{ publicUrl: string | null; altText: string }>;
}

export function PublicationBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={PUBLICATION_TONES[status] ?? 'neutral'} size="sm" dot>
      {labelFor(PUBLICATION_LABELS, status)}
    </StatusBadge>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={VERIFICATION_TONES[status] ?? 'neutral'} size="sm">
      {labelFor(VERIFICATION_LABELS, status)}
    </StatusBadge>
  );
}

export function ListingCoverThumb({ row }: { row: AdminListingRow }) {
  const cover = row.media[0];
  return (
    <div className={classes.thumb}>
      <AspectImage
        src={cover?.publicUrl ?? null}
        alt={cover?.altText ?? row.name}
        ratio="3/2"
        sizes="56px"
        seed={row.slug}
      />
    </div>
  );
}

/**
 * The listing's identity column: a name that links to the editor and the slug
 * the public URL uses. The name is clamped to one line and carries `title`, so a
 * long business name cannot wrap the row and the full value stays readable.
 */
export function ListingNameCell({ row }: { row: AdminListingRow }) {
  return (
    <RowStack>
      <Text
        component={Link}
        href={`/admin/listings/${row.id}`}
        size="sm"
        fw={600}
        c="var(--app-text)"
        title={row.name}
        className={classes.truncate}
      >
        {row.name}
      </Text>
      <Truncated title={`/vendors/${row.slug}`}>
        <Text component="span" size="xs" c="dimmed">
          /{row.slug}
        </Text>
      </Truncated>
    </RowStack>
  );
}

/** A category or location name, or an honest em dash when there is none. */
export function ListingReferenceCell({ name }: { name: string | null }) {
  if (!name) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <Truncated title={name}>
      <Text component="span" size="sm">
        {name}
      </Text>
    </Truncated>
  );
}

/** Price, right-aligned and tabular so a column of figures can be compared. */
export function ListingPriceCell({ row }: { row: AdminListingRow }) {
  const hasPrice = row.priceMin !== null || row.priceMax !== null;
  const label = priceCell(row);

  return (
    <Truncated title={hasPrice ? label : 'No price published'}>
      <Text
        component="span"
        size="sm"
        c={hasPrice ? undefined : 'dimmed'}
        className={classes.tabularValue}
      >
        {label}
      </Text>
    </Truncated>
  );
}

/** A count in a column: right-aligned, tabular, and never abbreviated. */
export function ListingCountCell({ value }: { value: number }) {
  return (
    <Text size="sm" className={classes.tabularValue}>
      {value}
    </Text>
  );
}

/** The record's last-modified time. Tabular so the column edges line up. */
export function ListingTimestampCell({ value }: { value: Date }) {
  const formatted = formatDateTime(value);
  return (
    <Text component="span" size="sm" className={classes.timestamp} title={formatted ?? undefined}>
      {formatted ?? '—'}
    </Text>
  );
}

export function priceCell(row: AdminListingRow): string {
  return (
    formatPriceRange({
      priceMin: row.priceMin,
      priceMax: row.priceMax,
      priceUnit: row.priceUnit,
    }) ?? '—'
  );
}

/**
 * The compact column set used by the overview's recent-listings table.
 *
 * Same cell components as the full directory table, so "Unpublished" cannot
 * look like two different things on two screens, and a truncated listing name
 * is truncated in both.
 */
export const RECENT_LISTING_COLUMNS: ReadonlyArray<DataTableColumn<AdminListingRow>> = [
  { key: 'cover', header: 'Cover', width: 72, render: (row) => <ListingCoverThumb row={row} /> },
  { key: 'name', header: 'Listing', width: 240, render: (row) => <ListingNameCell row={row} /> },
  {
    key: 'category',
    header: 'Category',
    width: 150,
    render: (row) => <ListingReferenceCell name={row.primaryCategory?.name ?? null} />,
  },
  {
    key: 'publication',
    header: 'Publication',
    width: 140,
    render: (row) => <PublicationBadge status={row.publicationStatus} />,
  },
  {
    key: 'verification',
    header: 'Verification',
    width: 160,
    render: (row) => <VerificationBadge status={row.verificationStatus} />,
  },
  {
    key: 'updated',
    header: 'Updated',
    width: 160,
    render: (row) => <ListingTimestampCell value={row.updatedAt} />,
  },
];
