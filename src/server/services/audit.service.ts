import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import type { AuditAction } from '@/lib/validation/audit';

export interface AuditContext {
  actorUserId?: string | null;
  actorName?: string | null;
  /** Salted hash only — a raw IP address is never stored. */
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface RecordAuditInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Short human-readable description shown in the audit log UI. */
  summary: string;
  metadata?: Prisma.InputJsonValue;
  context?: AuditContext;
}

/**
 * Appends an audit entry for an administrative action.
 *
 * Accepts an optional transaction client so an audit row is written in the same
 * transaction as the change it describes. That matters: an action that succeeds
 * must always be auditable, and an action that rolls back must not leave a
 * misleading audit entry behind.
 */
export async function recordAudit(
  input: RecordAuditInput,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;

  await client.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata,
      actorUserId: input.context?.actorUserId ?? null,
      actorName: input.context?.actorName ?? null,
      ipHash: input.context?.ipHash ?? null,
      userAgent: input.context?.userAgent ?? null,
    },
  });
}

export interface AuditLogListQuery {
  page: number;
  pageSize: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
}

/** Administrator-facing audit log with only the filters the UI exposes. */
export async function listAuditLogs(query: AuditLogListQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
  };

  const [rows, totalItems] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, totalItems };
}
