'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Modal, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { accountFetch, errorMessage, notifySuccess } from './api';

export interface CancelEnquiryButtonProps {
  referenceCode: string;
}

/**
 * Customer-initiated cancellation, behind a confirmation dialog.
 *
 * The dialog states the consequence rather than asking "are you sure?": every
 * business on the enquiry stops being contacted, and the action cannot be undone
 * from the account. `Modal` traps focus, closes on Escape and restores focus to
 * the trigger; all three are disabled while the request is in flight so the
 * dialog cannot be dismissed mid-write.
 */
export function CancelEnquiryButton({ referenceCode }: CancelEnquiryButtonProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setPending(true);
    setError(null);

    try {
      await accountFetch(`/api/enquiries/${encodeURIComponent(referenceCode)}/cancel`, {
        method: 'POST',
        body: '{}',
      });
      setOpened(false);
      notifySuccess(
        'We have stopped this enquiry. You can send a new one at any time.',
        'Cancelled',
      );
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="default" color="red" onClick={() => setOpened(true)}>
        Cancel enquiry
      </Button>

      <Modal
        opened={opened}
        onClose={() => {
          if (!pending) setOpened(false);
        }}
        title="Cancel this enquiry?"
        centered
        radius="lg"
        closeOnClickOutside={!pending}
        closeOnEscape={!pending}
        withCloseButton={!pending}
      >
        <Text size="sm" lh={1.6}>
          Every business on this enquiry stops being contacted, and any request that has not been
          answered is withdrawn. This cannot be undone from your account — you would need to send a
          new enquiry.
        </Text>

        <Group gap="xs" align="flex-start" wrap="nowrap" mt="sm">
          <IconAlertTriangle size={18} stroke={1.5} color="var(--app-warning)" aria-hidden />
          <Text size="sm" c="dimmed" lh={1.55}>
            If a business is already in contact with you, reply to them directly instead —
            cancelling here will not close that conversation.
          </Text>
        </Group>

        {error ? (
          <Text size="sm" c="red" role="alert" mt="sm">
            {error}
          </Text>
        ) : null}

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setOpened(false)} disabled={pending}>
            Keep enquiry
          </Button>
          <Button color="red" onClick={cancel} loading={pending}>
            Cancel enquiry
          </Button>
        </Group>
      </Modal>
    </>
  );
}
