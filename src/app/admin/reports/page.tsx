import { Suspense } from 'react';
import Link from '@/components/ui/ClientLink';
import { connection } from 'next/server';
import { prisma } from '@/lib/db';
import { Button, PageHeader, Surface, TableSkeleton } from '@/components/ui';
import classes from './page.module.css';

export const metadata = { title: 'Reports' };

const ENQUIRY_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SHARED_WITH_PROVIDER',
  'CONVERTED',
  'LOST',
  'CANCELLED',
  'DUPLICATE',
  'SPAM',
] as const;

/** Module scope keeps `Date.now()` out of the component's render path. */
function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

async function ReportsContent() {
  await connection();

  const since = thirtyDaysAgo();

  const [
    enquiryByStatus,
    applicationByStatus,
    enquiriesLast30,
    emailFailures,
    metaFailures,
    topListings,
    recentApplications,
  ] = await Promise.all([
    prisma.enquiry.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.vendorApplication.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.enquiry.count({ where: { createdAt: { gte: since } } }),
    prisma.emailLog.count({ where: { status: 'FAILED' } }),
    prisma.metaEventLog.count({ where: { status: 'FAILED' } }),
    prisma.enquiryListing.groupBy({
      by: ['listingId'],
      _count: { _all: true },
      orderBy: { _count: { listingId: 'desc' } },
      take: 8,
    }),
    prisma.vendorApplication.count({ where: { createdAt: { gte: since } } }),
  ]);

  const listingRows = topListings.length
    ? await prisma.businessListing.findMany({
        where: { id: { in: topListings.map((row) => row.listingId) } },
        select: {
          id: true,
          name: true,
          primaryCategory: { select: { name: true } },
          primaryLocation: { select: { name: true } },
        },
      })
    : [];
  const listingById = new Map(listingRows.map((row) => [row.id, row]));

  const statusCounts = new Map(enquiryByStatus.map((row) => [row.status, row._count._all]));
  const applicationCounts = new Map(
    applicationByStatus.map((row) => [row.status, row._count._all]),
  );

  return (
    <div className={classes.sections}>
      <div className={classes.exportRow}>
        <Button
          component={Link}
          href="/api/admin/reports/export?report=enquiries"
          size="sm"
          variant="default"
        >
          Download enquiries CSV
        </Button>
        <Button
          component={Link}
          href="/api/admin/reports/export?report=applications"
          size="sm"
          variant="default"
        >
          Download applications CSV
        </Button>
      </div>

      <div className={classes.cards}>
        <Surface tone="raised" padding="md" className={classes.card}>
          <p className={classes.cardLabel}>Enquiries, last 30 days</p>
          <p className={classes.cardValue}>{enquiriesLast30}</p>
        </Surface>
        <Surface tone="raised" padding="md" className={classes.card}>
          <p className={classes.cardLabel}>Vendor applications, last 30 days</p>
          <p className={classes.cardValue}>{recentApplications}</p>
        </Surface>
        <Surface tone="raised" padding="md" className={classes.card}>
          <p className={classes.cardLabel}>Failed emails</p>
          <p className={classes.cardValue}>{emailFailures}</p>
        </Surface>
        <Surface tone="raised" padding="md" className={classes.card}>
          <p className={classes.cardLabel}>Failed Meta events</p>
          <p className={classes.cardValue}>{metaFailures}</p>
        </Surface>
      </div>

      <div className={classes.columns}>
        <Surface tone="raised" padding="md" className={classes.card}>
          <h2 className={classes.cardTitle}>Enquiries by status</h2>
          <ul className={classes.statusList}>
            {ENQUIRY_STATUSES.map((status) => (
              <li key={status} className={classes.statusRow}>
                <span className={classes.statusLabel}>
                  {status.toLowerCase().replace(/_/g, ' ')}
                </span>
                <span className={classes.statusCount}>{statusCounts.get(status) ?? 0}</span>
              </li>
            ))}
          </ul>
        </Surface>

        <Surface tone="raised" padding="md" className={classes.card}>
          <h2 className={classes.cardTitle}>Applications by status</h2>
          <ul className={classes.statusList}>
            {(['NEW', 'REVIEWING', 'APPROVED', 'REJECTED'] as const).map((status) => (
              <li key={status} className={classes.statusRow}>
                <span className={classes.statusLabel}>{status.toLowerCase()}</span>
                <span className={classes.statusCount}>{applicationCounts.get(status) ?? 0}</span>
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      <Surface tone="raised" padding="md" className={classes.card}>
        <h2 className={classes.cardTitle}>Most-enquired listings</h2>
        {topListings.length === 0 ? (
          <p className={classes.empty}>No enquiries yet.</p>
        ) : (
          <ul className={classes.statusList}>
            {topListings.map((row) => {
              const listing = listingById.get(row.listingId);
              return (
                <li key={row.listingId} className={classes.statusRow}>
                  <span className={classes.statusLabel}>
                    {listing?.name ?? row.listingId}
                    {listing
                      ? ` · ${listing.primaryCategory.name}, ${listing.primaryLocation.name}`
                      : ''}
                  </span>
                  <span className={classes.statusCount}>{row._count._all}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Surface>
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="The numbers an operator needs without writing SQL: demand, supply pipeline and integration health. CSV downloads cover the raw rows."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={2} />}>
        <ReportsContent />
      </Suspense>
    </div>
  );
}
