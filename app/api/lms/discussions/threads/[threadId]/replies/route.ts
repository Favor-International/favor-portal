import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  listReplies,
  createReply,
  listUserDisplayNames,
} from "@/lib/db/access/community";
import { AuthorizationError } from "@/lib/db/access/authz";

export const runtime = "nodejs";

interface CreateReplyBody {
  body?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    const replyRows = await listReplies(db, ctx, threadId);

    const authorIds = Array.from(new Set(replyRows.map((row) => row.authorUserId)));
    const userRows = await listUserDisplayNames(db, ctx, authorIds);

    const userNameMap = new Map<string, string>();
    for (const row of userRows) {
      userNameMap.set(row.id, `${row.firstName} ${row.lastName}`.trim());
    }

    return NextResponse.json(
      {
        success: true,
        replies: replyRows.map((row) => ({
          id: row.id,
          threadId: row.threadId,
          authorUserId: row.authorUserId,
          authorName: userNameMap.get(row.authorUserId) ?? "Favor Partner",
          body: row.body,
          isInstructorReply: row.isInstructorReply,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS discussion replies GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const body = (await request.json()) as CreateReplyBody;
    const content = body.body?.trim().slice(0, 3000);
    if (!content) {
      return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    let inserted;
    try {
      inserted = await createReply(db, ctx, threadId, content);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    const authorRows = await listUserDisplayNames(db, ctx, [ctx.userId]);
    const authorRow = authorRows[0];

    return NextResponse.json(
      {
        success: true,
        reply: {
          id: inserted.id,
          threadId: inserted.threadId,
          authorUserId: inserted.authorUserId,
          authorName: authorRow ? `${authorRow.firstName} ${authorRow.lastName}`.trim() : "Favor Partner",
          body: inserted.body,
          isInstructorReply: inserted.isInstructorReply,
          createdAt: inserted.createdAt,
          updatedAt: inserted.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS discussion replies POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
