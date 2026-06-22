import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

const iso = () => new Date().toISOString();

const CONSTITUENT_PLUS_ALL = [
  "all",
  "partner",
  "major_donor",
  "church",
  "foundation",
  "daf",
  "ambassador",
  "volunteer",
] as const;

// portal_content (migration 005)
export const portalContent = sqliteTable("portal_content", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  type: text("type", { enum: ["report", "update", "resource", "prayer", "story"] }).notNull(),
  accessLevel: text("access_level", { enum: CONSTITUENT_PLUS_ALL }).notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  author: text("author").notNull().default("Favor International"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
  coverImage: text("cover_image"),
  fileUrl: text("file_url"),
  publishedAt: text("published_at"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().$defaultFn(iso),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
});

// support_tickets (migration 005)
export const supportTickets = sqliteTable("support_tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  requesterUserId: text("requester_user_id").references(() => users.id, { onDelete: "set null" }),
  requesterName: text("requester_name"),
  requesterEmail: text("requester_email"),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["open", "in_progress", "resolved"] }).notNull().default("open"),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] }).notNull().default("normal"),
  createdAt: text("created_at").notNull().$defaultFn(iso),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
  resolvedAt: text("resolved_at"),
});

// support_messages (migration 005)
export const supportMessages = sqliteTable("support_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  sender: text("sender", { enum: ["partner", "staff"] }).notNull(),
  senderUserId: text("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(iso),
});

// communication_templates (migration 005)
export const communicationTemplates = sqliteTable("communication_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  channel: text("channel", { enum: ["email", "sms", "direct_mail"] }).notNull(),
  name: text("name").notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  status: text("status", { enum: ["active", "draft"] }).notNull().default("draft"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().$defaultFn(iso),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
});

// communication_send_logs (migration 005)
export const communicationSendLogs = sqliteTable("communication_send_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id").references(() => communicationTemplates.id, { onDelete: "set null" }),
  templateName: text("template_name").notNull(),
  channel: text("channel", { enum: ["email", "sms", "direct_mail"] }).notNull(),
  recipient: text("recipient"),
  sentBy: text("sent_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status", { enum: ["queued", "sent", "failed"] }).notNull().default("sent"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  sentAt: text("sent_at").notNull().$defaultFn(iso),
});

// portal_activity_events (migration 005)
export const portalActivityEvents = sqliteTable("portal_activity_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type", {
    enum: [
      "gift_created",
      "course_completed",
      "course_progress",
      "content_viewed",
      "support_ticket",
      "profile_updated",
      "login",
    ],
  }).notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  createdAt: text("created_at").notNull().$defaultFn(iso),
});

// portal_dashboard_overrides (migration 007)
export const portalDashboardOverrides = sqliteTable("portal_dashboard_overrides", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  roleKey: text("role_key", {
    enum: ["individual", "major_donor", "church", "foundation", "daf", "ambassador", "volunteer"],
  }).notNull().unique(),
  highlights: text("highlights", { mode: "json" }).$type<unknown[]>().notNull().$defaultFn(() => []),
  actions: text("actions", { mode: "json" }).$type<unknown[]>().notNull().$defaultFn(() => []),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().$defaultFn(iso),
  updatedAt: text("updated_at").notNull().$defaultFn(iso),
});

// admin_audit_logs (migration 003)
export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>().notNull().$defaultFn(() => ({})),
  createdAt: text("created_at").$defaultFn(iso),
});
