import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import { courses, courseModules } from "@/lib/db/schema";
import {
  listProgress,
  upsertProgress,
  getNote,
  upsertNote,
  createQuizAttempt,
  listQuizAttempts,
  recordModuleEvent,
  listCertificates,
  issueCertificate,
  getCertificateByToken,
} from "@/lib/db/access/learning";

let db: ReturnType<typeof makeTestDb>;
let courseId: string;
let moduleId: string;
const ctxA = ctxFor("userA");
const ctxB = ctxFor("userB");

// Seed a course + module so FK constraints on progress/notes/quiz/event/cert rows
// are satisfied (better-sqlite3 enforces foreign keys).
async function seedCourseAndModule(database: ReturnType<typeof makeTestDb>) {
  const cId = crypto.randomUUID();
  await database.insert(courses).values({
    id: cId,
    title: "Course",
    description: "A course",
    status: "published",
    accessLevel: "partner",
  });
  const mId = crypto.randomUUID();
  await database.insert(courseModules).values({
    id: mId,
    courseId: cId,
    title: "Module 1",
    cloudflareVideoId: "video-1",
  });
  return { cId, mId };
}

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "userB");
  const seeded = await seedCourseAndModule(db);
  courseId = seeded.cId;
  moduleId = seeded.mId;
});

describe("learning access (owner-scoped)", () => {
  it("progress is isolated: userB cannot read userA's progress", async () => {
    await upsertProgress(db, ctxA, { moduleId, completed: true, watchTimeSeconds: 120 });
    const a = await listProgress(db, ctxA);
    const b = await listProgress(db, ctxB);
    expect(a).toHaveLength(1);
    expect(a[0].completed).toBe(true);
    expect(a[0].watchTimeSeconds).toBe(120);
    // Denial: userB sees none of userA's progress.
    expect(b).toHaveLength(0);
  });

  it("upsertProgress updates the same row on a second call (no duplicate)", async () => {
    await upsertProgress(db, ctxA, { moduleId, watchTimeSeconds: 30 });
    await upsertProgress(db, ctxA, { moduleId, completed: true });
    const a = await listProgress(db, ctxA);
    expect(a).toHaveLength(1);
    expect(a[0].completed).toBe(true);
    expect(a[0].watchTimeSeconds).toBe(30);
  });

  it("notes are per-user and upsert in place", async () => {
    await upsertNote(db, ctxA, moduleId, "userA note");
    await upsertNote(db, ctxB, moduleId, "userB note");
    expect((await getNote(db, ctxA, moduleId))?.content).toBe("userA note");
    expect((await getNote(db, ctxB, moduleId))?.content).toBe("userB note");

    await upsertNote(db, ctxA, moduleId, "userA edited");
    expect((await getNote(db, ctxA, moduleId))?.content).toBe("userA edited");
    // Denial: userA's edit did not touch userB's note.
    expect((await getNote(db, ctxB, moduleId))?.content).toBe("userB note");
  });

  it("a non-manager listing quiz attempts sees only their own (cross-user isolation)", async () => {
    await createQuizAttempt(db, ctxA, { courseId, moduleId, scorePercent: 90, passed: true });
    await createQuizAttempt(db, ctxB, { courseId, moduleId, scorePercent: 40 });
    const aAttempts = await listQuizAttempts(db, ctxA, moduleId);
    expect(aAttempts).toHaveLength(1);
    expect(aAttempts[0].userId).toBe("userA");
    // Denial: userA does not see userB's attempt.
    expect(aAttempts.every((r) => r.userId === "userA")).toBe(true);
  });

  it("an lms_manager listing quiz attempts sees all learners' attempts for the module", async () => {
    await createQuizAttempt(db, ctxA, { courseId, moduleId, scorePercent: 90, passed: true });
    await createQuizAttempt(db, ctxB, { courseId, moduleId, scorePercent: 40 });
    const manager = ctxFor("userA", { roleKeys: ["lms_manager"] });
    const all = await listQuizAttempts(db, manager, moduleId);
    expect(all).toHaveLength(2);
    expect(new Set(all.map((r) => r.userId))).toEqual(new Set(["userA", "userB"]));
  });

  it("recordModuleEvent writes an owner-scoped event row", async () => {
    const evt = await recordModuleEvent(db, ctxA, { courseId, moduleId, eventType: "module_completed" });
    expect(evt.userId).toBe("userA");
    expect(evt.eventType).toBe("module_completed");
  });

  it("certificates are owner-scoped and getCertificateByToken works without ctx", async () => {
    await issueCertificate(db, ctxA, {
      courseId,
      completionRate: 100,
      verificationToken: "tok-abc",
      certificateNumber: "CERT-001",
    });
    const aCerts = await listCertificates(db, ctxA);
    const bCerts = await listCertificates(db, ctxB);
    expect(aCerts).toHaveLength(1);
    // Denial: userB owns no certificate from userA's issuance.
    expect(bCerts).toHaveLength(0);

    // CTX-FREE public verification lookup returns the cert by token.
    const verified = await getCertificateByToken(db, "tok-abc");
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("userA");
    expect(verified?.courseId).toBe(courseId);
    expect(await getCertificateByToken(db, "nope")).toBeNull();
  });

  it("issueCertificate upserts by (userId, courseId) without creating duplicates", async () => {
    await issueCertificate(db, ctxA, { courseId, completionRate: 80, verificationToken: "tok-1" });
    const updated = await issueCertificate(db, ctxA, { courseId, completionRate: 100, verificationToken: "tok-2" });
    expect(updated?.completionRate).toBe(100);
    expect(updated?.verificationToken).toBe("tok-2");
    expect(await listCertificates(db, ctxA)).toHaveLength(1);
  });
});
