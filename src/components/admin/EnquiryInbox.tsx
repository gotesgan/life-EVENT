'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, Select, Stack, Switch, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { TablePagination } from './TablePagination';
import { notifyError, notifySuccess, runMutation } from './api';
import { confirmAction, ConfirmWarning } from './confirm';
import type { UrlParams } from './use-url-filters';
import type { AdminEnquiryListRow } from '@/server/dto/enquiry.dto';
import {
  ADMIN_STATUS_ORDER,
  ALLOWED_TRANSITIONS,
  type EnquiryStatusValue,
} from '@/server/domain/enquiry-status';
import { ENQUIRY_LABELS, labelFor } from './status';
import {
  EnquiryAssigneeCell,
  EnquiryContactCell,
  EnquiryCreatedCell,
  EnquiryEventCell,
  EnquiryProvidersCell,
  EnquiryReferenceCell,
  EnquiryStatusBadge,
  enquiryBudget,
} from './EnquiryCells';
import classes from './Enquiries.module.css';

export interface EnquiryInboxProps {
  rows: AdminEnquiryListRow[];
  params: UrlParams;
  page: number;
  pageSize: number;
  totalItems: number;
  /** Rendered inside the table body when nothing matched. */
  emptyState: ReactNode;
}

/**
 * Bulk targets that cannot be undone from the panel.
 *
 * `CONVERTED` and `CANCELLED` are final in `ALLOWED_TRANSITIONS`; `LOST` is the
 * state that closes a lead out of the active pipeline and only reopens on a
 * deliberate move back to `QUALIFIED`. Bulk-applying one of these to a page of
 * leads is worth a confirmation that names the status and the count, matching
 * the per-row destructive actions that already use `confirmAction`.
 */
const IRREVERSIBLE_BULK_TARGETS: ReadonlyArray<EnquiryStatusValue> = [
  'CONVERTED',
  'CANCELLED',
  'LOST',
];

/**
 * True when every provider lead in the enquiry can legally move to `target`.
 *
 * The state machine is the authority — this only decides which bulk targets are
 * worth offering. A target that is illegal for *every* selected enquiry is never
 * shown, so the bulk control cannot present an action that is guaranteed to be
 * refused.
 */
function canMoveAllLeads(row: AdminEnquiryListRow, target: EnquiryStatusValue): boolean {
  if (row.listings.length === 0) return false;
  return row.listings.every((lead) => ALLOWED_TRANSITIONS[lead.status].includes(target));
}

/**
 * The lead inbox.
 *
 * Selection is local state — it is not a filter, so it has no place in the URL.
 * Every mutation goes through the admin API and then refreshes the server
 * component, so the table always shows what the database holds.
 *
 * Bulk status changes are applied one request per enquiry because that is the
 * endpoint's unit of work, and the result is counted rather than assumed: the
 * lead state machine legitimately refuses different moves for different
 * enquiries, and reporting "5 updated" when 2 were refused would be a lie.
 */
export function EnquiryInbox({
  rows,
  params,
  page,
  pageSize,
  totalItems,
  emptyState,
}: EnquiryInboxProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [target, setTarget] = useState<string | null>(null);
  const [shareWithCustomer, setShareWithCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<string[]>([]);

  const pageIds = useMemo(() => rows.map((row) => row.id), [rows]);

  // A selection is only meaningful for the rows currently on screen; a row that
  // left the page (filter change, page change) must not be silently updated.
  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);

  const targetStatus = (target ?? null) as EnquiryStatusValue | null;

  const bulkTargets = useMemo(
    () =>
      ADMIN_STATUS_ORDER.filter((status) =>
        selectedRows.some((row) => canMoveAllLeads(row, status)),
      ),
    [selectedRows],
  );

  const applicableCount =
    targetStatus === null
      ? 0
      : selectedRows.filter((row) => canMoveAllLeads(row, targetStatus)).length;

  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    // A bulk target legal for the previous selection may not be legal for the
    // new one, so the chosen target is cleared rather than left showing a value
    // the control no longer offers.
    setTarget(null);
    setFailures([]);
  }

  function toggleAll(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setTarget(null);
    setFailures([]);
  }

  async function applyBulkStatus() {
    if (targetStatus === null || selectedRows.length === 0) return;

    setBusy(true);
    setFailures([]);

    const results = await Promise.all(
      selectedRows.map(async (row) => ({
        reference: row.referenceCode,
        result: await runMutation(`/api/admin/enquiries/${row.id}/status`, {
          method: 'POST',
          body: JSON.stringify({
            status: targetStatus,
            isCustomerVisible: shareWithCustomer,
          }),
        }),
      })),
    );

    setBusy(false);

    const succeeded = results.filter((entry) => entry.result.ok);
    const failed = results.filter((entry) => !entry.result.ok);
    const label = labelFor(ENQUIRY_LABELS, targetStatus);

    if (failed.length === 0) {
      notifySuccess(
        `Moved ${succeeded.length} ${succeeded.length === 1 ? 'enquiry' : 'enquiries'} to ${label}.`,
        'Triage updated',
      );
    } else if (succeeded.length === 0) {
      notifyError(
        new Error(
          `None of the ${results.length} selected enquiries could move to ${label}. ${failed[0].result.message}`,
        ),
        'Nothing changed',
      );
    } else {
      notifyError(
        new Error(
          `${succeeded.length} of ${results.length} enquiries moved to ${label}; ${failed.length} were refused.`,
        ),
        'Partially applied',
      );
    }

    setFailures(failed.map((entry) => `${entry.reference}: ${entry.result.message}`));
    setSelected(new Set());
    setTarget(null);
    router.refresh();
  }

  /**
   * What the administrator loses by applying `target` in bulk. Written per
   * target rather than as one generic sentence, because `LOST` is reopenable
   * while `CONVERTED` and `CANCELLED` are final.
   */
  function irreversibleConsequence(target: EnquiryStatusValue): string {
    switch (target) {
      case 'CONVERTED':
        return 'Converted is final: a converted lead cannot move to another status. Only the status shown on a confirmed booking should be closed this way.';
      case 'CANCELLED':
        return 'Cancelled is final: a cancelled lead cannot move to another status. The customer sees this enquiry as cancelled.';
      case 'LOST':
        return 'Lost closes the lead out of active triage. It can only be reopened by moving it back to Qualified.';
      default:
        return 'This move cannot be undone in one step.';
    }
  }

  function requestBulkStatus() {
    if (targetStatus === null || selectedRows.length === 0) return;

    if (!IRREVERSIBLE_BULK_TARGETS.includes(targetStatus)) {
      void applyBulkStatus();
      return;
    }

    const count = selectedRows.length;
    const label = labelFor(ENQUIRY_LABELS, targetStatus);
    const noun = count === 1 ? 'enquiry' : 'enquiries';

    confirmAction({
      title: `Move ${count} ${noun} to ${label}?`,
      body: (
        <Stack gap="xs">
          <Text size="sm" lh={1.6}>
            {applicableCount} of the {count} selected {noun} {applicableCount === 1 ? 'is' : 'are'}{' '}
            eligible for this move; any others are refused by the lead state machine.
          </Text>
          <ConfirmWarning>{irreversibleConsequence(targetStatus)}</ConfirmWarning>
        </Stack>
      ),
      confirmLabel: `Move to ${label}`,
      onConfirm: () => applyBulkStatus(),
    });
  }

  const columns: ReadonlyArray<DataTableColumn<AdminEnquiryListRow>> = [
    {
      key: 'select',
      header: (
        <Checkbox
          aria-label="Select every enquiry on this page"
          checked={allOnPageSelected}
          onChange={(event) => toggleAll(event.currentTarget.checked)}
        />
      ),
      width: 48,
      render: (row) => (
        <Checkbox
          aria-label={`Select enquiry ${row.referenceCode}`}
          checked={selected.has(row.id)}
          onChange={(event) => toggleRow(row.id, event.currentTarget.checked)}
        />
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      width: 150,
      render: (row) => <EnquiryReferenceCell row={row} />,
    },
    {
      key: 'contact',
      header: 'Contact',
      width: 210,
      render: (row) => <EnquiryContactCell row={row} />,
    },
    {
      key: 'status',
      header: 'Enquiry status',
      width: 150,
      render: (row) => <EnquiryStatusBadge status={row.status} />,
    },
    {
      key: 'event',
      header: 'Event',
      width: 170,
      render: (row) => <EnquiryEventCell row={row} />,
    },
    {
      key: 'guests',
      header: 'Guests',
      width: 90,
      align: 'end',
      render: (row) => (
        <Text size="sm" c={row.guestCount === null ? 'dimmed' : undefined}>
          {row.guestCount === null ? '—' : row.guestCount}
        </Text>
      ),
    },
    {
      key: 'budget',
      header: 'Budget',
      width: 170,
      render: (row) => (
        <Text size="sm" c={row.budgetMin === null && row.budgetMax === null ? 'dimmed' : undefined}>
          {enquiryBudget(row)}
        </Text>
      ),
    },
    {
      key: 'providers',
      header: 'Provider leads',
      width: 280,
      render: (row) => <EnquiryProvidersCell row={row} />,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      width: 160,
      render: (row) => <EnquiryAssigneeCell row={row} />,
    },
    {
      key: 'created',
      header: 'Created',
      width: 160,
      render: (row) => <EnquiryCreatedCell row={row} />,
    },
  ];

  return (
    <div>
      <DataTable
        caption="Customer enquiries"
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        minWidth={1680}
        emptyState={emptyState}
      />

      {selectedRows.length > 0 ? (
        <div className={classes.bulkBar} role="group" aria-label="Bulk triage">
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {selectedRows.length} selected
            </Text>
            {targetStatus !== null ? (
              <Text size="xs" c="dimmed">
                {applicableCount} of {selectedRows.length} can move to{' '}
                {labelFor(ENQUIRY_LABELS, targetStatus)}.
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                Choose a status to apply to every selected enquiry.
              </Text>
            )}
          </Stack>

          <div className={classes.bulkControls}>
            <Select
              className={classes.bulkSelect}
              label="Bulk status"
              placeholder={bulkTargets.length === 0 ? 'No shared transition' : 'Choose a status'}
              data={bulkTargets.map((status) => ({
                value: status,
                label: labelFor(ENQUIRY_LABELS, status),
              }))}
              value={target}
              onChange={setTarget}
              disabled={bulkTargets.length === 0}
              size="xs"
            />

            <Switch
              label="Show update to customer"
              checked={shareWithCustomer}
              onChange={(event) => setShareWithCustomer(event.currentTarget.checked)}
              size="xs"
            />

            <Button
              size="xs"
              loading={busy}
              disabled={targetStatus === null}
              onClick={requestBulkStatus}
            >
              Update {selectedRows.length} selected
            </Button>

            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                setSelected(new Set());
                setTarget(null);
                setFailures([]);
              }}
            >
              Clear selection
            </Button>
          </div>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <Alert
          mt="md"
          color="red"
          variant="light"
          icon={<IconAlertTriangle size={18} stroke={1.5} />}
          title={`${failures.length} ${failures.length === 1 ? 'enquiry was' : 'enquiries were'} refused`}
        >
          <Stack gap={4}>
            {failures.map((message) => (
              <Text key={message} size="xs">
                {message}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        params={params}
        itemLabel="enquiries"
      />
    </div>
  );
}
