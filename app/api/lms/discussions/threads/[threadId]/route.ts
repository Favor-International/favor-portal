import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getThread, updateThread } from "@/lib/db/access/community";
import { AuthorizationError, canManage } from "@/lib/db/access/authz";

export const runtime = "nodejs";

interface ThreadUpdateBody {
  pinned?: boolean;
  locked?: boolean;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    const body = (await request.json()) as ThreadUpdateBody;
    const updates: { pinned?: boolean; locked?: boolean } = {};
    if (typeof body.pinned === "boolean") updates.pinned = body.pinned;
    if (typeof body.locked === "boolean") updates.locked = body.locked;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    // Pin/lock is a manager-only operation (lms_manager / admin).
    if (!canManage(ctx, ["lms_manager"])) {
      return NextResponse.json({ error: "Insufficient permission" }, { status: 403 });
    }

    const db = getDb();

    try {
      await updateThread(db, ctx, threadId, updates);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Insufficient permission" }, { status: 403 });
      }
      throw error;
    }

    const data = await getThread(db, ctx, threadId);
    if (!data) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        thread: {
          id: data.id,
          pinned: data.pinned,
          locked: data.locked,
          updatedAt: data.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS discussion thread PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
