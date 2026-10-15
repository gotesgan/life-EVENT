'use client';

import { useRouter } from 'next/navigation';
import { ActionIcon, Menu, Text, Tooltip } from '@mantine/core';
import { IconDots, IconLock, IconLockOpen, IconUserOff } from '@tabler/icons-react';
import { confirmAction, confirmWithReason } from './confirm';
import { patchJson, notifyError, notifySuccess } from './api';
import { USER_STATUS_LABELS, labelFor } from './status';

export interface CustomerModerationControlProps {
  userId: string;
  name: string;
  status: string;
  role: string;
  /** True when this row is the signed-in administrator's own account. */
  isSelf: boolean;
  onDone?: () => void;
}

const SUSPEND_REASONS = [
  'Suspected spam or abuse',
  'Duplicate account',
  'Payment or fraud concern',
  'Requested by the customer',
];

/**
 * Suspend / reactivate / deactivate for one account.
 *
 * **Disabled for your own account and for other administrators.** The service
 * refuses both (`adminUpdateCustomerStatus`), so offering them would be a
 * control whose only possible outcome is an error. Explaining the refusal in
 * place is more useful than a menu that fails.
 */
export function CustomerModerationControl({
  userId,
  name,
  status,
  role,
  isSelf,
  onDone,
}: CustomerModerationControlProps) {
  const router = useRouter();

  const done = () => {
    if (onDone) onDone();
    else router.refresh();
  };

  async function setStatus(next: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', reason: string) {
    await patchJson(`/api/admin/customers/${userId}`, { status: next, reason });
    notifySuccess(
      `${name} is now ${labelFor(USER_STATUS_LABELS, next).toLowerCase()}.`,
      'Account updated',
    );
    done();
  }

  const blocked = isSelf || role === 'ADMIN';

  if (blocked) {
    const explanation = isSelf
      ? 'This is your own account. Ask another administrator to change it.'
      : 'Administrator accounts cannot be moderated here.';

    return (
      <Tooltip label={explanation} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          disabled
          aria-label={`Moderation actions for ${name}`}
        >
          <IconDots size={16} stroke={1.5} />
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Menu withinPortal position="bottom-end" shadow="md" radius="md">
      <Menu.Target>
        <Tooltip label={`Moderation actions for ${name}`} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`Moderation actions for ${name}`}
          >
            <IconDots size={16} stroke={1.5} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        {status !== 'ACTIVE' ? (
          <Menu.Item
            leftSection={<IconLockOpen size={15} stroke={1.5} />}
            onClick={() =>
              confirmWithReason({
                title: `Reactivate ${name}?`,
                body: `The account regains access immediately. ${
                  status === 'SUSPENDED'
                    ? 'A suspension is lifted the moment the account is active again.'
                    : 'A deactivated account is restored rather than recreated.'
                }`,
                confirmLabel: 'Reactivate account',
                reasonLabel: 'Reason for reactivating',
                danger: false,
                requireReason: false,
                onConfirm: (reason) => setStatus('ACTIVE', reason),
              })
            }
          >
            Reactivate
          </Menu.Item>
        ) : null}

        {status !== 'SUSPENDED' ? (
          <Menu.Item
            leftSection={<IconLock size={15} stroke={1.5} />}
            onClick={() =>
              confirmWithReason({
                title: `Suspend ${name}?`,
                body: 'Suspending blocks sign-in and every authenticated page immediately. It is reversible.',
                confirmLabel: 'Suspend account',
                reasonOptions: SUSPEND_REASONS,
                onConfirm: (reason) => setStatus('SUSPENDED', reason),
              })
            }
          >
            Suspend account
          </Menu.Item>
        ) : null}

        {status !== 'DEACTIVATED' ? (
          <Menu.Item
            color="red"
            leftSection={<IconUserOff size={15} stroke={1.5} />}
            onClick={() =>
              confirmAction({
                title: `Deactivate ${name}?`,
                body: (
                  <Text size="sm" lh={1.6}>
                    Deactivating records the account as closed. Their enquiries stay in the back
                    office, but the account can no longer sign in and is treated as inactive
                    everywhere.
                  </Text>
                ),
                confirmLabel: 'Deactivate account',
                onConfirm: () =>
                  setStatus('DEACTIVATED', 'Deactivated by an administrator').catch(
                    (error: unknown) => notifyError(error, 'Account not updated'),
                  ),
              })
            }
          >
            Deactivate account
          </Menu.Item>
        ) : null}
      </Menu.Dropdown>
    </Menu>
  );
}
