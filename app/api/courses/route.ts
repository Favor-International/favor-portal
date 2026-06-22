import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { listCourses, listModulesForCourses } from "@/lib/db/access/courses";
import { listProgress } from "@/lib/db/access/learning";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const courses = await listCourses(db, ctx);
    const courseIds = courses.map((course) => course.id);
    const modules = await listModulesForCourses(db, ctx, courseIds);
    const moduleIds = new Set(modules.map((module) => module.id));

    let progress: Awaited<ReturnType<typeof listProgress>> = [];
    if (moduleIds.size > 0) {
      const allProgress = await listProgress(db, ctx);
      progress = allProgress.filter((p) => moduleIds.has(p.moduleId));
    }

    const formattedCourses = courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      accessLevel: course.accessLevel,
      sortOrder: course.sortOrder,
      status: course.status ?? "published",
      isLocked: Boolean(course.isLocked),
      isPaid: Boolean(course.isPaid),
      price: Number(course.price ?? 0),
      tags: course.tags,
      coverImage: course.coverImage,
      enforceSequential: course.enforceSequential ?? true,
      publishAt: course.publishAt,
      unpublishAt: course.unpublishAt,
      createdAt: course.createdAt,
    }));

    const formattedModules = modules.map((module) => ({
      id: module.id,
      courseId: module.courseId,
      title: module.title,
      description: module.description,
      cloudflareVideoId: module.cloudflareVideoId,
      sortOrder: module.sortOrder,
      durationSeconds: module.durationSeconds,
      type: module.moduleType ?? "video",
      resourceUrl: module.resourceUrl,
      notes: module.notes,
      quizPayload: module.quizPayload,
      passThreshold: module.passThreshold ?? 70,
    }));

    const formattedProgress = progress.map((p) => ({
      moduleId: p.moduleId,
      completed: p.completed,
      completedAt: p.completedAt,
      watchTimeSeconds: p.watchTimeSeconds,
      lastWatchedAt: p.lastWatchedAt,
    }));

    return NextResponse.json(
      {
        success: true,
        courses: formattedCourses,
        modules: formattedModules,
        progress: formattedProgress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Courses route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
