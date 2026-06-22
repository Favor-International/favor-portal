import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  listThreads,
  createThread,
  listUserDisplayNames,
} from "@/lib/db/access/community";

export const runtime = "nodejs";

interface CreateThreadBody {
  courseId?: string;
  cohortId?: string | null;
  moduleId?: string | null;
  title?: string;
  body?: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");
    const cohortId = url.searchParams.get("cohortId");
    const moduleId = url.searchParams.get("moduleId");

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    let threadRows = await listThreads(db, ctx, courseId);

    if (cohortId) {
      threadRows = threadRows.filter((row) => row.cohortId == null || row.cohortId === cohortId);
    }

    if (moduleId) {
      threadRows = threadRows.filter((row) => row.moduleId === moduleId);
    }

    threadRows = [...threadRows].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "");
    });

    const authorIds = Array.from(new Set(threadRows.map((row) => row.authorUserId)));
    const userRows = await listUserDisplayNames(db, ctx, authorIds);

    const userNameMap = new Map<string, string>();
    for (const row of userRows) {
      userNameMap.set(row.id, `${row.firstName} ${row.lastName}`.trim());
    }

    return NextResponse.json(
      {
        success: true,
        threads: threadRows.map((row) => ({
          id: row.id,
          courseId: row.courseId,
          cohortId: row.cohortId,
          moduleId: row.moduleId,
          authorUserId: row.authorUserId,
          authorName: userNameMap.get(row.authorUserId) ?? "Favor Partner",
          title: row.title,
          body: row.body,
          pinned: row.pinned,
          locked: row.locked,
          replyCount: row.replyCount,
          lastActivityAt: row.lastActivityAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS discussion threads GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateThreadBody;
    if (!body.courseId || !body.title?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: "Missing courseId, title, or body" }, { status: 400 });
    }

    const title = body.title.trim().slice(0, 140);
    const content = body.body.trim().slice(0, 5000);
    if (!title || !content) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    const inserted = await createThread(db, ctx, {
      courseId: body.courseId,
      cohortId: body.cohortId ?? null,
      moduleId: body.moduleId ?? null,
      title,
      body: content,
    });

    const authorRows = await listUserDisplayNames(db, ctx, [ctx.userId]);
    const authorRow = authorRows[0];

    return NextResponse.json(
      {
        success: true,
        thread: {
          id: inserted.id,
          courseId: inserted.courseId,
          cohortId: inserted.cohortId,
          moduleId: inserted.moduleId,
          authorUserId: inserted.authorUserId,
          authorName: authorRow ? `${authorRow.firstName} ${authorRow.lastName}`.trim() : "Favor Partner",
          title: inserted.title,
          body: inserted.body,
          pinned: inserted.pinned,
          locked: inserted.locked,
          replyCount: inserted.replyCount,
          lastActivityAt: inserted.lastActivityAt,
          createdAt: inserted.createdAt,
          updatedAt: inserted.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS discussion threads POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
