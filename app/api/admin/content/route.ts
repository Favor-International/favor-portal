import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { createContent, listAllContent } from "@/lib/db/access/content";
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

const VALID_TYPES: ContentItem["type"][] = ["report", "update", "resource", "prayer", "story"];
const VALID_ACCESS: ContentItem["accessLevel"][] = [
  "all",
  "partner",
  "major_donor",
  "church",
  "foundation",
  "daf",
  "ambassador",
  "volunteer",
];
const VALID_STATUS: NonNullable<ContentItem["status"]>[] = ["draft", "published"];

function parseContentInput(body: unknown): {
  title: string;
  excerpt: string;
  body: string;
  type: ContentItem["type"];
  accessLevel: ContentItem["accessLevel"];
  author: string;
  tags: string[];
  coverImage?: string;
  fileUrl?: string;
  status: NonNullable<ContentItem["status"]>;
} | null {
  const input = body as Partial<ContentItem> & { status?: ContentItem["status"] };
  const title = String(input?.title ?? "").trim();
  const excerpt = String(input?.excerpt ?? "").trim();
  const contentBody = String(input?.body ?? "").trim();
  const type = input?.type;
  const accessLevel = input?.accessLevel;
  const author = String(input?.author ?? "Favor International").trim() || "Favor International";
  const tags = Array.isArray(input?.tags)
    ? input.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const status = (input?.status ?? "draft") as NonNullable<ContentItem["status"]>;

  if (!title || !excerpt || !contentBody) return null;
  if (!type || !VALID_TYPES.includes(type)) return null;
  if (!accessLevel || !VALID_ACCESS.includes(accessLevel)) return null;
  if (!VALID_STATUS.includes(status)) return null;

  return {
    title,
    excerpt,
    body: contentBody,
    type,
    accessLevel,
    author,
    tags,
    coverImage: input?.coverImage,
    fileUrl: input?.fileUrl,
    status,
  };
}

export async function GET() {
  try {
    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listAllContent(getDb(), ctx);

    return NextResponse.json({
      success: true,
      items: rows.map((row) => mapContentRow(row as ContentRow)),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.content.fetch_failed", route: "/api/admin/content", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = parseContentInput(await request.json());
    if (!payload) {
      return NextResponse.json({ error: "Invalid content payload" }, { status: 400 });
    }

    const auth = await adminRoute("content:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    let created;
    try {
      created = await createContent(db, ctx, {
        title: payload.title,
        excerpt: payload.excerpt,
        body: payload.body,
        type: payload.type,
        accessLevel: payload.accessLevel,
        status: payload.status,
        author: payload.author,
        tags: payload.tags,
        coverImage: payload.coverImage ?? null,
        fileUrl: payload.fileUrl ?? null,
        publishedAt: payload.status === "published" ? new Date().toISOString() : null,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "admin.content.created",
      entityType: "portal_content",
      entityId: created.id,
      details: { contentId: created.id },
    });

    logInfo({
      event: "admin.content.created",
      route: "/api/admin/content",
      userId: ctx.userId,
      details: { contentId: created.id },
    });

    return NextResponse.json({ success: true, item: mapContentRow(created as ContentRow) }, { status: 201 });
  } catch (error) {
    logError({ event: "admin.content.create_failed", route: "/api/admin/content", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
