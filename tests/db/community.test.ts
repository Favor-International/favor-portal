import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import { courses, courseDiscussionThreads } from "@/lib/db/schema";
import {
  listCohorts,
  createCohort,
  joinCohort,
  leaveCohort,
  listMyMemberships,
  listThreads,
  createThread,
  updateThread,
  deleteThread,
  listReplies,
  createReply,
  deleteReply,
} from "@/lib/db/access/community";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");
const ctxManager = ctxFor("userManager", { roleKeys: ["lms_manager"] });

const COURSE_ID = "course1";
const THREAD_ID = "threadA";

// Seed a published course and a thread authored by userA.
async function seedCourseAndThread() {
  await db.insert(courses).values({
    id: COURSE_ID,
    title: "Stewardship 101",
    description: "An intro course",
    status: "published",
  });
  const now = new Date().toISOString();
  await db.insert(courseDiscussionThreads).values({
    id: THREAD_ID,
    courseId: COURSE_ID,
    authorUserId: "userA",
    title: "Welcome",
    body: "Say hello",
    replyCount: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "userB");
  await seedUser(db, "userManager");
  await seedCourseAndThread();
});

describe("community access — threads (author-scoped writes)", () => {
  it("course-scoped read returns threads for the course", async () => {
    const threads = await listThreads(db, ctxB, COURSE_ID);
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe(THREAD_ID);
  });

  it("a non-author non-manager cannot delete another user's thread (DENIAL)", async () => {
    await expect(deleteThread(db, ctxB, THREAD_ID)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await listThreads(db, ctxA, COURSE_ID)).toHaveLength(1);
  });

  it("an lms_manager can delete another user's thread", async () => {
    await deleteThread(db, ctxManager, THREAD_ID);
    expect(await listThreads(db, ctxA, COURSE_ID)).toHaveLength(0);
  });

  it("the author can update their own thread", async () => {
    await updateThread(db, ctxA, THREAD_ID, { title: "Updated" });
    const threads = await listThreads(db, ctxA, COURSE_ID);
    expect(threads[0].title).toBe("Updated");
  });

  it("creates a thread with authorUserId set to the caller", async () => {
    const t = await createThread(db, ctxB, { courseId: COURSE_ID, title: "B thread", body: "hi" });
    expect(t.authorUserId).toBe("userB");
    expect(await listThreads(db, ctxA, COURSE_ID)).toHaveLength(2);
  });
});

describe("community access — replies (recompute thread metrics)", () => {
  it("createReply increments replyCount 0 -> 1 -> 2 and updates lastActivityAt", async () => {
    const before = await db
      .select()
      .from(courseDiscussionThreads)
      .where(eq(courseDiscussionThreads.id, THREAD_ID))
      .get();
    expect(before!.replyCount).toBe(0);

    const r1 = await createReply(db, ctxB, THREAD_ID, "first reply");
    const after1 = await db
      .select()
      .from(courseDiscussionThreads)
      .where(eq(courseDiscussionThreads.id, THREAD_ID))
      .get();
    expect(after1!.replyCount).toBe(1);
    expect(after1!.lastActivityAt).toBe(r1.createdAt);

    const r2 = await createReply(db, ctxA, THREAD_ID, "second reply");
    const after2 = await db
      .select()
      .from(courseDiscussionThreads)
      .where(eq(courseDiscussionThreads.id, THREAD_ID))
      .get();
    expect(after2!.replyCount).toBe(2);
    expect(after2!.lastActivityAt).toBe(r2.createdAt);

    expect(await listReplies(db, ctxA, THREAD_ID)).toHaveLength(2);
  });

  it("deleteReply recomputes replyCount back down", async () => {
    const r1 = await createReply(db, ctxB, THREAD_ID, "first reply");
    await createReply(db, ctxA, THREAD_ID, "second reply");
    await deleteReply(db, ctxB, r1.id);
    const after = await db
      .select()
      .from(courseDiscussionThreads)
      .where(eq(courseDiscussionThreads.id, THREAD_ID))
      .get();
    expect(after!.replyCount).toBe(1);
  });

  it("cannot reply to a locked thread", async () => {
    await updateThread(db, ctxA, THREAD_ID, { locked: true });
    await expect(createReply(db, ctxB, THREAD_ID, "nope")).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("community access — cohorts & membership", () => {
  it("manager can create a cohort; any user can list cohorts for a course", async () => {
    await createCohort(db, ctxManager, { courseId: COURSE_ID, name: "Spring 2026" });
    const cohorts = await listCohorts(db, ctxB, COURSE_ID);
    expect(cohorts).toHaveLength(1);
    expect(cohorts[0].name).toBe("Spring 2026");
  });

  it("a non-manager cannot create a cohort (DENIAL)", async () => {
    await expect(
      createCohort(db, ctxB, { courseId: COURSE_ID, name: "Nope" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("joining an inactive cohort throws", async () => {
    const inactive = await createCohort(db, ctxManager, {
      courseId: COURSE_ID,
      name: "Closed",
      isActive: false,
    });
    await expect(joinCohort(db, ctxB, inactive.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a user can join an active cohort, list, and leave", async () => {
    const active = await createCohort(db, ctxManager, { courseId: COURSE_ID, name: "Open" });
    await joinCohort(db, ctxB, active.id);
    expect(await listMyMemberships(db, ctxB)).toHaveLength(1);
    await leaveCohort(db, ctxB, active.id);
    expect(await listMyMemberships(db, ctxB)).toHaveLength(0);
  });

  it("joining a non-existent cohort throws", async () => {
    await expect(joinCohort(db, ctxB, "missing")).rejects.toBeInstanceOf(AuthorizationError);
  });
});
