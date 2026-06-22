import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { deleteCourse, updateCourse } from "@/lib/db/access/courses";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import type { Course } from "@/types";

export const runtime = "nodejs";

const ACCESS_LEVELS: Course["accessLevel"][] = [
  "partner",
  "major_donor",
  "church",
  "foundation",
  "ambassador",
];
const STATUS: NonNullable<Course["status"]>[] = ["draft", "published"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<Course>;

    if (body.accessLevel !== undefined && !ACCESS_LEVELS.includes(body.accessLevel)) {
      return NextResponse.json({ error: "Invalid access level" }, { status: 400 });
    }
    if (body.status !== undefined && !STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const isPaid = body.isPaid !== undefined ? Boolean(body.isPaid) : undefined;

    try {
      await updateCourse(db, ctx, id, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.accessLevel !== undefined ? { accessLevel: body.accessLevel } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.isLocked !== undefined ? { isLocked: Boolean(body.isLocked) } : {}),
        ...(isPaid !== undefined ? { isPaid } : {}),
        ...(body.price !== undefined ? { price: isPaid === false ? 0 : Number(body.price ?? 0) } : {}),
        ...(body.tags !== undefined ? { tags: Array.isArray(body.tags) ? body.tags : [] } : {}),
        ...(body.coverImage !== undefined ? { coverImage: body.coverImage || null } : {}),
        ...(body.coverImage !== undefined ? { thumbnailUrl: body.coverImage || null } : {}),
        ...(body.enforceSequential !== undefined ? { enforceSequential: body.enforceSequential } : {}),
        ...(body.publishAt !== undefined ? { publishAt: body.publishAt ?? null } : {}),
        ...(body.unpublishAt !== undefined ? { unpublishAt: body.unpublishAt ?? null } : {}),
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.course.update",
      entityType: "course",
      entityId: id,
      details: {
        status: body.status ?? "",
        publishAt: body.publishAt ?? "",
        unpublishAt: body.unpublishAt ?? "",
      },
    });

    logInfo({
      event: "admin.course.updated",
      route: "/api/admin/courses/[id]",
      userId: ctx.userId,
      details: { courseId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "admin.courses.update_failed", route: "/api/admin/courses/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    try {
      await deleteCourse(db, ctx, id);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.course.delete",
      entityType: "course",
      entityId: id,
      details: { courseId: id },
    });

    logInfo({
      event: "admin.course.deleted",
      route: "/api/admin/courses/[id]",
      userId: ctx.userId,
      details: { courseId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ event: "admin.courses.delete_failed", route: "/api/admin/courses/[id]", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
