import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getLmsAnalyticsData } from "@/lib/db/access/learning";
import { AuthorizationError } from "@/lib/db/access/authz";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await adminRoute("analytics:view");
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    let data;
    try {
      data = await getLmsAnalyticsData(getDb(), ctx);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Insufficient permission" }, { status: 403 });
      }
      throw error;
    }

    const { courses, modules, progress: progressRows, quizAttempts: attempts, events, certificates } = data;

    const cohortMap = new Map<string, { learners: Set<string>; completions: number }>();
    const firstSeenByUser = new Map<string, string>();
    for (const row of progressRows) {
      const timestamp = row.completedAt ?? row.lastWatchedAt;
      if (!timestamp) continue;
      const cohort = timestamp.slice(0, 7);
      const current = firstSeenByUser.get(row.userId);
      if (!current || timestamp < current) {
        firstSeenByUser.set(row.userId, timestamp);
      }
      if (row.completed) {
        const cohortEntry = cohortMap.get(cohort) ?? { learners: new Set<string>(), completions: 0 };
        cohortEntry.completions += 1;
        cohortMap.set(cohort, cohortEntry);
      }
    }

    firstSeenByUser.forEach((timestamp, userId) => {
      const cohort = timestamp.slice(0, 7);
      const cohortEntry = cohortMap.get(cohort) ?? { learners: new Set<string>(), completions: 0 };
      cohortEntry.learners.add(userId);
      cohortMap.set(cohort, cohortEntry);
    });

    const cohorts = Array.from(cohortMap.entries())
      .map(([cohort, entry]) => ({
        cohort,
        learners: entry.learners.size,
        completions: entry.completions,
      }))
      .sort((a, b) => (a.cohort > b.cohort ? 1 : -1));

    const moduleStats = modules.map((module) => {
      const rows = progressRows.filter((row) => row.moduleId === module.id);
      const started = new Set<string>(rows.map((row) => row.userId));
      const completed = rows.filter((row) => row.completed);
      const completionRate = started.size > 0 ? Math.round((completed.length / started.size) * 100) : 0;
      const avgWatchSeconds = rows.length > 0
        ? Math.round(rows.reduce((sum, row) => sum + (row.watchTimeSeconds ?? 0), 0) / rows.length)
        : 0;

      return {
        moduleId: module.id,
        title: module.title,
        courseId: module.courseId,
        moduleType: module.moduleType,
        sortOrder: module.sortOrder,
        startedLearners: started.size,
        completedLearners: completed.length,
        completionRate,
        avgWatchSeconds,
      };
    });

    const dropoff = moduleStats
      .filter((row) => row.startedLearners > 0)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 12);

    const quizPerformance = modules
      .filter((module) => module.moduleType === "quiz")
      .map((module) => {
        const attemptsForModule = attempts.filter((attempt) => attempt.moduleId === module.id);
        const passedCount = attemptsForModule.filter((attempt) => attempt.passed).length;
        const passRate =
          attemptsForModule.length > 0 ? Math.round((passedCount / attemptsForModule.length) * 100) : 0;
        const avgScore =
          attemptsForModule.length > 0
            ? Math.round(
                attemptsForModule.reduce((sum, attempt) => sum + attempt.scorePercent, 0) /
                  attemptsForModule.length
              )
            : 0;

        return {
          moduleId: module.id,
          title: module.title,
          attempts: attemptsForModule.length,
          passRate,
          avgScore,
        };
      })
      .sort((a, b) => b.attempts - a.attempts || b.passRate - a.passRate);

    const watchBehavior = modules
      .map((module) => {
        const moduleEvents = events.filter((event) => event.moduleId === module.id);
        const totalWatchSeconds = moduleEvents.reduce(
          (sum, event) => sum + event.watchTimeSeconds,
          0
        );
        const learners = new Set(moduleEvents.map((event) => event.userId));
        const avgWatchSeconds =
          moduleEvents.length > 0 ? Math.round(totalWatchSeconds / moduleEvents.length) : 0;

        return {
          moduleId: module.id,
          title: module.title,
          learners: learners.size,
          totalWatchSeconds,
          avgWatchSeconds,
        };
      })
      .sort((a, b) => b.totalWatchSeconds - a.totalWatchSeconds);

    return NextResponse.json(
      {
        success: true,
        summary: {
          totalCourses: courses.length,
          totalModules: modules.length,
          totalCertificates: certificates.length,
          totalQuizAttempts: attempts.length,
          totalEvents: events.length,
        },
        cohorts,
        dropoff,
        quizPerformance,
        watchBehavior,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS analytics route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
