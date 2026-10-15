import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from '@/components/ui/ClientLink';
import { IconInbox } from '@tabler/icons-react';
import { Button, EmptyState, PageHeader, TableSkeleton } from '@/components/ui';
import { adminListEnquiries } from '@/server/services/admin-enquiry.service';
import { adminEnquiryQuerySchema, type AdminEnquiryQuery } from '@/lib/validation/enquiry';
import { describeError } from '../_lib/errors';
import { parsePageQuery, toUrlParams, type PageSearchParams } from '../_lib/query';
import { categorySelectOptions, eventTypeSelectOptions, type SelectOption } from '../_lib/options';
import { assigneeSelectOptions, listingFilterOptions } from './_lib/options';
import { RetryState } from '@/components/admin/RetryState';
import { EnquiryFilters } from '@/components/admin/EnquiryFilters';
import { EnquiryInbox } from '@/components/admin/EnquiryInbox';
import { ENQUIRY_FILTER_KEYS } from '@/components/admin/filter-keys';
import type { UrlParams } from '@/components/admin/use-url-filters';

export const metadata = { title: 'Enquiries' };

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const raw = await searchParams;
  const query = parsePageQuery(adminEnquiryQuerySchema, raw);
  const urlParams = toUrlParams(raw);

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Every customer brief, with one lead per business it was sent to. Triage from here; open an enquiry to follow a single provider lead."
      />

      <Suspense fallback={<TableSkeleton rows={1} columns={6} />}>
        <EnquiriesResult query={query} urlParams={urlParams} />
      </Suspense>
    </div>
  );
}

async function EnquiriesResult({
  query,
  urlParams,
}: {
  query: AdminEnquiryQuery;
  urlParams: UrlParams;
}) {
  // Request-time by definition: the filters come from the URL and the panel is
  // authenticated, so nothing here may be evaluated during prerendering.
  await connection();

  let result: Awaited<ReturnType<typeof adminListEnquiries>>;
  let categoryOptions: SelectOption[];
  let eventTypeOptions: SelectOption[];
  let assigneeOptions: SelectOption[];
  let listingOptions: SelectOption[];

  try {
    [result, categoryOptions, eventTypeOptions, assigneeOptions, listingOptions] =
      await Promise.all([
        adminListEnquiries(query),
        categorySelectOptions(true),
        eventTypeSelectOptions(),
        assigneeSelectOptions(),
        listingFilterOptions(),
      ]);
  } catch (error) {
    return <RetryState title="Could not load the enquiry inbox" detail={describeError(error)} />;
  }

  const activeCount = ENQUIRY_FILTER_KEYS.filter(
    (key) => urlParams[key] !== undefined && urlParams[key] !== '',
  ).length;

  return (
    <>
      <div style={{ marginTop: 'var(--mantine-spacing-lg)' }}>
        <EnquiryFilters
          current={urlParams}
          categoryOptions={categoryOptions}
          eventTypeOptions={eventTypeOptions}
          assigneeOptions={assigneeOptions}
          listingOptions={listingOptions}
          resultCount={result.pagination.totalItems}
        />
      </div>

      <div style={{ marginTop: 'var(--mantine-spacing-md)' }}>
        <EnquiryInbox
          rows={result.data}
          params={urlParams}
          page={result.pagination.page}
          pageSize={result.pagination.pageSize}
          totalItems={result.pagination.totalItems}
          emptyState={
            activeCount > 0 ? (
              <EmptyState
                title="No enquiries match these filters"
                description="Loosen or clear the filters to see more of the inbox."
              />
            ) : (
              <EmptyState
                icon={<IconInbox size={20} stroke={1.5} />}
                title="No enquiries yet"
                description="Customer enquiries land here as soon as the first one is sent from the public site."
                primaryAction={
                  <Button component={Link} href="/admin/listings" variant="default">
                    Browse listings
                  </Button>
                }
              />
            )
          }
        />
      </div>
    </>
  );
}
