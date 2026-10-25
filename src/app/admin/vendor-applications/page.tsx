import { Suspense } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { connection } from 'next/server';
import { Button, PageHeader, StatusBadge, Surface, TableSkeleton } from '@/components/ui';
import { CopyButton } from '@/components/admin/CopyButton';
import { formatDateTime } from '@/lib/format';
import { adminListVendorApplications } from '@/server/services/vendor-application.service';
import { listCategories, listLocations } from '@/server/services/catalog.service';
import { adminListVendorInvites } from '@/server/services/vendor-invite.service';
import {
  approveApplicationAction,
  createVendorInviteAction,
  dismissInviteFlashAction,
  revokeVendorInviteAction,
  setVendorApplicationStatusAction,
} from './actions';
import classes from './page.module.css';

export const metadata = { title: 'Vendor applications' };

const STATUS_TONE = {
  NEW: 'neutral',
  REVIEWING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
} as const;

/** The onboarding link the last create action produced, shown once. */
async function InviteFlash() {
  const link = (await cookies()).get('vendor-invite-flash')?.value;
  if (!link) return null;

  return (
    <Surface tone="success" padding="md" className={classes.flash}>
      <div className={classes.flashHead}>
        <div>
          <h2 className={classes.flashTitle}>Onboarding link created</h2>
          <p className={classes.meta}>
            Shown once — copy it now and send it to the business. It is single-use and expires in 14
            days.
          </p>
        </div>
        <form action={dismissInviteFlashAction}>
          <Button type="submit" size="xs" variant="default">
            Dismiss
          </Button>
        </form>
      </div>
      <div className={classes.linkRow}>
        <input className={classes.linkInput} value={link} readOnly aria-label="Invite link" />
        <CopyButton value={link} />
      </div>
    </Surface>
  );
}

async function ApplicationsResult() {
  // Request-time and authenticated: nothing here may be evaluated while the
  // route is prerendered.
  await connection();

  const [result, categories, cities, invites] = await Promise.all([
    adminListVendorApplications({}),
    listCategories(),
    listLocations({ type: 'CITY' }),
    adminListVendorInvites(),
  ]);

  const categoryNames = new Map(categories.map((category) => [category.slug, category.name]));
  const cityNames = new Map(cities.map((city) => [city.slug, city.name]));
  const defaultCity = cities[0]?.slug ?? '';
  const rows = result.data;

  return (
    <div className={classes.sections}>
      <InviteFlash />

      <Surface tone="raised" padding="md" className={classes.card} data-tour="vendor-invite-form">
        <div className={classes.head}>
          <div>
            <h2 className={classes.name}>Send an onboarding link</h2>
            <p className={classes.meta}>
              Creates a private, single-use form where the business fills in its own listing
              details. The team reviews the submission and creates the listing draft.
            </p>
          </div>
        </div>
        <form action={createVendorInviteAction} className={classes.inviteForm}>
          <label className={classes.fieldLabel} htmlFor="invite-email">
            Business email (optional)
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className={classes.textInput}
            placeholder="owner@business.com"
            autoComplete="email"
          />
          <Button type="submit" size="sm">
            Create onboarding link
          </Button>
        </form>
      </Surface>

      {invites.length > 0 ? (
        <Surface tone="raised" padding="md">
          <h2 className={classes.name}>Onboarding links</h2>
          <ul className={classes.inviteList}>
            {invites.map((invite) => (
              <li key={invite.id} className={classes.inviteRow}>
                <div className={classes.inviteInfo}>
                  <span className={classes.inviteName}>
                    {invite.applicationName ?? invite.email ?? 'Unnamed invite'}
                  </span>
                  <span className={classes.meta}>
                    {invite.email ?? 'No email'} · created {formatDateTime(invite.createdAt)} ·
                    expires {formatDateTime(invite.expiresAt)}
                  </span>
                </div>
                <div className={classes.inviteActions}>
                  <StatusBadge
                    tone={
                      invite.status === 'SUBMITTED'
                        ? 'success'
                        : invite.status === 'REVOKED' || invite.status === 'EXPIRED'
                          ? 'danger'
                          : invite.status === 'OPENED'
                            ? 'warning'
                            : 'neutral'
                    }
                    variant="soft"
                    size="sm"
                  >
                    {invite.status.toLowerCase()}
                  </StatusBadge>
                  {invite.status === 'SENT' || invite.status === 'OPENED' ? (
                    <form action={revokeVendorInviteAction}>
                      <input type="hidden" name="id" value={invite.id} />
                      <Button type="submit" size="xs" variant="default">
                        Revoke
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      <h2 className={classes.sectionTitle} data-tour="vendor-applications-list">
        Applications
      </h2>

      {rows.length === 0 ? (
        <Surface tone="muted" padding="lg">
          <p className={classes.empty}>
            No applications yet. New registrations from the public{' '}
            <Link className={classes.link} href="/partner-with-us">
              List your business
            </Link>{' '}
            form appear here, as do submissions from onboarding links.
          </p>
        </Surface>
      ) : (
        <ul className={classes.list}>
          {rows.map((application) => (
            <li key={application.id}>
              <Surface tone="raised" padding="md" className={classes.card}>
                <div className={classes.head}>
                  <div>
                    <h3 className={classes.name}>{application.businessName}</h3>
                    <p className={classes.meta}>
                      {categoryNames.get(application.vendorType) ?? application.vendorType} ·{' '}
                      {application.contactPhone}
                      {application.contactEmail ? ` · ${application.contactEmail}` : ''} ·{' '}
                      {application.source === 'INVITE' ? 'Onboarding form' : 'Public form'} ·{' '}
                      {formatDateTime(application.createdAt)}
                    </p>
                    {application.citySlug ? (
                      <p className={classes.meta}>
                        City: {cityNames.get(application.citySlug) ?? application.citySlug}
                        {application.contactName ? ` · Contact: ${application.contactName}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge tone={STATUS_TONE[application.status]} variant="soft" size="sm">
                    {application.status === 'NEW' ? 'New' : application.status.toLowerCase()}
                  </StatusBadge>
                </div>

                <p className={classes.description}>{application.description}</p>

                {application.websiteUrl ? (
                  <p className={classes.meta}>
                    Website:{' '}
                    <a
                      className={classes.link}
                      href={application.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {application.websiteUrl}
                    </a>
                  </p>
                ) : null}

                <div className={classes.actions}>
                  {(['REVIEWING', 'REJECTED'] as const).map((status) => (
                    <form key={status} action={setVendorApplicationStatusAction}>
                      <input type="hidden" name="id" value={application.id} />
                      <input type="hidden" name="status" value={status} />
                      <Button
                        type="submit"
                        size="xs"
                        variant="default"
                        disabled={application.status === status}
                      >
                        {status === 'REVIEWING' ? 'Mark reviewing' : 'Reject'}
                      </Button>
                    </form>
                  ))}

                  {application.contactEmail && !application.listingId ? (
                    <form action={createVendorInviteAction}>
                      <input type="hidden" name="email" value={application.contactEmail} />
                      <input type="hidden" name="applicationId" value={application.id} />
                      <Button type="submit" size="xs" variant="default">
                        Send onboarding link
                      </Button>
                    </form>
                  ) : null}
                </div>

                {application.listingId ? (
                  <p className={classes.meta}>
                    Draft listing created:{' '}
                    <Link
                      className={classes.link}
                      href={`/admin/listings/${application.listingId}`}
                    >
                      open it in the listing editor
                    </Link>
                    .
                  </p>
                ) : (
                  <form action={approveApplicationAction} className={classes.approveForm}>
                    <label className={classes.fieldLabel} htmlFor={`city-${application.id}`}>
                      City for the draft listing
                    </label>
                    <select
                      id={`city-${application.id}`}
                      name="citySlug"
                      className={classes.select}
                      defaultValue={application.citySlug ?? defaultCity}
                    >
                      {cities.map((city) => (
                        <option key={city.slug} value={city.slug}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" name="id" value={application.id} />
                    <Button type="submit" size="xs">
                      Approve &amp; create draft listing
                    </Button>
                  </form>
                )}
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminVendorApplicationsPage() {
  return (
    <div>
      <PageHeader
        title="Vendor applications"
        description="Register, onboard and approve the supply side. A business can arrive through the public form or through a private onboarding link; approving creates a draft listing for the team to finish."
      />
      <Suspense fallback={<TableSkeleton rows={4} columns={3} />}>
        <ApplicationsResult />
      </Suspense>
    </div>
  );
}
