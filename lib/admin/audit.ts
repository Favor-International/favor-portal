import type { Db } from "../db/client";
import { adminAuditLogs } from "../db/schema";

interface AuditInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

// Best-effort admin audit log (never throws — failures are logged, not propagated).
export async function logAdminAudit(db: Db, input: AuditInput): Promise<void> {
  try {
    await db.insert(adminAuditLogs).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? {},
    });
  } catch (error) {
    console.error("Failed to write admin audit log:", error);
  }
}
