import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { portalContent, portalDashboardOverrides } from "../schema";
import { AuthorizationError, canManage, canViewCourseAccessLevel } from "./authz";

type Content = typeof portalContent.$inferSelect;

export type NewContent = {
  title: string;
  excerpt: string;
  body: string;
  type: "report" | "update" | "resource" | "prayer" | "story";
  accessLevel: "all" | "partner" | "major_donor" | "church" | "foundation" | "daf" | "ambassador" | "volunteer";
  status?: "draft" | "published";
  author?: string;
  tags?: string[];
  coverImage?: string | null;
  fileUrl?: string | null;
  publishedAt?: string | null;
};

export type UpdateContent = Partial<NewContent>;

export type DashboardOverrideInput = {
  roleKey: "individual" | "major_donor" | "church" | "foundation" | "daf" | "ambassador" | "volunteer";
  highlights?: unknown[];
  actions?: unknown[];
};

const CONTENT_ROLES = ["content_manager", "lms_manager"];

// Content is visible to a non-admin when it is published, within its publish
// window, and its access level is allowed for the caller's constituent type.
// portal_content.accessLevel includes "all" (the helper returns true for "all").
// Admins see everything.
export function isContentVisible(ctx: AuthContext, row: Content, nowIso = new Date().toISOString()): boolean {
  if (ctx.isAdmin) return true;
  if (row.status !== "published") return false;
  if (row.publishedAt != null && row.publishedAt > nowIso) return false;
  return canViewCourseAccessLevel(ctx, row.accessLevel);
}

export async function listContent(db: Db, ctx: AuthContext) {
  const nowIso = new Date().toISOString();
  const rows = await db.select().from(portalContent).all();
  return rows.filter((r) => isContentVisible(ctx, r, nowIso));
}

export async function getContent(db: Db, ctx: AuthContext, id: string) {
  const row = await db.select().from(portalContent).where(eq(portalContent.id, id)).get();
  if (!row) return null;
  return isContentVisible(ctx, row) ? row : null;
}

// Manage operations (content_manager / lms_manager / admin).
export async function createContent(db: Db, ctx: AuthContext, input: NewContent) {
  if (!canManage(ctx, CONTENT_ROLES)) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    type: input.type,
    accessLevel: input.accessLevel,
    status: input.status ?? "draft",
    author: input.author ?? "Favor International",
    tags: input.tags ?? [],
    coverImage: input.coverImage ?? null,
    fileUrl: input.fileUrl ?? null,
    publishedAt: input.publishedAt ?? null,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(portalContent).values(row);
  return row;
}

export async function updateContent(db: Db, ctx: AuthContext, id: string, input: UpdateContent) {
  if (!canManage(ctx, CONTENT_ROLES)) throw new AuthorizationError();
  const now = new Date().toISOString();
  await db
    .update(portalContent)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.accessLevel !== undefined ? { accessLevel: input.accessLevel } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.author !== undefined ? { author: input.author } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
      ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
      updatedBy: ctx.userId,
      updatedAt: now,
    })
    .where(eq(portalContent.id, id));
}

export async function deleteContent(db: Db, ctx: AuthContext, id: string) {
  if (!canManage(ctx, CONTENT_ROLES)) throw new AuthorizationError();
  await db.delete(portalContent).where(eq(portalContent.id, id));
}

// ---------------------------------------------------------------------------
// dashboard overrides (portal_dashboard_overrides, unique roleKey)
// Any authenticated user may read; content_manager/admin may upsert.
// ---------------------------------------------------------------------------
export async function listDashboardOverrides(db: Db, _ctx: AuthContext) {
  return db.select().from(portalDashboardOverrides).orderBy(desc(portalDashboardOverrides.updatedAt)).all();
}

export async function upsertDashboardOverride(db: Db, ctx: AuthContext, input: DashboardOverrideInput) {
  if (!canManage(ctx, ["content_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(portalDashboardOverrides)
    .where(eq(portalDashboardOverrides.roleKey, input.roleKey))
    .get();
  if (existing) {
    await db
      .update(portalDashboardOverrides)
      .set({
        ...(input.highlights !== undefined ? { highlights: input.highlights } : {}),
        ...(input.actions !== undefined ? { actions: input.actions } : {}),
        updatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(portalDashboardOverrides.roleKey, input.roleKey));
  } else {
    await db.insert(portalDashboardOverrides).values({
      id: crypto.randomUUID(),
      roleKey: input.roleKey,
      highlights: input.highlights ?? [],
      actions: input.actions ?? [],
      updatedBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
  }
  return db
    .select()
    .from(portalDashboardOverrides)
    .where(eq(portalDashboardOverrides.roleKey, input.roleKey))
    .get();
}
