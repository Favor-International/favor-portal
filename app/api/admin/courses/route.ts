import { NextRequest, NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  createCourse,
  listAllCoursesAdmin,
  listModulesForCourses,
} from "@/lib/db/access/courses";
import { getLmsAnalyticsData } from "@/lib/db/access/learning";
import { userCourseNotes } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/db/access/authz";
import { logAdminAudit } from "@/lib/admin/audit";
import { logError, logInfo } from "@/lib/logger";
import type { Course, CourseModule } from "@/types";

export const runtime = "nodejs";

type CourseRow = Awaited<ReturnType<typeof listAllCoursesAdmin>>[number];
type ModuleRow = Awaited<ReturnType<typeof listModulesForCourses>>[number];

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl ?? row.coverImage ?? undefined,
    accessLevel: (row.accessLevel ?? "partner") as Course["accessLevel"],
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt ?? "",
    moduleCount: 0,
    status: row.status ?? "published",
    isLocked: Boolean(row.isLocked),
    isPaid: Boolean(row.isPaid),
    price: Number(row.price ?? 0),
    tags: row.tags ?? [],
    coverImage: row.coverImage ?? "",
    enforceSequential: row.enforceSequential ?? true,
    publishAt: row.publishAt ?? undefined,
    unpublishAt: row.unpublishAt ?? undefined,
  };
}

function mapModule(row: ModuleRow): CourseModule {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    description: row.description ?? "",
    cloudflareVideoId: row.cloudflareVideoId,
    sortOrder: row.sortOrder ?? 0,
    durationSeconds: row.durationSeconds ?? 0,
    type: (row.moduleType as CourseModule["type"]) ?? "video",
    resourceUrl: row.resourceUrl ?? "",
    notes: row.notes ?? "",
    passThreshold: row.passThreshold ?? 70,
    quizPayload: row.quizPayload ?? undefined,
  };
}

const ACCESS_LEVELS: Course["accessLevel"][] = [
  "partner",
  "major_donor",
  "church",
  "foundation",
  "ambassador",
];
const STATUS: NonNullable<Course["status"]>[] = ["draft", "published"];

export async function GET() {
  try {
    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    const courseRows = await listAllCoursesAdmin(db, ctx);
    const moduleRows = await listModulesForCourses(
      db,
      ctx,
      courseRows.map((row) => row.id)
    );
    const analytics = await getLmsAnalyticsData(db, ctx);
    const notesCount = (await db.select({ id: userCourseNotes.id }).from(userCourseNotes).all()).length;

    return NextResponse.json({
      success: true,
      courses: courseRows.map(mapCourse),
      modules: moduleRows.map(mapModule),
      progress: analytics.progress,
      quizAttempts: analytics.quizAttempts,
      events: analytics.events,
      certificates: analytics.certificates,
      notesCount,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError({ event: "admin.courses.fetch_failed", route: "/api/admin/courses", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Course>;
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    const accessLevel = (body.accessLevel ?? "partner") as Course["accessLevel"];
    if (!ACCESS_LEVELS.includes(accessLevel)) {
      return NextResponse.json({ error: "Invalid access level" }, { status: 400 });
    }
    const status = (body.status ?? "draft") as NonNullable<Course["status"]>;
    if (!STATUS.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const auth = await adminRoute("lms:manage");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();
    const isPaid = Boolean(body.isPaid);

    let created;
    try {
      created = await createCourse(db, ctx, {
        title,
        description,
        accessLevel,
        sortOrder: body.sortOrder ?? 0,
        status,
        isLocked: Boolean(body.isLocked),
        isPaid,
        price: isPaid ? Number(body.price ?? 0) : 0,
        tags: Array.isArray(body.tags) ? body.tags : [],
        coverImage: body.coverImage || null,
        thumbnailUrl: body.coverImage || null,
        enforceSequential: body.enforceSequential ?? true,
        publishAt: body.publishAt ?? null,
        unpublishAt: body.unpublishAt ?? null,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      throw error;
    }

    await logAdminAudit(db, {
      actorUserId: ctx.userId,
      action: "lms.course.create",
      entityType: "course",
      entityId: created.id,
      details: { title: created.title, status: created.status },
    });

    logInfo({
      event: "admin.course.created",
      route: "/api/admin/courses",
      userId: ctx.userId,
      details: { courseId: created.id },
    });

    return NextResponse.json({ success: true, course: mapCourse(created) }, { status: 201 });
  } catch (error) {
    logError({ event: "admin.courses.create_failed", route: "/api/admin/courses", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
