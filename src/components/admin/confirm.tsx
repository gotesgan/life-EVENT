'use client';

import { useState, type ReactNode } from 'react';
import { Button, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconAlertTriangle } from '@tabler/icons-react';
import { errorMessage } from './api';

export interface ConfirmActionOptions {
  title: string;
  /** Name the entity and state the consequence. Never "Are you sure?". */
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Defaults to `true`; a reversible action can opt out of the red confirm. */
  danger?: boolean;
  cancelLabel?: string;
}

/**
 * Confirmation for anything destructive or hard to reverse.
 *
 * `modals.openConfirmModal` provides the focus trap, Escape handling and focus
 * restoration; this wrapper exists to force a consistent, explicit shape: a
 * title that names the entity, a body that explains what changes, and a verb on
 * the confirm button.
 */
export function confirmAction({
  title,
  body,
  confirmLabel,
  onConfirm,
  danger = true,
  cancelLabel = 'Cancel',
}: ConfirmActionOptions): void {
  modals.openConfirmModal({
    title,
    centered: true,
    radius: 'lg',
    labels: { confirm: confirmLabel, cancel: cancelLabel },
    confirmProps: { color: danger ? 'red' : 'brand' },
    children:
      typeof body === 'string' ? (
        <Text size="sm" lh={1.6}>
          {body}
        </Text>
      ) : (
        body
      ),
    onConfirm: () => {
      void onConfirm();
    },
  });
}

/** A warning block used inside confirm dialogs that explain a real risk. */
export function ConfirmWarning({ children }: { children: ReactNode }) {
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap" mt="sm">
      <IconAlertTriangle size={18} stroke={1.5} color="var(--app-warning)" aria-hidden />
      <Text size="sm" c="dimmed" lh={1.55}>
        {children}
      </Text>
    </Group>
  );
}

export interface ConfirmWithReasonOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Called with the entered reason; only fires once validation passes. */
  onConfirm: (reason: string) => void | Promise<void>;
  reasonLabel?: string;
  reasonDescription?: string;
  /** Offers a closed list rather than free text. */
  reasonOptions?: ReadonlyArray<string>;
  /** Blocks confirmation until a reason is supplied. Defaults to `true`. */
  requireReason?: boolean;
  danger?: boolean;
  cancelLabel?: string;
}

/**
 * Confirmation that also collects a reason.
 *
 * `modals.openConfirmModal` cannot carry a validated field — its confirm button
 * is fixed when the modal opens — so this variant owns its footer. It is still
 * Mantine's `Modal` underneath, which is what supplies the focus trap, the
 * Escape handling and focus restoration.
 *
 * A failed `onConfirm` keeps the dialog open with the server's own message,
 * because a moderation action that was refused should not look like it worked.
 */
export function confirmWithReason({
  title,
  body,
  confirmLabel,
  onConfirm,
  reasonLabel = 'Reason',
  reasonDescription = 'Recorded in the audit log with your name.',
  reasonOptions,
  requireReason = true,
  danger = true,
  cancelLabel = 'Cancel',
}: ConfirmWithReasonOptions): void {
  const modalId = `confirm-reason-${Math.random().toString(36).slice(2)}`;

  modals.open({
    modalId,
    title,
    centered: true,
    radius: 'lg',
    children: (
      <ReasonedConfirmBody
        body={body}
        confirmLabel={confirmLabel}
        reasonLabel={reasonLabel}
        reasonDescription={reasonDescription}
        reasonOptions={reasonOptions}
        requireReason={requireReason}
        danger={danger}
        cancelLabel={cancelLabel}
        onConfirm={onConfirm}
        onClose={() => modals.close(modalId)}
      />
    ),
  });
}

interface ReasonedConfirmBodyProps extends Omit<ConfirmWithReasonOptions, 'title'> {
  onClose: () => void;
}

function ReasonedConfirmBody({
  body,
  confirmLabel,
  reasonLabel,
  reasonDescription,
  reasonOptions,
  requireReason = true,
  danger = true,
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
}: ReasonedConfirmBodyProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const blocked = requireReason && trimmed.length === 0;

  async function submit() {
    if (blocked) {
      setError('Enter a reason before continuing.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="sm">
      {typeof body === 'string' ? (
        <Text size="sm" lh={1.6}>
          {body}
        </Text>
      ) : (
        body
      )}

      {reasonOptions ? (
        <Select
          label={reasonLabel}
          description={reasonDescription}
          data={reasonOptions.map((option) => ({ value: option, label: option }))}
          value={reason.length > 0 ? reason : null}
          onChange={(value) => setReason(value ?? '')}
          error={error}
          size="xs"
        />
      ) : (
        <Textarea
          label={reasonLabel}
          description={reasonDescription}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          error={error}
          autosize
          minRows={2}
          maxLength={400}
          size="xs"
        />
      )}

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          color={danger ? 'red' : 'brand'}
          loading={busy}
          disabled={blocked}
          onClick={() => void submit()}
        >
          {confirmLabel}
        </Button>
      </Group>
    </Stack>
  );
}
