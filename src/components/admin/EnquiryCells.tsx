import Link from '@/components/ui/ClientLink';
import { Group, Text } from '@mantine/core';
import { StatusBadge } from '@/components/ui';
import { formatDate, formatDateTime, formatPriceRange } from '@/lib/format';
import type { AdminEnquiryListRow } from '@/server/dto/enquiry.dto';
import { ENQUIRY_LABELS, ENQUIRY_TONES, ENQUIRY_VARIANTS, labelFor } from './status';
import { RowStack } from './AdminTable';
import classes from './Enquiries.module.css';

/**
 * Shared presentation for the enquiry screens.
 *
 * The inbox row and the detail header must never disagree about what a lead
 * status or a reference code looks like, so both render through this module.
 *
 * `contactEmailMasked`/`contactPhoneMasked` are what the list DTO publishes and
 * they are what the inbox renders — the unmasked pair is only ever available on
 * the detail page, which is the deliberate privacy boundary the service draws.
 */

/**
 * Lead status pill.
 *
 * Three channels carry the state, never colour alone (§6.5.4): the text label,
 * the leading dot, and the tone. The tone and variant come from `status.ts`, so
 * `New` is the amber call-to-attention and `Converted` the only filled green —
 * neither is the action colour, which stays on the buttons beside it.
 */
export function EnquiryStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      tone={ENQUIRY_TONES[status] ?? 'neutral'}
      variant={ENQUIRY_VARIANTS[status] ?? 'soft'}
      size="sm"
      dot
    >
      {labelFor(ENQUIRY_LABELS, status)}
    </StatusBadge>
  );
}

export interface EnquiryReferenceCellProps {
  row: AdminEnquiryListRow;
}

export function EnquiryReferenceCell({ row }: EnquiryReferenceCellProps) {
  return (
    <RowStack>
      <Text
        component={Link}
        href={`/admin/enquiries/${row.id}`}
        size="sm"
        fw={600}
        c="var(--app-text)"
        title={`Open ${row.referenceCode}`}
        className={`${classes.referenceLink} ${classes.truncate}`}
      >
        {row.referenceCode}
      </Text>
      {row.isPotentialDuplicate ? (
        <StatusBadge tone="warning" size="sm" dot>
          Possible duplicate
        </StatusBadge>
      ) : null}
    </RowStack>
  );
}

/**
 * Contact column. The masked email and phone are rendered exactly as the DTO
 * supplies them — this component never unmasks, because it has nothing to
 * unmask with.
 *
 * All three lines truncate with a `title`, because a long Indian name or a long
 * masked address would otherwise wrap the row to three lines and break the
 * scanability of every column beside it.
 */
export function EnquiryContactCell({ row }: EnquiryReferenceCellProps) {
  return (
    <RowStack>
      <Text size="sm" fw={550} title={row.contactName} className={classes.truncate}>
        {row.contactName}
      </Text>
      <Text
        component="span"
        size="xs"
        c="dimmed"
        title={row.contactEmailMasked}
        className={`${classes.masked} ${classes.truncate}`}
      >
        {row.contactEmailMasked}
      </Text>
      <Text
        component="span"
        size="xs"
        c="dimmed"
        title={row.contactPhoneMasked}
        className={`${classes.masked} ${classes.truncate}`}
      >
        {row.contactPhoneMasked}
      </Text>
    </RowStack>
  );
}

export function EnquiryEventCell({ row }: EnquiryReferenceCellProps) {
  const eventDate = formatDate(row.eventDate);

  return (
    <RowStack>
      <Text
        size="sm"
        c={row.eventTypeName ? undefined : 'dimmed'}
        title={row.eventTypeName ?? 'No event type recorded'}
        className={classes.truncate}
      >
        {row.eventTypeName ?? '—'}
      </Text>
      <Text
        component="span"
        size="xs"
        c="dimmed"
        title={eventDate ?? 'No date yet'}
        className={classes.truncate}
      >
        {eventDate ?? 'No date yet'}
      </Text>
    </RowStack>
  );
}

export function enquiryBudget(row: AdminEnquiryListRow): string {
  return (
    formatPriceRange({
      priceMin: row.budgetMin,
      priceMax: row.budgetMax,
      priceUnit: null,
    }) ?? '—'
  );
}

/** One chip per provider lead, so a multi-business enquiry is readable at a glance. */
export function EnquiryProvidersCell({ row }: EnquiryReferenceCellProps) {
  if (row.listings.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No provider leads
      </Text>
    );
  }

  return (
    <RowStack>
      {row.listings.map((lead) => (
        <Group key={lead.enquiryListingId} gap={6} wrap="nowrap" align="center">
          <Text size="xs" className={`${classes.leadName} ${classes.truncate}`} title={lead.name}>
            {lead.name}
          </Text>
          <StatusBadge
            tone={ENQUIRY_TONES[lead.status] ?? 'neutral'}
            variant={ENQUIRY_VARIANTS[lead.status] ?? 'soft'}
            size="sm"
            dot
          >
            {labelFor(ENQUIRY_LABELS, lead.status)}
          </StatusBadge>
        </Group>
      ))}
    </RowStack>
  );
}

export function EnquiryAssigneeCell({ row }: EnquiryReferenceCellProps) {
  const assignee = row.assignment?.assignedAdminName ?? 'Unassigned';

  return (
    <Text
      size="sm"
      c={row.assignment ? undefined : 'dimmed'}
      title={assignee}
      className={classes.truncate}
    >
      {assignee}
    </Text>
  );
}

export function EnquiryCreatedCell({ row }: EnquiryReferenceCellProps) {
  const formatted = formatDateTime(row.createdAt);

  return (
    <Text component="span" size="sm" className={classes.timestamp} title={formatted ?? undefined}>
      {formatted ?? '—'}
    </Text>
  );
}
