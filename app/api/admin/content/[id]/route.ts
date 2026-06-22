import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { deleteContent, getContent, updateContent } from "@/lib/db/access/content";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import type { ContentItem } from "@/types";

export const runtime = "nodejs";

type ContentRow = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  type: ContentItem["type"];
  accessLevel: ContentItem["accessLevel"];
  status: NonNullable<ContentItem["status"]>;
  author: string;
  tags: string[];
  coverImage: string | null;
  fileUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

function mapContentRow(row: ContentRow): ContentItem {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    type: row.type,
    accessLevel: row.accessLevel,
    date: row.publishedAt ?? row.updatedAt ?? row.createdAt,
    author: row.author,
    tags: row.tags ?? [],
    coverImage: row.coverImage ?? undefined,
    fileUrl: row.fileUrl ?? undefined,
    status: row.status,
  };
}

const VALID_STATUS: NonNullable<ContentItem["status"]>[] = ["draft", "published"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<ContentItem>;

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const status = body.status as ContentItem["status"] | undefined;
    if (status && !VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const db = getDb();

    try {
      await updateContent(db, ctx, id, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.accessLevel !== undefined ? { accessLevel: body.accessLevel } : {}),
        ...(body.author !== undefined ? { author: body.author } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.coverImage !== undefined ? { coverImage: body.coverImage ?? null } : {}),
        ...(body.fileUrl !== undefined ? { fileUrl: body.fileUrl ?? null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(status === "published" ? { publishedAt: new Date().toISOString() } : {}),
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    const updated = await getContent(db, ctx, id);
    if (!updated) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.content.updated",
      entityType: "portal_content",
      entityId: id,
      details: { contentId: id },
    });

    logInfo({
      event: "admin.content.updated",
      route: "/api/admin/content/[id]",
      userId: ctx.userId,
      details: { contentId: id },
    });

    return NextResponse.json({ success: true, item: mapContentRow(updated as ContentRow) });
  } catch (error) {
    logError({ event: "admin.content.update_failed", route: "/api/admin/content/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    try {
      await deleteContent(db, ctx, id);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.content.deleted",
      entityType: "portal_content",
      entityId: id,
      details: { contentId: id },
    });

    logInfo({
      event: "admin.content.deleted",
      route: "/api/admin/content/[id]",
      userId: ctx.userId,
      details: { contentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "admin.content.delete_failed", route: "/api/admin/content/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
