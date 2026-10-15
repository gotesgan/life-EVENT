import type { Metadata } from 'next';
import Link from '@/components/ui/ClientLink';
import { redirect } from 'next/navigation';
import { Button } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { AccountNav } from '@/components/account/AccountNav';
import { EnquiryStatusBadge } from '@/components/account/EnquiryStatusBadge';
import { contactMethodLabel } from '@/components/account/contact-method';
import { SiteShell } from '@/components/layout/SiteShell';
import { ClientLink, Container, EmptyState, PageHeader, Surface, cx } from '@/components/ui';
import { getCurrentActor } from '@/lib/auth/actor';
import { formatDate, pluralise } from '@/lib/format';
import { getAccountOverview } from '@/server/services/account.service';
import { listCustomerEnquiries } from '@/server/services/enquiry.service';
import classes from './account.module.css';

/**
 * Per-user, request-time page: there is nothing to prerender into a shared
 * shell, so the segment is explicitly allowed to block rather than pretending to
 * be instant.
 */
export const instant = false;

export const metadata: Metadata = {
  title: 'Your account',
  description:
    'Your enquiry counts, the details we hold, and the enquiries you sent most recently.',
  robots: { index: false, follow: false },
};

/**
 * One of the three comparable counts.
 *
 * A list item rather than a bare box, so the three numbers are announced as one
 * group of values rather than three unrelated panels.
 */
function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Surface as="li" padding="md" className={classes.stat}>
      <p className={classes.statLabel}>{label}</p>
      <p className={classes.statValue}>{value}</p>
      <p className={classes.statHint}>{hint}</p>
    </Surface>
  );
}

export default async function AccountOverviewPage() {
  const actor = await getCurrentActor();
  if (actor.kind === 'anonymous') redirect('/sign-in?next=%2Faccount');

  const [overview, recent] = await Promise.all([
    getAccountOverview(actor.user.id),
    listCustomerEnquiries(actor.user.id, { page: 1, pageSize: 3 }),
  ]);

  const firstName = overview.user.name.trim().split(/\s+/)[0] || 'there';
  const memberSince = formatDate(overview.user.memberSince);
  const recentCount = recent.data.length;

  return (
    <SiteShell>
      <Container>
        <PageHeader
          title={`Hello, ${firstName}`}
          description="Everything you have sent us, and every detail we hold about your account, in one place."
        />

        <AccountNav active="overview" />

        <ul className={classes.stats}>
          <Stat
            label="Enquiries sent"
            value={overview.stats.totalEnquiries}
            hint={`${pluralise(overview.stats.totalEnquiries, 'enquiry', 'enquiries')} from this account`}
          />
          <Stat
            label="In progress"
            value={overview.stats.activeEnquiries}
            hint="Still being worked on with one or more businesses"
          />
          <Stat
            label="Closed or booked"
            value={overview.stats.completedEnquiries}
            hint="Finished, cancelled or confirmed bookings"
          />
        </ul>

        <div className={classes.columns}>
          <Surface padding="md" className={classes.panel}>
            <div className={classes.panelHead}>
              <h2 className={classes.panelTitle}>Account details</h2>
              <p className={classes.panelNote}>
                The details we keep, and what each one is used for.
              </p>
            </div>

            <dl className={classes.dl}>
              <dt className={classes.dt}>Name</dt>
              <dd className={classes.dd}>{overview.user.name || 'Not set'}</dd>

              <dt className={classes.dt}>Email</dt>
              <dd className={classes.dd}>
                <span className={classes.ddValue}>{overview.user.email}</span>
                <span className={classes.readOnlyNote}>
                  This address identifies your account and is read-only here. Changing it needs a
                  verification step we do not ship yet — contact us and we will do it for you.
                </span>
              </dd>

              <dt className={classes.dt}>Phone</dt>
              <dd className={classes.dd}>
                <span className={classes.ddValue}>{overview.profile.phone ?? 'Not added yet'}</span>
                <span className={classes.readOnlyNote}>
                  Used only to reach you about enquiries you send.
                </span>
              </dd>

              <dt className={classes.dt}>City</dt>
              <dd className={classes.dd}>{overview.profile.city?.name ?? 'Not set'}</dd>

              <dt className={classes.dt}>Preferred contact</dt>
              <dd className={classes.dd}>
                {contactMethodLabel(overview.profile.preferredContactMethod)}
              </dd>

              <dt className={classes.dt}>Email updates</dt>
              <dd className={classes.dd}>
                {overview.profile.marketingConsent ? 'Subscribed' : 'Not subscribed'}
              </dd>

              <dt className={classes.dt}>Member since</dt>
              <dd className={classes.dd}>{memberSince ?? 'Unknown'}</dd>
            </dl>

            <div className={classes.actions}>
              <Button component={ClientLink} href="/account/profile" variant="default" size="sm">
                Edit your details
              </Button>
            </div>
          </Surface>

          <Surface padding="md" className={classes.panel}>
            <div className={classes.panelHead}>
              <h2 className={classes.panelTitle}>Most recent enquiries</h2>
              {recentCount === 0 ? null : (
                <p className={classes.panelNote}>
                  {`${recentCount} of ${recent.pagination.totalItems} shown, with the stage each one has reached.`}
                </p>
              )}
            </div>

            {recentCount === 0 ? (
              <EmptyState
                size="sm"
                icon={<IconSend size="1.125rem" stroke={1.5} />}
                title="You have not sent an enquiry yet"
                description="Choose the businesses you are interested in and describe your event once. You will be able to follow each reply here."
                primaryAction={
                  <Button component={ClientLink} href="/vendors">
                    Browse vendors
                  </Button>
                }
              />
            ) : (
              <ul className={cx(classes.list, classes.listInset)}>
                {recent.data.map((enquiry) => (
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
                      {formatDate(enquiry.createdAt) ?? 'Unknown date'} ·{' '}
                      <span className={classes.itemBusinesses}>
                        {enquiry.listings.map((listing) => listing.name).join(', ')}
                      </span>
                    </p>
                    <p className={classes.itemDescription}>{enquiry.statusDescription}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className={classes.actions}>
              <Button component={ClientLink} href="/vendors" size="sm">
                Send a new enquiry
              </Button>
              <Button component={ClientLink} href="/account/enquiries" variant="default" size="sm">
                See all enquiries
              </Button>
            </div>
          </Surface>
        </div>
      </Container>
    </SiteShell>
  );
}
