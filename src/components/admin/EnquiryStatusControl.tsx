'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Select, Stack, Switch, Text, Textarea } from '@mantine/core';
import { postJson, notifyError, notifySuccess } from './api';
import { ALLOWED_TRANSITIONS, type EnquiryStatusValue } from '@/server/domain/enquiry-status';
import { ENQUIRY_LABELS, labelFor } from './status';
import classes from './Enquiries.module.css';

export interface EnquiryStatusControlProps {
  enquiryId: string;
  /** The provider lead this control moves. */
  enquiryListingId: string;
  currentStatus: EnquiryStatusValue;
  listingName: string;
  /** Called after a successful change; defaults to a router refresh. */
  onDone?: () => void;
}

/**
 * The per-lead status control.
 *
 * Two rules this component encodes:
 *
 * 1. **Only legal targets are offered.** The options come straight from
 *    `ALLOWED_TRANSITIONS`, so the server's state machine can never reject a
 *    move this control suggested. A closed lead (Converted, Cancelled) has an
 *    empty list and therefore no control at all, rather than a disabled select
 *    full of options that would fail.
 * 2. **Customer visibility is an explicit choice, defaulting on.** A status
 *    change normally tells the customer something happened; unticking the
 *    switch records the change internally only.
 */
export function EnquiryStatusControl({
  enquiryId,
  enquiryListingId,
  currentStatus,
  listingName,
  onDone,
}: EnquiryStatusControlProps) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [isCustomerVisible, setIsCustomerVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (allowed.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        This lead is closed — no further status changes are possible.
      </Text>
    );
  }

  async function submit() {
    if (target === null) return;
    setBusy(true);
    try {
      await postJson(`/api/admin/enquiries/${enquiryId}/status`, {
        status: target,
        enquiryListingId,
        isCustomerVisible,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(target === 'LOST' && lostReason.trim() ? { lostReason: lostReason.trim() } : {}),
      });
      notifySuccess(`Lead moved to ${labelFor(ENQUIRY_LABELS, target)}.`, 'Status updated');
      setTarget(null);
      setNote('');
      setLostReason('');
      if (onDone) onDone();
      else router.refresh();
    } catch (error) {
      notifyError(error, 'Change refused');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm" className={classes.controlGroup}>
      <div className={classes.controlHead}>
        <Text component="span" className={classes.controlTitle}>
          Move this lead
        </Text>
      </div>

      <Select
        label={`Move ${listingName} lead to`}
        placeholder="Choose a status"
        data={allowed.map((status) => ({
          value: status,
          label: labelFor(ENQUIRY_LABELS, status),
        }))}
        value={target}
        onChange={setTarget}
        size="xs"
      />

      {target === 'LOST' ? (
        <Textarea
          label="Lost reason"
          description="Why the lead did not convert. Recorded on the lead."
          value={lostReason}
          onChange={(event) => setLostReason(event.currentTarget.value)}
          minRows={2}
          maxLength={400}
          size="xs"
        />
      ) : null}

      <Textarea
        label="Note (optional)"
        description="Added to the lead's activity history."
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        minRows={2}
        maxLength={1000}
        size="xs"
      />

      <Switch
        label="Show this update to the customer"
        description="Off keeps the status change internal to the back office."
        checked={isCustomerVisible}
        onChange={(event) => setIsCustomerVisible(event.currentTarget.checked)}
        size="xs"
      />

      {/*
        The action is the last thing in the group and stays disabled until a
        target is chosen, so the control never offers a submit that cannot
        succeed.
      */}
      <Group gap="sm" justify="flex-end">
        <Button size="xs" loading={busy} disabled={target === null} onClick={() => void submit()}>
          Update status
        </Button>
      </Group>
    </Stack>
  );
}
