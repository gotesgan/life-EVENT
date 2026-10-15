'use client';

import { Fragment, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Code,
  Group,
  Stack,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import classes from './Audit.module.css';
import pageClasses from './AdminPage.module.css';

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUserId: string | null;
  actorName: string | null;
  metadata: unknown;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditTableProps {
  rows: AuditLogRow[];
  emptyState?: ReactNode;
}

/**
 * Audit log table with expandable metadata.
 *
 * The table is built from the **named** `Table*` exports rather than
 * `Table.Thead`-style statics: compound components are not usable from a Server
 * Component, and this file must stay renderable from either side.
 *
 * Expansion is a real `Button` carrying `aria-expanded` and `aria-controls`, so
 * a row's metadata is reachable by keyboard rather than only by mouse. The
 * detail row prints the raw audit payload, which is what an investigator
 * actually needs — the summary column is only a human index.
 */
export function AuditTable({ rows, emptyState }: AuditTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <div className={classes.emptyWrap}>
        {emptyState ?? (
          <EmptyState
            title="No audit entries"
            description="Administrative actions are recorded here as they happen."
          />
        )}
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <TableScrollContainer minWidth={1100} type="native" className={classes.scroller}>
        <Table
          withTableBorder
          withRowBorders
          borderColor="var(--app-border)"
          horizontalSpacing="md"
          verticalSpacing="sm"
          tabularNums
          className={classes.table}
        >
          <TableThead>
            <TableTr>
              <TableTh scope="col" className={classes.th} style={{ width: 56 }}>
                <span className={classes.visuallyHidden}>Details</span>
              </TableTh>
              <TableTh scope="col" className={classes.th} style={{ width: 200 }}>
                Action
              </TableTh>
              <TableTh scope="col" className={classes.th} style={{ width: 190 }}>
                Entity
              </TableTh>
              <TableTh scope="col" className={classes.th} style={{ width: 320 }}>
                Summary
              </TableTh>
              <TableTh scope="col" className={classes.th} style={{ width: 170 }}>
                Actor
              </TableTh>
              <TableTh scope="col" className={classes.th} style={{ width: 180 }}>
                When
              </TableTh>
            </TableTr>
          </TableThead>

          <TableTbody>
            {rows.map((row) => {
              const isOpen = expanded.has(row.id);
              const detailId = `audit-metadata-${row.id}`;

              return (
                <Fragment key={row.id}>
                  <TableTr>
                    <TableTd className={classes.td}>
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-xs"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                        aria-label={`${isOpen ? 'Hide' : 'Show'} metadata for ${row.action}`}
                        onClick={() => toggle(row.id)}
                      >
                        {isOpen ? (
                          <IconChevronDown size={16} stroke={1.5} />
                        ) : (
                          <IconChevronRight size={16} stroke={1.5} />
                        )}
                      </Button>
                    </TableTd>
                    <TableTd className={classes.td}>
                      <Text size="sm" fw={550} title={row.action} className={classes.truncate}>
                        {row.action}
                      </Text>
                    </TableTd>
                    <TableTd className={classes.td}>
                      <Stack gap={2}>
                        <Text size="sm">{row.entityType}</Text>
                        <Text size="xs" c="dimmed" className={classes.id}>
                          {row.entityId}
                        </Text>
                      </Stack>
                    </TableTd>
                    <TableTd className={classes.td}>
                      {/* The summary is free text written by a human, so it is
                          the column most likely to run long. It truncates with
                          the full sentence on hover rather than wrapping the row
                          — and the raw payload is one click away regardless. */}
                      <Text size="sm" title={row.summary} className={classes.truncate}>
                        {row.summary}
                      </Text>
                    </TableTd>
                    <TableTd className={classes.td}>
                      <Text size="sm" c={row.actorName ? undefined : 'dimmed'}>
                        {row.actorName ?? 'System'}
                      </Text>
                    </TableTd>
                    <TableTd className={classes.td}>
                      <Text
                        component="span"
                        size="sm"
                        className={pageClasses.timestamp}
                        title={formatDateTime(row.createdAt) ?? undefined}
                      >
                        {formatDateTime(row.createdAt) ?? '—'}
                      </Text>
                    </TableTd>
                  </TableTr>

                  {isOpen ? (
                    <TableTr id={detailId}>
                      <TableTd className={classes.detailCell} colSpan={6}>
                        <Stack gap="xs">
                          <Group gap="xs">
                            {row.actorUserId ? (
                              <Badge variant="default" size="sm" className={classes.metaBadge}>
                                Actor id: {row.actorUserId}
                              </Badge>
                            ) : null}
                            {row.ipHash ? (
                              <Badge variant="default" size="sm" className={classes.metaBadge}>
                                IP hash present
                              </Badge>
                            ) : null}
                          </Group>

                          <div>
                            <Text size="xs" fw={600} className={classes.detailLabel}>
                              Metadata
                            </Text>
                            <Code block className={classes.code}>
                              {row.metadata === null || row.metadata === undefined
                                ? 'No metadata recorded for this entry.'
                                : JSON.stringify(row.metadata, null, 2)}
                            </Code>
                          </div>

                          {row.userAgent ? (
                            <div>
                              <Text size="xs" fw={600} className={classes.detailLabel}>
                                User agent
                              </Text>
                              <Text size="xs" c="dimmed" className={classes.id}>
                                {row.userAgent}
                              </Text>
                            </div>
                          ) : null}
                        </Stack>
                      </TableTd>
                    </TableTr>
                  ) : null}
                </Fragment>
              );
            })}
          </TableTbody>
        </Table>
      </TableScrollContainer>
    </div>
  );
}
