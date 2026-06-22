import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { createModule } from "@/lib/db/access/courses";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import type { CourseModule } from "@/types";

export const runtime = "nodejs";

const MODULE_TYPES: NonNullable<CourseModule["type"]>[] = ["video", "reading", "quiz"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const body = (await request.json()) as Partial<CourseModule>;

    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "Module title is required" }, { status: 400 });
    }
    const moduleType = (body.type ?? "video") as NonNullable<CourseModule["type"]>;
    if (!MODULE_TYPES.includes(moduleType)) {
      return NextResponse.json({ error: "Invalid module type" }, { status: 400 });
    }

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    let created;
    try {
      created = await createModule(db, ctx, courseId, {
        title,
        description: body.description || null,
        cloudflareVideoId: body.cloudflareVideoId || "demo",
        sortOrder: body.sortOrder ?? 0,
        durationSeconds: body.durationSeconds ?? 600,
        moduleType,
        resourceUrl: body.resourceUrl || null,
        notes: body.notes || null,
        quizPayload: (body.quizPayload as Record<string, unknown> | null | undefined) ?? null,
        passThreshold: body.passThreshold ?? 70,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.module.create",
      entityType: "course_module",
      entityId: created.id,
      details: { courseId, title: created.title, moduleType: created.moduleType },
    });

    logInfo({
      event: "admin.module.created",
      route: "/api/admin/courses/[id]/modules",
      userId: ctx.userId,
      details: { courseId, moduleId: created.id },
    });

    return NextResponse.json({ success: true, moduleId: created.id }, { status: 201 });
  } catch (error) {
    logError({
      event: "admin.modules.create_failed",
      route: "/api/admin/courses/[id]/modules",
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
