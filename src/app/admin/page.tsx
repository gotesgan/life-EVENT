import { Suspense } from 'react';
import { connection } from 'next/server';
import Link from '@/components/ui/ClientLink';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconInbox, IconPlus } from '@tabler/icons-react';
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  SectionHeading,
  StatusBadge,
  Surface,
  TableSkeleton,
} from '@/components/ui';
import { adminGetEnquiryMetrics } from '@/server/services/admin-enquiry.service';
import { adminListListings } from '@/server/services/listing.service';
import { ADMIN_STATUS_ORDER } from '@/server/domain/enquiry-status';
import { describeError } from './_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { StatTile } from '@/components/admin/StatTile';
import { AdminTableRegion } from '@/components/admin/AdminTable';
import { RECENT_LISTING_COLUMNS } from '@/components/admin/ListingCells';
import {
  ENQUIRY_LABELS,
  ENQUIRY_TONES,
  ENQUIRY_VARIANTS,
  labelFor,
} from '@/components/admin/status';
import classes from '@/components/admin/Overview.module.css';

export const metadata = { title: 'Overview' };

export default function AdminOverviewPage() {
  return (
    <div className="surface--dense">
      <PageHeader
        title="Overview"
        description="Where the operation stands right now — enquiry volume, triage backlog and the listings that were touched most recently."
        actions={
          <Group gap="sm">
            <Button
              component={Link}
              href="/admin/enquiries"
              variant="default"
              leftSection={<IconInbox size={16} stroke={1.5} />}
            >
              Open inbox
            </Button>
            <Button
              component={Link}
              href="/admin/listings/new"
              leftSection={<IconPlus size={16} stroke={1.5} />}
            >
              New listing
            </Button>
          </Group>
        }
      />

      <Suspense
        fallback={
          <Stack gap="lg">
            <TableSkeleton rows={2} columns={5} />
            <TableSkeleton rows={5} columns={6} />
          </Stack>
        }
      >
        <OverviewContent />
      </Suspense>
    </div>
  );
}

async function OverviewContent() {
  // Request-time by definition: this data is per-request (metrics are relative
  // to "now", and the panel is authenticated). `connection()` also prevents the
  // `Date.now()` inside the metrics service from being evaluated during
  // prerendering, which `cacheComponents` rejects as an unstable value.
  await connection();

  const [metricsResult, listingsResult] = await Promise.allSettled([
    adminGetEnquiryMetrics(),
    adminListListings({ page: 1, pageSize: 5 }),
  ]);

  if (metricsResult.status === 'rejected') {
    return (
      <RetryState
        title="Could not load the operational metrics"
        detail={describeError(metricsResult.reason)}
      />
    );
  }

  const metrics = metricsResult.value;
  const listings = listingsResult.status === 'fulfilled' ? listingsResult.value : null;
  const countByStatus = new Map(metrics.byStatus.map((row) => [row.status, row.count]));

  return (
    <div>
      {/*
        Metrics row.

        Every label names exactly what is counted, because on this screen the
        difference between "enquiries" and "provider leads" is the difference
        between two different queues. Each tile carries a source note; a reader
        who does not know where a number comes from cannot act on it.
      */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 5 }} spacing="sm">
        <StatTile
          label="Total enquiries"
          value={metrics.total}
          hint="Every enquiry ever received, in all statuses."
        />
        <StatTile
          label="New enquiries in the last 7 days"
          value={metrics.newLast7Days}
          tone="brand"
          hint="Arrived in the trailing seven days, including any already triaged."
        />
        <StatTile
          label="Unassigned provider leads"
          value={metrics.unassigned}
          tone={metrics.unassigned > 0 ? 'warning' : 'default'}
          hint="Open leads with no administrator assigned — the backlog to clear."
        />
        <StatTile
          label="Enquiries flagged as duplicates"
          value={metrics.flaggedDuplicates}
          tone={metrics.flaggedDuplicates > 0 ? 'warning' : 'default'}
          hint="Flagged for review. A flag is a suspicion, not a deletion."
        />
        <StatTile
          label="Enquiries converted"
          value={metrics.conversionRate}
          unit="%"
          tone="success"
          hint="Converted divided by all enquiries. A rate, so it moves when either number moves."
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm" mt="xl">
        <Surface padding="md" tone="raised" className={classes.breakdownPanel}>
          <SectionHeading
            title="Enquiries by status"
            level={2}
            description="The enquiry's overall status, recomputed from its provider leads."
          />
          <div className={classes.panelBody}>
            <ul className={classes.breakdown}>
              {ADMIN_STATUS_ORDER.map((status) => {
                const count = countByStatus.get(status) ?? 0;
                return (
                  <li key={status} className={classes.breakdownRow}>
                    <StatusBadge
                      tone={ENQUIRY_TONES[status] ?? 'neutral'}
                      variant={ENQUIRY_VARIANTS[status] ?? 'soft'}
                      size="sm"
                      dot
                    >
                      {labelFor(ENQUIRY_LABELS, status)}
                    </StatusBadge>
                    <Text component="span" className={classes.breakdownCount}>
                      {count}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </div>
        </Surface>

        <Surface padding="md" tone="raised" className={classes.breakdownPanel}>
          <SectionHeading
            title="Top categories by enquiry"
            level={2}
            description="Where demand is actually landing, across the five busiest categories."
          />
          <div className={classes.panelBody}>
            {metrics.topCategories.length === 0 ? (
              <EmptyState
                size="sm"
                title="No enquiries yet"
                description="Once customers send enquiries, the categories receiving them appear here."
              />
            ) : (
              <ul className={classes.breakdown}>
                {metrics.topCategories.map((category) => (
                  <li key={category.slug} className={classes.breakdownRow}>
                    <Link
                      className={classes.breakdownLink}
                      href={`/admin/listings?q=${encodeURIComponent(category.name)}`}
                      title={category.name}
                    >
                      {category.name}
                    </Link>
                    <Text component="span" className={classes.breakdownCount}>
                      {category.count}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Surface>
      </SimpleGrid>

      <section className={classes.section}>
        <div className={classes.sectionHead}>
          <SectionHeading
            title="Recently updated listings"
            level={2}
            description="Ordered by the last edit, not by when the listing was created."
          />
          <Button component={Link} href="/admin/listings" size="compact-sm" variant="subtle">
            All listings
          </Button>
        </div>

        {listings === null ? (
          <RetryState
            title="Could not load recent listings"
            detail={describeError(
              listingsResult.status === 'rejected' ? listingsResult.reason : null,
            )}
          />
        ) : listings.rows.length === 0 ? (
          <EmptyState
            icon={<IconPlus size={20} stroke={1.5} />}
            title="No listings yet"
            description="Create the first listing — it is saved as a draft until you publish it."
            primaryAction={
              <Button
                component={Link}
                href="/admin/listings/new"
                leftSection={<IconPlus size={16} />}
              >
                New listing
              </Button>
            }
          />
        ) : (
          <AdminTableRegion>
            <DataTable
              caption="Five most recently updated listings"
              columns={RECENT_LISTING_COLUMNS}
              rows={listings.rows}
              getRowKey={(row) => row.id}
              minWidth={980}
            />
          </AdminTableRegion>
        )}
      </section>
    </div>
  );
}
