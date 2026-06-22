import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { communicationTemplates, communicationSendLogs } from "../schema";
import { AuthorizationError, canManage } from "./authz";

export type NewTemplate = {
  channel: "email" | "sms" | "direct_mail";
  name: string;
  subject?: string | null;
  content: string;
  status?: "active" | "draft";
};

export type UpdateTemplate = Partial<NewTemplate>;

export type NewSendLog = {
  templateId?: string | null;
  templateName: string;
  channel: "email" | "sms" | "direct_mail";
  recipient?: string | null;
  status?: "queued" | "sent" | "failed";
  metadata?: Record<string, unknown>;
};

// Roles that may manage communication templates / record sends.
const COMMS_MANAGER_ROLES = ["content_manager", "support_manager"];
// Roles that may read send logs (managers plus analysts).
const COMMS_VIEWER_ROLES = ["content_manager", "support_manager", "analyst"];

export async function listTemplates(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, COMMS_MANAGER_ROLES)) throw new AuthorizationError();
  return db
    .select()
    .from(communicationTemplates)
    .orderBy(desc(communicationTemplates.createdAt))
    .all();
}

export async function createTemplate(db: Db, ctx: AuthContext, input: NewTemplate) {
  if (!canManage(ctx, COMMS_MANAGER_ROLES)) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    channel: input.channel,
    name: input.name,
    subject: input.subject ?? null,
    content: input.content,
    status: input.status ?? "draft",
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(communicationTemplates).values(row);
  return row;
}

export async function updateTemplate(db: Db, ctx: AuthContext, id: string, input: UpdateTemplate) {
  if (!canManage(ctx, COMMS_MANAGER_ROLES)) throw new AuthorizationError();
  const now = new Date().toISOString();
  await db
    .update(communicationTemplates)
    .set({
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(communicationTemplates.id, id));
}

export async function deleteTemplate(db: Db, ctx: AuthContext, id: string) {
  if (!canManage(ctx, COMMS_MANAGER_ROLES)) throw new AuthorizationError();
  await db.delete(communicationTemplates).where(eq(communicationTemplates.id, id));
}

export async function recordSendLog(db: Db, ctx: AuthContext, input: NewSendLog) {
  if (!canManage(ctx, COMMS_MANAGER_ROLES)) throw new AuthorizationError();
  const row = {
    id: crypto.randomUUID(),
    templateId: input.templateId ?? null,
    templateName: input.templateName,
    channel: input.channel,
    recipient: input.recipient ?? null,
    sentBy: ctx.userId,
    status: input.status ?? "sent",
    metadata: input.metadata ?? {},
    sentAt: new Date().toISOString(),
  };
  await db.insert(communicationSendLogs).values(row);
  return row;
}

export async function listSendLogs(db: Db, ctx: AuthContext) {
  if (!canManage(ctx, COMMS_VIEWER_ROLES)) throw new AuthorizationError();
  return db
    .select()
    .from(communicationSendLogs)
    .orderBy(desc(communicationSendLogs.sentAt))
    .all();
}
