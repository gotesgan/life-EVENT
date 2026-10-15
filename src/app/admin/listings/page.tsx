import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from '@/components/ui/ClientLink';
import { Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Button, DataTable, EmptyState, PageHeader, TableSkeleton } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { adminListListings } from '@/server/services/listing.service';
import { adminListingQuerySchema, type AdminListingQuery } from '@/lib/validation/listing';
import { describeError } from '../_lib/errors';
import { parsePageQuery, toUrlParams, type PageSearchParams } from '../_lib/query';
import { categorySelectOptions, locationSelectOptions } from '../_lib/options';
import { RetryState } from '@/components/admin/RetryState';
import type { UrlParams } from '@/components/admin/use-url-filters';
import { ListingsFilters } from '@/components/admin/ListingsFilters';
import { LISTING_FILTER_KEYS } from '@/app/admin/_lib/listing-filter-keys';
import { TablePagination } from '@/components/admin/TablePagination';
import { ListingRowActions } from '@/components/admin/ListingRowActions';
import {
  ListingCountCell,
  ListingCoverThumb,
  ListingNameCell,
  ListingPriceCell,
  ListingReferenceCell,
  ListingTimestampCell,
  PublicationBadge,
  VerificationBadge,
  type AdminListingRow,
} from '@/components/admin/ListingCells';
import { AdminTableRegion } from '@/components/admin/AdminTable';
import { StatusBadge } from '@/components/ui';
import pageClasses from '@/components/admin/AdminPage.module.css';

export const metadata = { title: 'Listings' };

/**
 * Column set for the directory table.
 *
 * The table reads as a table, not as cards: one header treatment, one row
 * separation method (zebra), image and count columns right-aligned with tabular
 * numerals, and every long text value truncated with a `title` so the full value
 * is still readable. The right-hand columns are the operands — a reviewer scans
 * down them, so they are the ones that must align.
 */
const COLUMNS: ReadonlyArray<DataTableColumn<AdminListingRow>> = [
  { key: 'cover', header: 'Cover', width: 72, render: (row) => <ListingCoverThumb row={row} /> },
  { key: 'name', header: 'Listing', width: 240, render: (row) => <ListingNameCell row={row} /> },
  {
    key: 'category',
    header: 'Category',
    width: 150,
    render: (row) => <ListingReferenceCell name={row.primaryCategory?.name ?? null} />,
  },
  {
    key: 'location',
    header: 'Location',
    width: 150,
    render: (row) => <ListingReferenceCell name={row.primaryLocation?.name ?? null} />,
  },
  {
    key: 'price',
    header: 'Price',
    width: 170,
    align: 'end',
    render: (row) => <ListingPriceCell row={row} />,
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
    key: 'featured',
    header: 'Featured',
    width: 110,
    render: (row) =>
      row.isFeatured ? (
        <StatusBadge tone="accent" size="sm">
          Featured
        </StatusBadge>
      ) : (
        <Text size="sm" c="dimmed">
          No
        </Text>
      ),
  },
  {
    key: 'media',
    header: 'Images',
    width: 84,
    align: 'end',
    render: (row) => <ListingCountCell value={row._count.media} />,
  },
  {
    key: 'enquiries',
    header: 'Enquiries',
    width: 100,
    align: 'end',
    render: (row) => <ListingCountCell value={row._count.enquiryListings} />,
  },
  {
    key: 'updated',
    header: 'Updated',
    width: 160,
    render: (row) => <ListingTimestampCell value={row.updatedAt} />,
  },
  {
    key: 'actions',
    header: 'Actions',
    width: 60,
    align: 'end',
    render: (row) => (
      <ListingRowActions
        id={row.id}
        name={row.name}
        slug={row.slug}
        publicationStatus={row.publicationStatus}
        verificationStatus={row.verificationStatus}
      />
    ),
  },
];

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const raw = await searchParams;
  const query = parsePageQuery(adminListingQuerySchema, raw);
  const urlParams = toUrlParams(raw);

  const [categoryOptions, locationOptions] = await Promise.all([
    categorySelectOptions(true),
    locationSelectOptions(false),
  ]);

  return (
    <div>
      <PageHeader
        title="Listings"
        description="Every provider record in the directory. Administrators maintain these on the provider's behalf — there is no vendor login."
        actions={
          <Button
            component={Link}
            href="/admin/listings/new"
            leftSection={<IconPlus size={16} stroke={1.5} />}
          >
            New listing
          </Button>
        }
      />

      <Suspense fallback={<TableSkeleton rows={1} columns={6} />}>
        <ListingsResult
          query={query}
          urlParams={urlParams}
          categoryOptions={categoryOptions}
          locationOptions={locationOptions}
        />
      </Suspense>
    </div>
  );
}

async function ListingsResult({
  query,
  urlParams,
  categoryOptions,
  locationOptions,
}: {
  query: AdminListingQuery;
  urlParams: UrlParams;
  categoryOptions: Array<{ value: string; label: string }>;
  locationOptions: Array<{ value: string; label: string }>;
}) {
  // Request-time by definition: this data is per-request (listing filters are
  // supplied per navigation, and the panel is authenticated). Declaring the
  // dependency explicitly keeps the query off the prerender path.
  await connection();

  let result: Awaited<ReturnType<typeof adminListListings>>;
  try {
    result = await adminListListings(query);
  } catch (error) {
    return <RetryState title="Could not load listings" detail={describeError(error)} />;
  }

  const activeCount = LISTING_FILTER_KEYS.filter((key) => urlParams[key]).length;

  return (
    <>
      <div className={pageClasses.toolbar}>
        <ListingsFilters
          current={urlParams}
          categoryOptions={categoryOptions}
          locationOptions={locationOptions}
          resultCount={result.totalItems}
        />
      </div>

      <AdminTableRegion>
        <DataTable
          caption="Provider listings"
          columns={COLUMNS}
          rows={result.rows}
          getRowKey={(row) => row.id}
          minWidth={1240}
          emptyState={
            activeCount > 0 ? (
              <EmptyState
                title="No listings match these filters"
                description="Loosen or clear the filters to see more of the directory."
              />
            ) : (
              <EmptyState
                icon={<IconPlus size={20} stroke={1.5} />}
                title="No listings yet"
                description="Add the first provider record. It is saved as a draft until it has an image and a description."
                primaryAction={
                  <Button
                    component={Link}
                    href="/admin/listings/new"
                    leftSection={<IconPlus size={16} stroke={1.5} />}
                  >
                    New listing
                  </Button>
                }
              />
            )
          }
        />

        <TablePagination
          page={query.page}
          pageSize={query.pageSize}
          totalItems={result.totalItems}
          params={urlParams}
          itemLabel="listings"
        />
      </AdminTableRegion>
    </>
  );
}
