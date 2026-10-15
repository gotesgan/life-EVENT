'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Switch, Text } from '@mantine/core';
import { postJson, notifyError, notifySuccess } from './api';

export interface EnquiryDuplicateToggleProps {
  enquiryId: string;
  isPotentialDuplicate: boolean;
  onDone?: () => void;
}

/**
 * Duplicate-flag toggle.
 *
 * The flag never changes the lead status by itself — flagging is a prompt for a
 * human to compare the enquiry with the one it may repeat, so the switch only
 * records the suspicion and the activity log keeps who flagged it and when.
 */
export function EnquiryDuplicateToggle({
  enquiryId,
  isPotentialDuplicate,
  onDone,
}: EnquiryDuplicateToggleProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(isPotentialDuplicate);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setChecked(next);
    setBusy(true);
    try {
      await postJson(`/api/admin/enquiries/${enquiryId}/duplicate-flag`, {
        isPotentialDuplicate: next,
      });
      notifySuccess(
        next ? 'Flagged as a possible duplicate.' : 'Duplicate flag cleared.',
        'Flag updated',
      );
      if (onDone) onDone();
      else router.refresh();
    } catch (error) {
      // The switch is reverted, not left showing a state the server refused.
      setChecked(!next);
      notifyError(error, 'Flag not updated');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Switch
        label="Flag as a possible duplicate"
        checked={checked}
        disabled={busy}
        onChange={(event) => void toggle(event.currentTarget.checked)}
        size="xs"
      />
      <Text size="xs" c="dimmed" mt={4}>
        Flags this enquiry for a duplicate check. It does not change the lead status.
      </Text>
    </div>
  );
}
