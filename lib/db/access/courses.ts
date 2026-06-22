import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { courses, courseModules } from "../schema";
import { AuthorizationError, canManage, canViewCourseAccessLevel } from "./authz";

type Course = typeof courses.$inferSelect;

export type NewCourse = {
  title: string;
  description: string;
  thumbnailUrl?: string | null;
  accessLevel?: "partner" | "major_donor" | "church" | "foundation" | "ambassador";
  sortOrder?: number;
  status?: "draft" | "published";
  isLocked?: boolean;
  isPaid?: boolean;
  price?: number;
  tags?: string[];
  coverImage?: string | null;
  enforceSequential?: boolean;
  publishAt?: string | null;
  unpublishAt?: string | null;
};

export type UpdateCourse = Partial<NewCourse>;

// A course is visible to a non-admin when its access level is allowed for the
// constituent type AND it is published, unlocked, and within its publish window.
// Admins see everything.
export function isCourseVisible(ctx: AuthContext, course: Course, nowIso = new Date().toISOString()): boolean {
  if (ctx.isAdmin) return true;
  if (!canViewCourseAccessLevel(ctx, course.accessLevel ?? "partner")) return false;
  if (course.status !== "published") return false;
  if (course.isLocked) return false;
  if (course.publishAt != null && course.publishAt > nowIso) return false;
  if (course.unpublishAt != null && course.unpublishAt <= nowIso) return false;
  return true;
}

export async function listCourses(db: Db, ctx: AuthContext) {
  const nowIso = new Date().toISOString();
  const rows = await db.select().from(courses).all();
  return rows.filter((c) => isCourseVisible(ctx, c, nowIso));
}

export async function getCourse(db: Db, ctx: AuthContext, id: string) {
  const course = await db.select().from(courses).where(eq(courses.id, id)).get();
  if (!course) return null;
  return isCourseVisible(ctx, course) ? course : null;
}

export async function listModules(db: Db, ctx: AuthContext, courseId: string) {
  const course = await db.select().from(courses).where(eq(courses.id, courseId)).get();
  if (!course || !isCourseVisible(ctx, course)) throw new AuthorizationError();
  return db
    .select()
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId))
    .orderBy(asc(courseModules.sortOrder))
    .all();
}

// Modules for a set of already-visible courses (callers must pass course IDs the
// caller is permitted to see — e.g. the result of listCourses). Returns an empty
// array when no course IDs are supplied.
export async function listModulesForCourses(_db: Db, _ctx: AuthContext, courseIds: string[]) {
  if (courseIds.length === 0) return [];
  return _db
    .select()
    .from(courseModules)
    .where(inArray(courseModules.courseId, courseIds))
    .orderBy(asc(courseModules.sortOrder))
    .all();
}

// Manage operations (lms_manager / admin).
export async function createCourse(db: Db, ctx: AuthContext, input: NewCourse) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl ?? null,
    accessLevel: input.accessLevel ?? "partner",
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    status: input.status ?? "published",
    isLocked: input.isLocked ?? false,
    isPaid: input.isPaid ?? false,
    price: input.price ?? 0,
    tags: input.tags ?? [],
    coverImage: input.coverImage ?? null,
    enforceSequential: input.enforceSequential ?? true,
    updatedAt: now,
    publishAt: input.publishAt ?? null,
    unpublishAt: input.unpublishAt ?? null,
  };
  await db.insert(courses).values(row);
  return row;
}

export async function updateCourse(db: Db, ctx: AuthContext, id: string, input: UpdateCourse) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  await db
    .update(courses)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
      ...(input.accessLevel !== undefined ? { accessLevel: input.accessLevel } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {}),
      ...(input.isPaid !== undefined ? { isPaid: input.isPaid } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
      ...(input.enforceSequential !== undefined ? { enforceSequential: input.enforceSequential } : {}),
      ...(input.publishAt !== undefined ? { publishAt: input.publishAt } : {}),
      ...(input.unpublishAt !== undefined ? { unpublishAt: input.unpublishAt } : {}),
      updatedAt: now,
    })
    .where(eq(courses.id, id));
}

export async function deleteCourse(db: Db, ctx: AuthContext, id: string) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  await db.delete(courses).where(eq(courses.id, id));
}

// Manage-gated raw read of a course together with all of its modules (sorted),
// bypassing constituent/visibility filtering. Returns null when the course does
// not exist. Used to build course-version snapshots.
export async function getCourseWithModules(db: Db, ctx: AuthContext, id: string) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  const course = await db.select().from(courses).where(eq(courses.id, id)).get();
  if (!course) return null;
  const modules = await db
    .select()
    .from(courseModules)
    .where(eq(courseModules.courseId, id))
    .orderBy(asc(courseModules.sortOrder))
    .all();
  return { course, modules };
}
