import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { redirect } from 'next/navigation';
import { Button } from '@mantine/core';
import { AccountNav } from '@/components/account/AccountNav';
import { EnquiryStatusBadge } from '@/components/account/EnquiryStatusBadge';
import {
  EnquiryPagination,
  EnquiryStatusFilters,
  isFilterableStatus,
} from '@/components/account/EnquiryFilters';
import { SiteShell } from '@/components/layout/SiteShell';
import { ClientLink, Container, EmptyState, PageHeader, Surface } from '@/components/ui';
import { getCurrentActor } from '@/lib/auth/actor';
import { buildQuery, clearAllFilters, setPage, type QueryParams } from '@/lib/filter-state';
import { formatDate, pluralise } from '@/lib/format';
import { listCustomerEnquiries } from '@/server/services/enquiry.service';
import classes from '../account.module.css';

export const instant = false;

export const metadata: Metadata = {
  title: 'My enquiries',
  description: 'Every enquiry you have sent, filtered by its current stage.',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 10;

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * `searchParams` is a plain record, while the shared filter helpers operate on a
 * single-valued param record. Collapsing repeated keys here means the page can
 * reuse `setSingleValue`, `setPage` and `buildQuery` instead of re-deriving the
 * query string.
 */
function toQueryParams(raw: RawSearchParams): QueryParams {
  const params: QueryParams = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params[key] = value;
    else if (Array.isArray(value) && value.length > 0) params[key] = value.join(',');
  }
  return params;
}

export default async function AccountEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous') redirect('/sign-in?next=%2Faccount%2Fenquiries');

  const params = toQueryParams(await searchParams);

  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const status = isFilterableStatus(params.status) ? params.status : null;

  const result = await listCustomerEnquiries(actor.user.id, {
    page,
    pageSize: PAGE_SIZE,
    ...(status ? { status } : {}),
  });

  const { pagination } = result;

  /*
   * A hand-edited `?page=` can point past the end. Rather than render a
   * misleading "no enquiries" empty state, send the visitor to the last real
   * page — the filter helpers rebuild the URL with every other parameter intact.
   */
  if (pagination.totalPages > 0 && page > pagination.totalPages) {
    redirect(`/account/enquiries${buildQuery(setPage(params, pagination.totalPages))}`);
  }

  const hasFilters = status !== null;
  const clearHref = `/account/enquiries${buildQuery(clearAllFilters(params))}`;

  /*
   * The count is stated as a window, not as a total: a page of 10 out of 34 has
   * to say so, or the visitor reads the screen as the whole list.
   */
  const firstShown = result.data.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastShown = firstShown === 0 ? 0 : firstShown + result.data.length - 1;

  return (
    <SiteShell>
      <Container>
        <PageHeader
          title="My enquiries"
          description="Every enquiry this account has sent, most recent first. Each one shows its current stage and the businesses it went to."
        />

        <AccountNav active="enquiries" />

        {/* A list of comparable rows, so it runs at the denser register. */}
        <div className="surface--dense">
          <EnquiryStatusFilters params={params} active={status} />

          {result.data.length === 0 ? (
            <Surface padding="lg">
              {hasFilters ? (
                <EmptyState
                  title="No enquiries with that status"
                  description="Nothing on this account is at that stage right now. That is a filter result, not a problem with your account."
                  primaryAction={
                    <Button component={ClientLink} href={clearHref}>
                      Show every enquiry
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="You have not sent an enquiry yet"
                  description="Pick the businesses you are interested in, describe your event once, and follow every reply from here."
                  primaryAction={
                    <Button component={ClientLink} href="/vendors">
                      Browse vendors
                    </Button>
                  }
                  secondaryAction={
                    <Button component={ClientLink} href="/categories" variant="default">
                      Browse categories
                    </Button>
                  }
                />
              )}
            </Surface>
          ) : (
            <>
              <p className={classes.resultsMeta}>
                {`Showing ${firstShown}–${lastShown} of ${pagination.totalItems} ${pluralise(
                  pagination.totalItems,
                  'enquiry',
                  'enquiries',
                )}${hasFilters ? ' at this stage' : ''}`}
              </p>

              <ul className={classes.list}>
                {result.data.map((enquiry) => (
                  <li key={enquiry.referenceCode} className={classes.item}>
                    <div className={classes.itemHeader}>
                      <p className={classes.itemTitle}>
                        <Link
                          className={classes.itemLink}
                          href={`/account/enquiries/${encodeURIComponent(enquiry.referenceCode)}`}
                        >
                          {enquiry.referenceCode}
                        </Link>
                      </p>
                      <EnquiryStatusBadge status={enquiry.status} label={enquiry.statusLabel} />
                    </div>

                    <p className={classes.itemMeta}>
                      Sent {formatDate(enquiry.createdAt) ?? 'on an unknown date'} ·{' '}
                      {enquiry.listings.length}{' '}
                      {enquiry.listings.length === 1 ? 'business' : 'businesses'}:{' '}
                      <span className={classes.itemBusinesses}>
                        {enquiry.listings.map((listing) => listing.name).join(', ')}
                      </span>
                    </p>

                    {enquiry.eventDate ? (
                      <p className={classes.itemMeta}>
                        Event on {formatDate(enquiry.eventDate) ?? 'an unknown date'}
                        {enquiry.eventDateFlexible ? ' (flexible)' : ''}
                        {enquiry.eventTypeName ? ` · ${enquiry.eventTypeName}` : ''}
                      </p>
                    ) : null}

                    <p className={classes.itemDescription}>{enquiry.statusDescription}</p>

                    <div className={classes.actionsSpaced}>
                      <Button
                        component={ClientLink}
                        href={`/account/enquiries/${encodeURIComponent(enquiry.referenceCode)}`}
                        variant="default"
                        size="sm"
                      >
                        View enquiry
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <EnquiryPagination
            params={params}
            page={pagination.page}
            totalPages={pagination.totalPages}
          />
        </div>

        <div className={classes.actionsSpaced}>
          <Button component={ClientLink} href="/vendors" variant="subtle" size="sm">
            Send another enquiry
          </Button>
        </div>
      </Container>
    </SiteShell>
  );
}
