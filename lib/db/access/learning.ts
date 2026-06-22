import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import {
  courses,
  courseModules,
  userCourseProgress,
  userCourseNotes,
  userQuizAttempts,
  courseModuleEvents,
  userCourseCertificates,
} from "../schema";
import { AuthorizationError, canManage } from "./authz";

// Roles permitted to read aggregate, cross-user LMS analytics.
const ANALYTICS_ROLES = ["lms_manager", "analyst"];

// Raw, cross-user rows backing the admin LMS analytics dashboard. Manager/analyst
// (or admin) only — callers aggregate these into the route's response shape.
export type LmsAnalyticsData = {
  courses: { id: string; title: string }[];
  modules: {
    id: string;
    courseId: string;
    title: string;
    sortOrder: number | null;
    moduleType: string;
  }[];
  progress: {
    userId: string;
    moduleId: string;
    completed: boolean | null;
    watchTimeSeconds: number | null;
    completedAt: string | null;
    lastWatchedAt: string | null;
  }[];
  quizAttempts: { moduleId: string; scorePercent: number; passed: boolean }[];
  events: {
    moduleId: string;
    eventType: string;
    userId: string;
    watchTimeSeconds: number;
    createdAt: string | null;
  }[];
  certificates: { courseId: string; userId: string; issuedAt: string | null }[];
};

export async function getLmsAnalyticsData(db: Db, ctx: AuthContext): Promise<LmsAnalyticsData> {
  if (!(ctx.isAdmin || canManage(ctx, ANALYTICS_ROLES))) throw new AuthorizationError();

  const [courseRows, moduleRows, progressRows, attemptRows, eventRows, certificateRows] = await Promise.all([
    db.select({ id: courses.id, title: courses.title }).from(courses).all(),
    db
      .select({
        id: courseModules.id,
        courseId: courseModules.courseId,
        title: courseModules.title,
        sortOrder: courseModules.sortOrder,
        moduleType: courseModules.moduleType,
      })
      .from(courseModules)
      .all(),
    db
      .select({
        userId: userCourseProgress.userId,
        moduleId: userCourseProgress.moduleId,
        completed: userCourseProgress.completed,
        watchTimeSeconds: userCourseProgress.watchTimeSeconds,
        completedAt: userCourseProgress.completedAt,
        lastWatchedAt: userCourseProgress.lastWatchedAt,
      })
      .from(userCourseProgress)
      .all(),
    db
      .select({
        moduleId: userQuizAttempts.moduleId,
        scorePercent: userQuizAttempts.scorePercent,
        passed: userQuizAttempts.passed,
      })
      .from(userQuizAttempts)
      .all(),
    db
      .select({
        moduleId: courseModuleEvents.moduleId,
        eventType: courseModuleEvents.eventType,
        userId: courseModuleEvents.userId,
        watchTimeSeconds: courseModuleEvents.watchTimeSeconds,
        createdAt: courseModuleEvents.createdAt,
      })
      .from(courseModuleEvents)
      .all(),
    db
      .select({
        courseId: userCourseCertificates.courseId,
        userId: userCourseCertificates.userId,
        issuedAt: userCourseCertificates.issuedAt,
      })
      .from(userCourseCertificates)
      .all(),
  ]);

  return {
    courses: courseRows,
    modules: moduleRows,
    progress: progressRows,
    quizAttempts: attemptRows,
    events: eventRows,
    certificates: certificateRows,
  };
}

export type ProgressInput = {
  moduleId: string;
  completed?: boolean;
  watchTimeSeconds?: number;
};

export type QuizAttemptInput = {
  courseId: string;
  moduleId: string;
  attemptNumber?: number;
  scorePercent: number;
  correctAnswers?: number;
  totalQuestions?: number;
  passed?: boolean;
  answers?: Record<string, unknown>;
  questionOrder?: string[];
  optionOrder?: Record<string, unknown>;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};

export type ModuleEventInput = {
  courseId: string;
  moduleId: string;
  eventType:
    | "module_viewed"
    | "module_started"
    | "module_completed"
    | "module_reopened"
    | "quiz_passed"
    | "quiz_failed";
  watchTimeSeconds?: number;
  metadata?: Record<string, unknown>;
};

export type IssueCertificateInput = {
  courseId: string;
  completionRate?: number;
  verificationToken?: string | null;
  certificateNumber?: string | null;
  certificateUrl?: string | null;
};

// ---------------------------------------------------------------------------
// progress (user_course_progress, owner-scoped, unique(userId, moduleId))
// ---------------------------------------------------------------------------
export async function listProgress(db: Db, ctx: AuthContext) {
  return db
    .select()
    .from(userCourseProgress)
    .where(eq(userCourseProgress.userId, ctx.userId))
    .all();
}

export async function upsertProgress(db: Db, ctx: AuthContext, input: ProgressInput) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(userCourseProgress)
    .where(and(eq(userCourseProgress.userId, ctx.userId), eq(userCourseProgress.moduleId, input.moduleId)))
    .get();
  const completed = input.completed ?? existing?.completed ?? false;
  if (existing) {
    await db
      .update(userCourseProgress)
      .set({
        ...(input.completed !== undefined ? { completed: input.completed } : {}),
        ...(input.watchTimeSeconds !== undefined ? { watchTimeSeconds: input.watchTimeSeconds } : {}),
        ...(completed ? { completedAt: existing.completedAt ?? now } : {}),
        lastWatchedAt: now,
      })
      .where(and(eq(userCourseProgress.userId, ctx.userId), eq(userCourseProgress.moduleId, input.moduleId)));
  } else {
    await db.insert(userCourseProgress).values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      moduleId: input.moduleId,
      completed,
      completedAt: completed ? now : null,
      watchTimeSeconds: input.watchTimeSeconds ?? 0,
      lastWatchedAt: now,
    });
  }
  return db
    .select()
    .from(userCourseProgress)
    .where(and(eq(userCourseProgress.userId, ctx.userId), eq(userCourseProgress.moduleId, input.moduleId)))
    .get();
}

// ---------------------------------------------------------------------------
// notes (user_course_notes, owner-scoped, unique(userId, moduleId))
// ---------------------------------------------------------------------------
export async function getNote(db: Db, ctx: AuthContext, moduleId: string) {
  const note = await db
    .select()
    .from(userCourseNotes)
    .where(and(eq(userCourseNotes.userId, ctx.userId), eq(userCourseNotes.moduleId, moduleId)))
    .get();
  return note ?? null;
}

export async function upsertNote(db: Db, ctx: AuthContext, moduleId: string, content: string) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(userCourseNotes)
    .where(and(eq(userCourseNotes.userId, ctx.userId), eq(userCourseNotes.moduleId, moduleId)))
    .get();
  if (existing) {
    await db
      .update(userCourseNotes)
      .set({ content, updatedAt: now })
      .where(and(eq(userCourseNotes.userId, ctx.userId), eq(userCourseNotes.moduleId, moduleId)));
  } else {
    await db.insert(userCourseNotes).values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      moduleId,
      content,
      createdAt: now,
      updatedAt: now,
    });
  }
  return getNote(db, ctx, moduleId);
}

// ---------------------------------------------------------------------------
// quiz attempts (user_quiz_attempts, owner-scoped insert; manager/analyst can
// list all attempts for a module)
// ---------------------------------------------------------------------------
export async function createQuizAttempt(db: Db, ctx: AuthContext, input: QuizAttemptInput) {
  const now = new Date().toISOString();
  let attemptNumber = input.attemptNumber;
  if (attemptNumber === undefined) {
    const prior = await db
      .select()
      .from(userQuizAttempts)
      .where(and(eq(userQuizAttempts.userId, ctx.userId), eq(userQuizAttempts.moduleId, input.moduleId)))
      .all();
    attemptNumber = prior.length + 1;
  }
  const row = {
    id: crypto.randomUUID(),
    userId: ctx.userId,
    courseId: input.courseId,
    moduleId: input.moduleId,
    attemptNumber,
    scorePercent: input.scorePercent,
    correctAnswers: input.correctAnswers ?? 0,
    totalQuestions: input.totalQuestions ?? 0,
    passed: input.passed ?? false,
    answers: input.answers ?? {},
    questionOrder: input.questionOrder ?? [],
    optionOrder: input.optionOrder ?? {},
    startedAt: now,
    submittedAt: now,
    durationSeconds: input.durationSeconds ?? 0,
    metadata: input.metadata ?? {},
  };
  await db.insert(userQuizAttempts).values(row);
  return row;
}

export async function listQuizAttempts(db: Db, ctx: AuthContext, moduleId: string) {
  // Managers/analysts may see every learner's attempts for the module; everyone
  // else is restricted to their own rows.
  if (canManage(ctx, ["lms_manager", "analyst"])) {
    return db
      .select()
      .from(userQuizAttempts)
      .where(eq(userQuizAttempts.moduleId, moduleId))
      .orderBy(desc(userQuizAttempts.submittedAt))
      .all();
  }
  return db
    .select()
    .from(userQuizAttempts)
    .where(and(eq(userQuizAttempts.userId, ctx.userId), eq(userQuizAttempts.moduleId, moduleId)))
    .orderBy(desc(userQuizAttempts.submittedAt))
    .all();
}

// ---------------------------------------------------------------------------
// module events (course_module_events, owner-scoped insert)
// ---------------------------------------------------------------------------
export async function recordModuleEvent(db: Db, ctx: AuthContext, input: ModuleEventInput) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: ctx.userId,
    courseId: input.courseId,
    moduleId: input.moduleId,
    eventType: input.eventType,
    watchTimeSeconds: input.watchTimeSeconds ?? 0,
    metadata: input.metadata ?? {},
    createdAt: now,
  };
  await db.insert(courseModuleEvents).values(row);
  return row;
}

// ---------------------------------------------------------------------------
// certificates (user_course_certificates, owner-scoped, unique(userId, courseId))
// ---------------------------------------------------------------------------
export async function listCertificates(db: Db, ctx: AuthContext) {
  return db
    .select()
    .from(userCourseCertificates)
    .where(eq(userCourseCertificates.userId, ctx.userId))
    .all();
}

export async function issueCertificate(db: Db, ctx: AuthContext, input: IssueCertificateInput) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(userCourseCertificates)
    .where(and(eq(userCourseCertificates.userId, ctx.userId), eq(userCourseCertificates.courseId, input.courseId)))
    .get();
  if (existing) {
    await db
      .update(userCourseCertificates)
      .set({
        ...(input.completionRate !== undefined ? { completionRate: input.completionRate } : {}),
        ...(input.verificationToken !== undefined ? { verificationToken: input.verificationToken } : {}),
        ...(input.certificateNumber !== undefined ? { certificateNumber: input.certificateNumber } : {}),
        ...(input.certificateUrl !== undefined ? { certificateUrl: input.certificateUrl } : {}),
        issuedAt: now,
      })
      .where(and(eq(userCourseCertificates.userId, ctx.userId), eq(userCourseCertificates.courseId, input.courseId)));
  } else {
    await db.insert(userCourseCertificates).values({
      id: crypto.randomUUID(),
      userId: ctx.userId,
      courseId: input.courseId,
      completionRate: input.completionRate ?? 100,
      issuedAt: now,
      certificateUrl: input.certificateUrl ?? null,
      verificationToken: input.verificationToken ?? null,
      certificateNumber: input.certificateNumber ?? null,
    });
  }
  return db
    .select()
    .from(userCourseCertificates)
    .where(and(eq(userCourseCertificates.userId, ctx.userId), eq(userCourseCertificates.courseId, input.courseId)))
    .get();
}

// CTX-FREE public verification lookup for the unauthenticated /verify route.
// Returns the certificate matching the given verification token, or null.
export async function getCertificateByToken(db: Db, token: string) {
  if (!token) return null;
  const cert = await db
    .select()
    .from(userCourseCertificates)
    .where(eq(userCourseCertificates.verificationToken, token))
    .get();
  return cert ?? null;
}
