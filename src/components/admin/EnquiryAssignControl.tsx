'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { postJson, notifyError, notifySuccess } from './api';
import { FilterFieldLabel } from './FilterBar';
import classes from './Enquiries.module.css';

export interface EnquiryAssignControlProps {
  enquiryId: string;
  /** Current enquiry-level assignee, if any. */
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  /** Active administrators only; the service refuses anything else. */
  admins: Array<{ value: string; label: string }>;
  /** Which rows the default scope should target. */
  defaultScope?: 'lead' | 'enquiry';
  onDone?: () => void;
}

/**
 * Assignment control for the enquiry.
 *
 * `scope` is not cosmetic: `lead` assigns every provider lead in the enquiry,
 * `enquiry` assigns the shared brief itself (the enquiry-level owner shown in
 * the inbox). Both are offered because the service supports both, and leaving
 * the select empty posts `assignedAdminId: null`, which unassigns.
 */
export function EnquiryAssignControl({
  enquiryId,
  currentAssigneeId,
  currentAssigneeName,
  admins,
  defaultScope = 'enquiry',
  onDone,
}: EnquiryAssignControlProps) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState<string | null>(currentAssigneeId);
  const [scope, setScope] = useState<'lead' | 'enquiry'>(defaultScope);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await postJson(`/api/admin/enquiries/${enquiryId}/assign`, {
        assignedAdminId: assigneeId,
        scope,
      });
      notifySuccess(assigneeId ? 'Assignment saved.' : 'Enquiry unassigned.', 'Assignment updated');
      if (onDone) onDone();
      else router.refresh();
    } catch (error) {
      notifyError(error, 'Assignment refused');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="xs" className={classes.controlGroup}>
      <div className={classes.controlHead}>
        {/*
          The fact stays a sentence — E2E asserts this exact wording — and the
          chip above it carries the same fact non-verbally, so a queue of
          enquiries can be scanned for "Unassigned" without reading each line.
        */}
        <Text size="xs" c="dimmed">
          {currentAssigneeName
            ? `Currently assigned to ${currentAssigneeName}.`
            : 'Currently unassigned.'}
        </Text>
        <span
          className={
            currentAssigneeName
              ? `${classes.assignmentChip} ${classes.assignmentChipSet}`
              : classes.assignmentChip
          }
        >
          <span aria-hidden className={classes.assignmentChipDot} />
          {currentAssigneeName ? 'Assigned' : 'Unassigned'}
        </span>
      </div>

      <Select
        label="Assign to"
        placeholder="Unassigned"
        data={admins}
        value={assigneeId}
        onChange={setAssigneeId}
        searchable
        clearable
        size="xs"
      />

      <div>
        <FilterFieldLabel>Scope</FilterFieldLabel>
        <SegmentedControl
          fullWidth
          size="xs"
          value={scope}
          onChange={(value) => setScope(value === 'lead' ? 'lead' : 'enquiry')}
          data={[
            { label: 'Every provider lead', value: 'lead' },
            { label: 'Whole enquiry', value: 'enquiry' },
          ]}
        />
      </div>

      <Group>
        <Button size="xs" loading={busy} onClick={() => void submit()}>
          Save assignment
        </Button>
      </Group>
    </Stack>
  );
}
