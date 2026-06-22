import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import {
  courseCohorts,
  courseCohortMembers,
  courseDiscussionThreads,
  courseDiscussionReplies,
} from "../schema";
import { AuthorizationError, canManage } from "./authz";

export type NewCohort = {
  courseId: string;
  name: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

export type UpdateCohort = Partial<Omit<NewCohort, "courseId">>;

export type NewThread = {
  courseId: string;
  cohortId?: string | null;
  moduleId?: string | null;
  title: string;
  body: string;
};

export type UpdateThread = {
  title?: string;
  body?: string;
  pinned?: boolean;
  locked?: boolean;
};

// ---------------------------------------------------------------------------
// cohorts (course_cohorts) — any authenticated user may read cohorts for a
// course; create/update/delete are gated to lms_manager / admin.
// ---------------------------------------------------------------------------
export async function listCohorts(db: Db, ctx: AuthContext, courseId: string) {
  return db
    .select()
    .from(courseCohorts)
    .where(eq(courseCohorts.courseId, courseId))
    .orderBy(asc(courseCohorts.createdAt))
    .all();
}

export async function createCohort(db: Db, ctx: AuthContext, input: NewCohort) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    courseId: input.courseId,
    name: input.name,
    description: input.description ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    isActive: input.isActive ?? true,
    createdBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(courseCohorts).values(row);
  return row;
}

export async function updateCohort(db: Db, ctx: AuthContext, id: string, input: UpdateCohort) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  const now = new Date().toISOString();
  await db
    .update(courseCohorts)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: now,
    })
    .where(eq(courseCohorts.id, id));
}

export async function deleteCohort(db: Db, ctx: AuthContext, id: string) {
  if (!canManage(ctx, ["lms_manager"])) throw new AuthorizationError();
  await db.delete(courseCohorts).where(eq(courseCohorts.id, id));
}

// ---------------------------------------------------------------------------
// cohort members (course_cohort_members) — self-service join/leave; users may
// only manage their own membership.
// ---------------------------------------------------------------------------
export async function joinCohort(db: Db, ctx: AuthContext, cohortId: string) {
  const cohort = await db.select().from(courseCohorts).where(eq(courseCohorts.id, cohortId)).get();
  if (!cohort || !cohort.isActive) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    cohortId,
    userId: ctx.userId,
    membershipRole: "learner" as const,
    joinedAt: now,
  };
  await db.insert(courseCohortMembers).values(row);
  return row;
}

export async function leaveCohort(db: Db, ctx: AuthContext, cohortId: string) {
  await db
    .delete(courseCohortMembers)
    .where(and(eq(courseCohortMembers.cohortId, cohortId), eq(courseCohortMembers.userId, ctx.userId)));
}

export async function listMyMemberships(db: Db, ctx: AuthContext) {
  return db
    .select()
    .from(courseCohortMembers)
    .where(eq(courseCohortMembers.userId, ctx.userId))
    .all();
}

// ---------------------------------------------------------------------------
// discussion threads (course_discussion_threads) — course-scoped read;
// author-scoped writes (author OR lms_manager may update/delete).
// ---------------------------------------------------------------------------
export async function listThreads(db: Db, ctx: AuthContext, courseId: string) {
  return db
    .select()
    .from(courseDiscussionThreads)
    .where(eq(courseDiscussionThreads.courseId, courseId))
    .orderBy(desc(courseDiscussionThreads.lastActivityAt))
    .all();
}

export async function createThread(db: Db, ctx: AuthContext, input: NewThread) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    courseId: input.courseId,
    cohortId: input.cohortId ?? null,
    moduleId: input.moduleId ?? null,
    authorUserId: ctx.userId,
    title: input.title,
    body: input.body,
    pinned: false,
    locked: false,
    replyCount: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(courseDiscussionThreads).values(row);
  return row;
}

export async function updateThread(db: Db, ctx: AuthContext, id: string, input: UpdateThread) {
  const existing = await db
    .select()
    .from(courseDiscussionThreads)
    .where(eq(courseDiscussionThreads.id, id))
    .get();
  if (!existing) throw new AuthorizationError();
  if (existing.authorUserId !== ctx.userId && !canManage(ctx, ["lms_manager"])) {
    throw new AuthorizationError();
  }
  const now = new Date().toISOString();
  await db
    .update(courseDiscussionThreads)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.locked !== undefined ? { locked: input.locked } : {}),
      updatedAt: now,
    })
    .where(eq(courseDiscussionThreads.id, id));
}

export async function deleteThread(db: Db, ctx: AuthContext, id: string) {
  const existing = await db
    .select()
    .from(courseDiscussionThreads)
    .where(eq(courseDiscussionThreads.id, id))
    .get();
  if (!existing) throw new AuthorizationError();
  if (existing.authorUserId !== ctx.userId && !canManage(ctx, ["lms_manager"])) {
    throw new AuthorizationError();
  }
  await db.delete(courseDiscussionThreads).where(eq(courseDiscussionThreads.id, id));
}

// ---------------------------------------------------------------------------
// discussion replies (course_discussion_replies) — author-scoped writes.
// Creating/deleting a reply recomputes the parent thread's denormalized
// replyCount / lastActivityAt (reproducing the Postgres trigger in app code).
// ---------------------------------------------------------------------------
export async function listReplies(db: Db, ctx: AuthContext, threadId: string) {
  return db
    .select()
    .from(courseDiscussionReplies)
    .where(eq(courseDiscussionReplies.threadId, threadId))
    .orderBy(asc(courseDiscussionReplies.createdAt))
    .all();
}

// Recompute reply_count + last_activity_at for a thread from its replies and
// touch updated_at. Mirrors the trg on course_discussion_replies in Postgres.
async function recomputeThreadMetrics(db: Db, threadId: string) {
  const thread = await db
    .select()
    .from(courseDiscussionThreads)
    .where(eq(courseDiscussionThreads.id, threadId))
    .get();
  if (!thread) return;
  const replies = await db
    .select()
    .from(courseDiscussionReplies)
    .where(eq(courseDiscussionReplies.threadId, threadId))
    .all();
  const replyCount = replies.length;
  const maxReplyCreatedAt = replies.reduce<string | null>(
    (max, r) => (r.createdAt != null && (max == null || r.createdAt > max) ? r.createdAt : max),
    null,
  );
  const lastActivityAt = maxReplyCreatedAt ?? thread.createdAt ?? new Date().toISOString();
  await db
    .update(courseDiscussionThreads)
    .set({ replyCount, lastActivityAt, updatedAt: new Date().toISOString() })
    .where(eq(courseDiscussionThreads.id, threadId));
}

export async function createReply(db: Db, ctx: AuthContext, threadId: string, body: string) {
  const thread = await db
    .select()
    .from(courseDiscussionThreads)
    .where(eq(courseDiscussionThreads.id, threadId))
    .get();
  if (!thread) throw new AuthorizationError();
  if (thread.locked) throw new AuthorizationError();
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    threadId,
    authorUserId: ctx.userId,
    body,
    isInstructorReply: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(courseDiscussionReplies).values(row);
  await recomputeThreadMetrics(db, threadId);
  return row;
}

export async function updateReply(db: Db, ctx: AuthContext, id: string, body: string) {
  const existing = await db
    .select()
    .from(courseDiscussionReplies)
    .where(eq(courseDiscussionReplies.id, id))
    .get();
  if (!existing) throw new AuthorizationError();
  if (existing.authorUserId !== ctx.userId && !canManage(ctx, ["lms_manager"])) {
    throw new AuthorizationError();
  }
  const now = new Date().toISOString();
  await db
    .update(courseDiscussionReplies)
    .set({ body, updatedAt: now })
    .where(eq(courseDiscussionReplies.id, id));
}

export async function deleteReply(db: Db, ctx: AuthContext, id: string) {
  const existing = await db
    .select()
    .from(courseDiscussionReplies)
    .where(eq(courseDiscussionReplies.id, id))
    .get();
  if (!existing) throw new AuthorizationError();
  if (existing.authorUserId !== ctx.userId && !canManage(ctx, ["lms_manager"])) {
    throw new AuthorizationError();
  }
  await db.delete(courseDiscussionReplies).where(eq(courseDiscussionReplies.id, id));
  await recomputeThreadMetrics(db, existing.threadId);
}
