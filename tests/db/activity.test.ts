import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import { courses } from "@/lib/db/schema";
import {
  recordActivity,
  listMyActivity,
  listAllActivity,
  writeAuditLog,
  listAuditLogs,
  createCourseVersion,
  listCourseVersions,
} from "@/lib/db/access/activity";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
let courseId: string;
const ctxA = ctxFor("userA");
const analyst = ctxFor("an", { roleKeys: ["analyst"] });

// Seed a course so course_versions FK (course_id -> courses.id) is satisfied
// (better-sqlite3 enforces foreign keys).
async function seedCourse(database: ReturnType<typeof makeTestDb>): Promise<string> {
  const id = crypto.randomUUID();
  await database.insert(courses).values({
    id,
    title: "Course",
    description: "A course",
    status: "published",
    accessLevel: "partner",
  });
  return id;
}

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "an");
  courseId = await seedCourse(db);
});

describe("activity events (owner-scoped)", () => {
  it("recordActivity then listMyActivity returns only the caller's own rows", async () => {
    await recordActivity(db, ctxA, { type: "login" });
    await recordActivity(db, ctxA, { type: "content_viewed", metadata: { id: "x" } });
    await recordActivity(db, analyst, { type: "login" });

    const mine = await listMyActivity(db, ctxA);
    expect(mine).toHaveLength(2);
    // Denial: userA's feed contains none of the analyst's events.
    expect(mine.every((r) => r.userId === "userA")).toBe(true);
  });

  it("listAllActivity is denied to a plain user but succeeds for an analyst", async () => {
    await recordActivity(db, ctxA, { type: "login" });
    await recordActivity(db, analyst, { type: "login" });

    // Denial: a plain user cannot read everyone's activity.
    await expect(listAllActivity(db, ctxA)).rejects.toBeInstanceOf(AuthorizationError);

    const all = await listAllActivity(db, analyst);
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(new Set(all.map((r) => r.userId))).toEqual(new Set(["userA", "an"]));
  });
});

describe("admin audit logs (manager-gated)", () => {
  it("writeAuditLog is denied to a plain user", async () => {
    // Denial: no content/support/lms manager role and not admin.
    await expect(
      writeAuditLog(db, ctxA, { action: "deleted", entityType: "content" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a support_manager can write and an analyst can read audit logs", async () => {
    const supportManager = ctxFor("sm", { roleKeys: ["support_manager"] });
    await seedUser(db, "sm");
    const log = await writeAuditLog(db, supportManager, {
      action: "resolved",
      entityType: "ticket",
      entityId: "t-1",
    });
    expect(log.actorUserId).toBe("sm");

    const logs = await listAuditLogs(db, analyst);
    expect(logs.map((l) => l.action)).toContain("resolved");

    // Denial: a plain user cannot read audit logs.
    await expect(listAuditLogs(db, ctxA)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("course versions (lms_manager-gated writes)", () => {
  it("a non-manager cannot create a course version", async () => {
    // Denial: no lms_manager role and not admin.
    await expect(
      createCourseVersion(db, ctxA, { courseId, versionNumber: 1, snapshot: {} }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("an lms_manager creates versions; analysts and lms_managers can list them", async () => {
    const lmsManager = ctxFor("lm", { roleKeys: ["lms_manager"] });
    await seedUser(db, "lm");
    const v1 = await createCourseVersion(db, lmsManager, {
      courseId,
      versionNumber: 1,
      snapshot: { title: "v1" },
      published: true,
    });
    expect(v1.createdBy).toBe("lm");

    const listed = await listCourseVersions(db, analyst, courseId);
    expect(listed.map((v) => v.versionNumber)).toContain(1);

    // Denial: a plain user cannot list course versions.
    await expect(listCourseVersions(db, ctxA, courseId)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
