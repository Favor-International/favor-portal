import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { recordModuleEvent, type ModuleEventInput } from "@/lib/db/access/learning";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ModuleEventInput>;
    if (!body.courseId || !body.moduleId || !body.eventType) {
      return NextResponse.json(
        { error: "Missing courseId, moduleId, or eventType" },
        { status: 400 }
      );
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    await recordModuleEvent(getDb(), ctx, {
      courseId: body.courseId,
      moduleId: body.moduleId,
      eventType: body.eventType,
      watchTimeSeconds: body.watchTimeSeconds,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("LMS events POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
