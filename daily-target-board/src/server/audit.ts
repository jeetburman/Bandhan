import type { Prisma } from "@prisma/client";

export type AuditAction = "PLAN_PUBLISHED" | "HOLIDAY_ADDED" | "HOLIDAY_REMOVED";

export interface AuditEntry {
  actorId: string | null;
  branchId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append one audit row. Pass the transaction client so the audit entry commits or
 * rolls back together with the change it describes.
 */
export async function writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      branchId: entry.branchId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      // The JSON round trip drops undefined and throws on a stray BigInt.
      metadata:
        entry.metadata === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(entry.metadata)) as Prisma.InputJsonValue),
    },
  });
}