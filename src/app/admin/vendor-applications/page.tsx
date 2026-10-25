import { Suspense } from 'react';
import { connection } from 'next/server';
import { Button, PageHeader, StatusBadge, Surface, TableSkeleton } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { adminListVendorApplications } from '@/server/services/vendor-application.service';
import { listCategories } from '@/server/services/catalog.service';
import { setVendorApplicationStatusAction } from './actions';
import classes from './page.module.css';

export const metadata = { title: 'Vendor applications' };

async function ApplicationsResult() {
  // Request-time and authenticated: nothing here may be evaluated while the
  // route is prerendered.
  await connection();

  const [result, categories] = await Promise.all([
    adminListVendorApplications({}),
    listCategories(),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));
  const rows = result.data;

  if (rows.length === 0) {
    return (
      <Surface tone="muted" padding="lg">
        <p className={classes.empty}>
          No applications yet. New registrations from the public{' '}
          <a className={classes.link} href="/partner-with-us">
            List your business
          </a>{' '}
          form appear here.
        </p>
      </Surface>
    );
  }

  return (
    <ul className={classes.list}>
      {rows.map((application) => (
        <li key={application.id}>
          <Surface tone="raised" padding="md" className={classes.card}>
            <div className={classes.head}>
              <div>
                <h2 className={classes.name}>{application.businessName}</h2>
                <p className={classes.meta}>
                  {categoryNames.get(application.vendorType) ?? application.vendorType} ·{' '}
                  {application.contactPhone} · applied {formatDateTime(application.createdAt)}
                </p>
              </div>
              <StatusBadge
                tone={
                  application.status === 'APPROVED'
                    ? 'success'
                    : application.status === 'REJECTED'
                      ? 'danger'
                      : application.status === 'REVIEWING'
                        ? 'warning'
                        : 'neutral'
                }
                variant="soft"
                size="sm"
              >
                {application.status === 'NEW' ? 'New' : application.status.toLowerCase()}
              </StatusBadge>
            </div>

            <p className={classes.description}>{application.description}</p>

            <div className={classes.actions}>
              {(['REVIEWING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                <form key={status} action={setVendorApplicationStatusAction}>
                  <input type="hidden" name="id" value={application.id} />
                  <input type="hidden" name="status" value={status} />
                  <Button
                    type="submit"
                    size="xs"
                    variant={status === 'APPROVED' ? 'filled' : 'default'}
                    disabled={application.status === status}
                  >
                    {status === 'REVIEWING'
                      ? 'Mark reviewing'
                      : status === 'APPROVED'
                        ? 'Approve'
                        : 'Reject'}
                  </Button>
                </form>
              ))}
            </div>
          </Surface>
        </li>
      ))}
    </ul>
  );
}

export default function AdminVendorApplicationsPage() {
  return (
    <div>
      <PageHeader
        title="Vendor applications"
        description="Businesses that registered through the public form. Approving one means the team will build the listing; rejection needs a reason in the review note."
      />
      <Suspense fallback={<TableSkeleton rows={2} columns={3} />}>
        <ApplicationsResult />
      </Suspense>
    </div>
  );
}
