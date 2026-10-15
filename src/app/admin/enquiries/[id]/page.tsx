import { Suspense } from 'react';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import Link from '@/components/ui/ClientLink';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import {
  Button,
  PageHeader,
  SectionHeading,
  StatusBadge,
  Surface,
  TableSkeleton,
} from '@/components/ui';
import { isAppError } from '@/lib/errors';
import { formatDate, formatDateTime, formatPriceRange } from '@/lib/format';
import { adminGetEnquiry } from '@/server/services/admin-enquiry.service';
import type { AdminEnquiryDetail } from '@/server/dto/enquiry.dto';
import { describeError } from '../../_lib/errors';
import { RetryState } from '@/components/admin/RetryState';
import { EnquiryStatusBadge } from '@/components/admin/EnquiryCells';
import { EnquiryStatusControl } from '@/components/admin/EnquiryStatusControl';
import { EnquiryAssignControl } from '@/components/admin/EnquiryAssignControl';
import { EnquiryNotesPanel } from '@/components/admin/EnquiryNotesPanel';
import { EnquiryDuplicateToggle } from '@/components/admin/EnquiryDuplicateToggle';
import { EnquiryActivityList } from '@/components/admin/EnquiryActivityList';
import { CONTACT_METHOD_LABELS, labelFor } from '@/components/admin/status';
import { assigneeSelectOptions } from '../_lib/options';
import classes from '@/components/admin/Enquiries.module.css';

export const metadata = { title: 'Enquiry' };

export default async function AdminEnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="surface--dense">
      <Suspense
        fallback={
          <Stack gap="lg">
            <TableSkeleton rows={3} columns={2} />
            <TableSkeleton rows={6} columns={2} />
          </Stack>
        }
      >
        <EnquiryDetail id={id} />
      </Suspense>
    </div>
  );
}

async function EnquiryDetail({ id }: { id: string }) {
  // Request-time by definition: the panel is authenticated and the record is
  // identified by a route parameter. Calling `connection()` also keeps the
  // relative-date formatting below off the prerender path.
  await connection();

  let enquiry: AdminEnquiryDetail;
  let admins: Awaited<ReturnType<typeof assigneeSelectOptions>>;
  try {
    [enquiry, admins] = await Promise.all([adminGetEnquiry(id), assigneeSelectOptions()]);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    return <RetryState title="Could not load this enquiry" detail={describeError(error)} />;
  }

  const leads = enquiry.listings.map((lead) => ({
    value: lead.enquiryListingId,
    label: lead.name,
  }));

  const budget = formatPriceRange({
    priceMin: enquiry.budgetMin,
    priceMax: enquiry.budgetMax,
    priceUnit: null,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Customer enquiry"
        title={enquiry.referenceCode}
        description={`${enquiry.contactName} · received ${formatDateTime(enquiry.createdAt) ?? '—'}`}
        breadcrumbs={[
          { label: 'Enquiries', href: '/admin/enquiries' },
          { label: enquiry.referenceCode },
        ]}
        actions={
          <Group gap="sm">
            <EnquiryStatusBadge status={enquiry.status} />
            {enquiry.isPotentialDuplicate ? (
              <StatusBadge tone="warning" size="sm">
                Possible duplicate
              </StatusBadge>
            ) : null}
          </Group>
        }
      />

      <div className={classes.leadGrid}>
        <Surface padding="md" tone="raised" as="section">
          <SectionHeading
            title="Customer brief"
            level={2}
            description="What the customer sent, including the consent record that authorises contact."
          />

          <Stack gap="lg" mt="md">
            <div>
              <SectionHeading title="Contact" level={3} />
              <dl className={classes.definitionList}>
                <dt className={classes.definitionTerm}>Name</dt>
                <dd className={classes.definitionValue}>{enquiry.contactName}</dd>

                <dt className={classes.definitionTerm}>Email</dt>
                <dd className={classes.definitionValue}>
                  <Text component="a" href={`mailto:${enquiry.contactEmail}`} size="sm">
                    {enquiry.contactEmail}
                  </Text>
                </dd>

                <dt className={classes.definitionTerm}>Phone</dt>
                <dd className={classes.definitionValue}>
                  <Text component="a" href={`tel:${enquiry.contactPhone}`} size="sm">
                    {enquiry.contactPhone}
                  </Text>
                </dd>

                <dt className={classes.definitionTerm}>Preferred method</dt>
                <dd className={classes.definitionValue}>
                  {labelFor(CONTACT_METHOD_LABELS, enquiry.contactMethod)}
                </dd>

                <dt className={classes.definitionTerm}>City</dt>
                <dd className={classes.definitionValue}>{enquiry.contactCityName ?? '—'}</dd>
              </dl>
            </div>

            <div>
              <SectionHeading title="Event" level={3} />
              <dl className={classes.definitionList}>
                <dt className={classes.definitionTerm}>Event type</dt>
                <dd className={classes.definitionValue}>{enquiry.eventTypeName ?? '—'}</dd>

                <dt className={classes.definitionTerm}>Event date</dt>
                <dd className={classes.definitionValue}>
                  {formatDate(enquiry.eventDate) ?? 'Not yet decided'}
                </dd>

                <dt className={classes.definitionTerm}>Guests</dt>
                <dd className={classes.definitionValue}>
                  {enquiry.guestCount === null ? '—' : String(enquiry.guestCount)}
                </dd>

                <dt className={classes.definitionTerm}>Budget</dt>
                <dd className={classes.definitionValue}>{budget ?? 'Not specified'}</dd>

                <dt className={classes.definitionTerm}>Referral source</dt>
                <dd className={classes.definitionValue}>{enquiry.referralSource ?? '—'}</dd>
              </dl>
            </div>

            <div>
              <SectionHeading title="Requirements" level={3} />
              <Text size="sm" className={classes.noteBody}>
                {enquiry.requirements ?? 'The customer did not add any notes.'}
              </Text>
            </div>

            <div>
              <SectionHeading
                title="Consent and provenance"
                level={3}
                description="The record that lets this platform contact the customer."
              />
              <dl className={classes.definitionList}>
                <dt className={classes.definitionTerm}>Privacy accepted</dt>
                <dd className={classes.definitionValue}>
                  {enquiry.consentPrivacy ? 'Yes' : 'No — contact is not authorised'}
                </dd>

                <dt className={classes.definitionTerm}>Policy version</dt>
                <dd className={classes.definitionValue}>{enquiry.consentPolicyVersion ?? '—'}</dd>

                <dt className={classes.definitionTerm}>Accepted at</dt>
                <dd className={classes.definitionValue}>
                  {formatDateTime(enquiry.consentedAt) ?? '—'}
                </dd>

                <dt className={classes.definitionTerm}>Submitter fingerprint</dt>
                <dd className={`${classes.definitionValue} ${classes.fingerprint}`}>
                  {enquiry.submittedIpHash ?? 'Not recorded'}
                </dd>
              </dl>
            </div>
          </Stack>
        </Surface>

        <Stack gap="md">
          <Surface padding="md" tone="raised" as="section">
            <SectionHeading
              title="Provider leads"
              level={2}
              description="Each business this brief was sent to has its own status, assignee and history."
            />

            <Stack gap="md" mt="md">
              {enquiry.listings.length === 0 ? (
                <Text size="sm" c="dimmed">
                  This enquiry has no provider leads.
                </Text>
              ) : (
                enquiry.listings.map((lead) => {
                  const leadActivity = enquiry.activities.filter(
                    (activity) =>
                      activity.listingName === lead.name && activity.type === 'STATUS_CHANGED',
                  );

                  return (
                    <Surface key={lead.enquiryListingId} padding="md" tone="muted" as="article">
                      <div className={classes.panelHead}>
                        <Stack gap={2}>
                          <Text fw={600} size="sm">
                            {lead.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            /vendors/{lead.slug}
                          </Text>
                        </Stack>
                        <Group gap="xs" wrap="wrap">
                          <EnquiryStatusBadge status={lead.status} />
                          <Button
                            component={Link}
                            href={`/vendors/${lead.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            variant="default"
                            size="compact-xs"
                          >
                            View on site
                          </Button>
                          <Button
                            component={Link}
                            href={`/admin/listings/${lead.listingId}`}
                            variant="default"
                            size="compact-xs"
                          >
                            Edit listing
                          </Button>
                        </Group>
                      </div>

                      <Stack gap="xs">
                        <Text size="xs" c="dimmed">
                          Assignee: {lead.assignedAdminName ?? 'Unassigned'}
                        </Text>

                        {/*
                          The SLA columns (firstContactedAt, sharedWithProviderAt,
                          convertedAt, lostAt) and the lost reason / provider
                          response note are not part of `AdminEnquiryDetail`, so
                          this card shows the timestamp the activity log actually
                          records instead of inventing the missing fields.
                        */}
                        {leadActivity[0] ? (
                          <Text size="xs" c="dimmed">
                            Latest recorded status change: {leadActivity[0].fromStatus ?? '—'} →{' '}
                            {leadActivity[0].toStatus ?? '—'} at{' '}
                            {formatDateTime(leadActivity[0].at) ?? '—'}
                          </Text>
                        ) : null}

                        <EnquiryStatusControl
                          enquiryId={enquiry.id}
                          enquiryListingId={lead.enquiryListingId}
                          currentStatus={lead.status}
                          listingName={lead.name}
                        />
                      </Stack>
                    </Surface>
                  );
                })
              )}
            </Stack>
          </Surface>

          <Surface padding="md" tone="raised" as="section">
            <SectionHeading
              title="Ownership"
              level={2}
              description="Who is responsible for this enquiry."
            />
            <Stack gap="md" mt="md">
              <EnquiryAssignControl
                enquiryId={enquiry.id}
                currentAssigneeId={enquiry.assignment?.assignedAdminId ?? null}
                currentAssigneeName={enquiry.assignment?.assignedAdminName ?? null}
                admins={admins}
              />
              <EnquiryDuplicateToggle
                enquiryId={enquiry.id}
                isPotentialDuplicate={enquiry.isPotentialDuplicate}
              />
            </Stack>
          </Surface>
        </Stack>
      </div>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" mt="xl">
        <Surface padding="md" tone="raised" as="section">
          <SectionHeading
            title="Internal notes"
            level={2}
            description="Private follow-up notes for the team."
          />
          <div style={{ marginTop: 'var(--mantine-spacing-md)' }}>
            <EnquiryNotesPanel enquiryId={enquiry.id} notes={enquiry.notes} leads={leads} />
          </div>
        </Surface>

        <Surface padding="md" tone="raised" as="section">
          <SectionHeading
            title="Activity history"
            level={2}
            description="Everything that has happened to this enquiry, including what the customer can see."
          />
          <div style={{ marginTop: 'var(--mantine-spacing-md)' }}>
            <EnquiryActivityList activities={enquiry.activities} />
          </div>
        </Surface>
      </SimpleGrid>
    </div>
  );
}
