'use client';

import { ActionIcon, CopyButton, Group, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { StatusBadge } from '@/components/ui';
import { formatDateTime, maskEmail } from '@/lib/format';
import { CUSTOMER_TONES, ROLE_TONES, USER_STATUS_LABELS, labelFor } from './status';
import classes from './AdminPage.module.css';

/**
 * The moderation row shape.
 *
 * Declared here rather than imported from the service so this module can be used
 * from a Client Component without pulling a `server-only` module into the
 * browser bundle. It mirrors the service's explicit `select` exactly.
 */
export interface AdminCustomerRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  _count: { enquiries: number };
}

export function CustomerStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={CUSTOMER_TONES[status] ?? 'neutral'} size="sm" dot>
      {labelFor(USER_STATUS_LABELS, status)}
    </StatusBadge>
  );
}

export function CustomerRoleBadge({ role }: { role: string }) {
  return (
    <StatusBadge tone={ROLE_TONES[role] ?? 'neutral'} size="sm">
      {role === 'ADMIN' ? 'Administrator' : 'Customer'}
    </StatusBadge>
  );
}

/**
 * The account cell.
 *
 * The list masks the address — `docs/security.md` states admin list
 * projections mask by default, and this screen lists the entire customer base,
 * so the raw value is not printed. The full address is still one action away
 * for the administrator who needs to contact the account: hover shows it and
 * the copy control puts it on the clipboard.
 */
export function CustomerNameCell({ row }: { row: AdminCustomerRow }) {
  return (
    <div className={classes.cellStack}>
      <Text size="sm" fw={550} title={row.name} className={classes.truncate}>
        {row.name}
      </Text>
      <Group gap={4} wrap="nowrap" mt={2}>
        <Tooltip label={row.email} withArrow openDelay={200}>
          <Text
            component="span"
            size="xs"
            c="dimmed"
            title={row.email}
            className={classes.truncate}
          >
            {maskEmail(row.email)}
          </Text>
        </Tooltip>
        <CopyButton value={row.email} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy full email'} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label={`Copy the full email address for ${row.name}`}
                onClick={copy}
              >
                {copied ? (
                  <IconCheck size={13} stroke={1.5} />
                ) : (
                  <IconCopy size={13} stroke={1.5} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
    </div>
  );
}

export function CustomerCreatedCell({ row }: { row: AdminCustomerRow }) {
  const formatted = formatDateTime(row.createdAt);
  return (
    <Text component="span" size="sm" className={classes.timestamp} title={formatted ?? undefined}>
      {formatted ?? '—'}
    </Text>
  );
}
