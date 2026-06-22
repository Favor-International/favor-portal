import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { recordActivity } from "@/lib/db/access/activity";
import { logError, logInfo } from "@/lib/logger";
import type { ActivityEvent } from "@/types";

export const runtime = "nodejs";

const VALID_ACTIVITY_TYPES: ActivityEvent["type"][] = [
  "gift_created",
  "course_completed",
  "course_progress",
  "content_viewed",
  "support_ticket",
  "profile_updated",
  "login",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = String(body?.type ?? "") as ActivityEvent["type"];
    const metadata = (body?.metadata ?? {}) as ActivityEvent["metadata"];

    if (!VALID_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    await recordActivity(getDb(), ctx, { type, metadata: metadata ?? {} });

    logInfo({
      event: "activity.logged",
      route: "/api/activity",
      userId: ctx.userId,
      details: { type },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    logError({ event: "activity.log_failed", route: "/api/activity", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
