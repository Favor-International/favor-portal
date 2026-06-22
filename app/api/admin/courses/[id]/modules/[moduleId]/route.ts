import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { deleteModule, updateModule } from "@/lib/db/access/courses";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import type { CourseModule } from "@/types";

export const runtime = "nodejs";

const MODULE_TYPES: NonNullable<CourseModule["type"]>[] = ["video", "reading", "quiz"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id: courseId, moduleId } = await params;
    const body = (await request.json()) as Partial<CourseModule>;

    if (body.type !== undefined && !MODULE_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid module type" }, { status: 400 });
    }

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    try {
      await updateModule(db, ctx, moduleId, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.cloudflareVideoId !== undefined
          ? { cloudflareVideoId: body.cloudflareVideoId || "demo" }
          : {}),
        ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
        ...(body.type !== undefined ? { moduleType: body.type } : {}),
        ...(body.resourceUrl !== undefined ? { resourceUrl: body.resourceUrl || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.quizPayload !== undefined
          ? { quizPayload: (body.quizPayload as Record<string, unknown> | null) ?? null }
          : {}),
        ...(body.passThreshold !== undefined ? { passThreshold: body.passThreshold } : {}),
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.module.update",
      entityType: "course_module",
      entityId: moduleId,
      details: { courseId, title: body.title ?? "", moduleType: body.type ?? "" },
    });

    logInfo({
      event: "admin.module.updated",
      route: "/api/admin/courses/[id]/modules/[moduleId]",
      userId: ctx.userId,
      details: { courseId, moduleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({
      event: "admin.modules.update_failed",
      route: "/api/admin/courses/[id]/modules/[moduleId]",
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id: courseId, moduleId } = await params;

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    try {
      await deleteModule(db, ctx, moduleId);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.module.delete",
      entityType: "course_module",
      entityId: moduleId,
      details: { courseId, moduleId },
    });

    logInfo({
      event: "admin.module.deleted",
      route: "/api/admin/courses/[id]/modules/[moduleId]",
      userId: ctx.userId,
      details: { courseId, moduleId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({
      event: "admin.modules.delete_failed",
      route: "/api/admin/courses/[id]/modules/[moduleId]",
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
