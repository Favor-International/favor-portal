import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getCourseWithModules } from "@/lib/db/access/courses";
import { createCourseVersion, listCourseVersions } from "@/lib/db/access/activity";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";

export const runtime = "nodejs";

interface SnapshotBody {
  courseId?: string;
  published?: boolean;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SnapshotBody;
    if (!body.courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    let inserted;
    let nextVersion;
    try {
      const courseWithModules = await getCourseWithModules(db, ctx, body.courseId);
      if (!courseWithModules) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const existingVersions = await listCourseVersions(db, ctx, body.courseId);
      nextVersion = (existingVersions[0]?.versionNumber ?? 0) + 1;

      const snapshot = {
        course: courseWithModules.course,
        modules: courseWithModules.modules,
        reason: body.reason ?? "manual_snapshot",
        createdAt: new Date().toISOString(),
      };

      inserted = await createCourseVersion(db, ctx, {
        courseId: body.courseId,
        versionNumber: nextVersion,
        snapshot,
        published: Boolean(body.published),
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Insufficient permission" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.course.snapshot",
      entityType: "course",
      entityId: body.courseId,
      details: {
        versionNumber: nextVersion,
        published: Boolean(body.published),
        reason: body.reason ?? "manual_snapshot",
      },
    });

    return NextResponse.json(
      {
        success: true,
        versionId: inserted.id,
        versionNumber: inserted.versionNumber,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Course snapshot route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
