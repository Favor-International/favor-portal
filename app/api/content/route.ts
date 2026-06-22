import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listContent } from "@/lib/db/access/content";
import { logError } from "@/lib/logger";
import type { ContentItem } from "@/types";

export const runtime = "nodejs";

type ContentRow = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  type: string;
  accessLevel: string;
  author: string;
  tags: string[];
  coverImage: string | null;
  fileUrl: string | null;
  status: string;
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
    type: row.type as ContentItem["type"],
    accessLevel: row.accessLevel as ContentItem["accessLevel"],
    date: row.publishedAt ?? row.updatedAt ?? row.createdAt,
    author: row.author,
    tags: row.tags ?? [],
    coverImage: row.coverImage ?? undefined,
    fileUrl: row.fileUrl ?? undefined,
    status: row.status as ContentItem["status"],
  };
}

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const rows = await listContent(getDb(), ctx);
    const sorted = [...rows].sort((a, b) => {
      const aPub = a.publishedAt ?? "";
      const bPub = b.publishedAt ?? "";
      if (aPub !== bPub) return bPub.localeCompare(aPub);
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });

    return NextResponse.json({
      success: true,
      items: sorted.map(mapContentRow),
    });
  } catch (error) {
    logError({ event: "content.fetch_failed", route: "/api/content", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
