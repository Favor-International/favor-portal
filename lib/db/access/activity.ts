import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { portalActivityEvents, adminAuditLogs, courseVersions } from "../schema";
import { AuthorizationError, canManage } from "./authz";

export type ActivityInput = {
  type:
    | "gift_created"
    | "course_completed"
    | "course_progress"
    | "content_viewed"
    | "support_ticket"
    | "profile_updated"
    | "login";
  metadata?: Record<string, unknown>;
};

export type AuditLogInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export type NewCourseVersion = {
  courseId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  published?: boolean;
};

// ---------------------------------------------------------------------------
// portal_activity_events (owner-scoped userId)
// ---------------------------------------------------------------------------
export async function recordActivity(db: Db, ctx: AuthContext, input: ActivityInput) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    type: input.type,
    userId: ctx.userId,
    metadata: input.metadata ?? {},
    createdAt: now,
  };
  await db.insert(portalActivityEvents).values(row);
  return row;
}

export async function listMyActivity(db: Db, ctx: AuthContext) {
  return db
    .select()
    .from(portalActivityEvents)
    .where(eq(portalActivityEvents.userId, ctx.userId))
    .orderBy(desc(portalActivityEvents.createdAt))
    .all();
}

export async function listAllActivity(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, ["analyst", "support_manager"])) throw new AuthorizationError();
  return db.select().from(portalActivityEvents).orderBy(desc(portalActivityEvents.createdAt)).all();
}

// ---------------------------------------------------------------------------
// admin_audit_logs (manager-gated writes; analyst/lms_manager/admin reads)
// ---------------------------------------------------------------------------
export async function writeAuditLog(db: Db, ctx: AuthContext, input: AuditLogInput) {
  if (!canManage(ctx, ["content_manager", "support_manager", "lms_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    actorUserId: ctx.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? {},
    createdAt: now,
  };
  await db.insert(adminAuditLogs).values(row);
  return row;
}

export async function listAuditLogs(db: Db, ctx: AuthContext) {
  if (!(ctx.isAdmin || canManage(ctx, ["analyst", "lms_manager"]))) throw new AuthorizationError();
  return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).all();
}

// ---------------------------------------------------------------------------
// course_versions (lms_manager/admin writes; analyst/lms_manager/admin reads)
// ---------------------------------------------------------------------------
export async function createCourseVersion(db: Db, ctx: AuthContext, input: NewCourseVersion) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    courseId: input.courseId,
    versionNumber: input.versionNumber,
    snapshot: input.snapshot,
    published: input.published ?? false,
    createdBy: ctx.userId,
    createdAt: now,
  };
  await db.insert(courseVersions).values(row);
  return row;
}

export async function listCourseVersions(db: Db, ctx: AuthContext, courseId: string) {
  if (!(ctx.isAdmin || canManage(ctx, ["lms_manager", "analyst"]))) throw new AuthorizationError();
  return db
    .select()
    .from(courseVersions)
    .where(eq(courseVersions.courseId, courseId))
    .orderBy(desc(courseVersions.versionNumber))
    .all();
}
