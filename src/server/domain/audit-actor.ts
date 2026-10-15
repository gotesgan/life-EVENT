import type { AuditContext } from '@/server/services/audit.service';

/**
 * The subset of an admin actor that the audit log records.
 *
 * Defined once. It was copy-pasted into two services, which meant a change to
 * what the audit log stores — a new field, or a different null handling — had to
 * be made twice and would silently differ between them if it was not.
 */
export interface AdminActor {
  userId: string;
  name: string;
  ipHash?: string | null;
  userAgent?: string | null;
}

/** Projects an actor onto the audit context, normalising absent values to null. */
export function toAuditActor(actor: AdminActor): AuditContext {
  return {
    actorUserId: actor.userId,
    actorName: actor.name,
    ipHash: actor.ipHash ?? null,
    userAgent: actor.userAgent ?? null,
  };
}
