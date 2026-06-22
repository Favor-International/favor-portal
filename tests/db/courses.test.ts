import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import { courses } from "@/lib/db/schema";
import {
  listCourses,
  getCourse,
  listModules,
  createCourse,
} from "@/lib/db/access/courses";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
let partnerCourseId: string;
let majorDonorCourseId: string;

// Insert a published course directly via the schema so visibility logic can be
// exercised without going through the manager-gated createCourse path.
async function seedCourse(
  database: ReturnType<typeof makeTestDb>,
  accessLevel: "partner" | "major_donor",
): Promise<string> {
  const id = crypto.randomUUID();
  await database.insert(courses).values({
    id,
    title: `${accessLevel} course`,
    description: `A ${accessLevel} course`,
    status: "published",
    accessLevel,
  });
  return id;
}

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  partnerCourseId = await seedCourse(db, "partner");
  majorDonorCourseId = await seedCourse(db, "major_donor");
});

describe("courses access (visibility-gated)", () => {
  it("an individual constituent sees the partner course but not the major_donor course", async () => {
    const ctx = ctxFor("userA", { constituentType: "individual" });
    const visible = await listCourses(db, ctx);
    const ids = visible.map((c) => c.id);
    expect(ids).toContain(partnerCourseId);
    expect(ids).not.toContain(majorDonorCourseId);

    expect(await getCourse(db, ctx, partnerCourseId)).not.toBeNull();
    // Denial: the major_donor course is invisible to an individual.
    expect(await getCourse(db, ctx, majorDonorCourseId)).toBeNull();
  });

  it("an admin sees both courses regardless of access level", async () => {
    const admin = ctxFor("x", { isAdmin: true });
    const visible = await listCourses(db, admin);
    const ids = visible.map((c) => c.id);
    expect(ids).toContain(partnerCourseId);
    expect(ids).toContain(majorDonorCourseId);
  });

  it("an unpublished or locked course is hidden from non-admins", async () => {
    const ctx = ctxFor("userA", { constituentType: "individual" });
    const draftId = crypto.randomUUID();
    await db.insert(courses).values({
      id: draftId,
      title: "draft course",
      description: "draft",
      status: "draft",
      accessLevel: "partner",
    });
    const lockedId = crypto.randomUUID();
    await db.insert(courses).values({
      id: lockedId,
      title: "locked course",
      description: "locked",
      status: "published",
      accessLevel: "partner",
      isLocked: true,
    });
    const ids = (await listCourses(db, ctx)).map((c) => c.id);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(lockedId);
  });

  it("listModules throws when the parent course is not visible to the caller", async () => {
    const ctx = ctxFor("userA", { constituentType: "individual" });
    // Denial: an individual cannot enumerate modules of a major_donor course.
    await expect(listModules(db, ctx, majorDonorCourseId)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a non-manager cannot create a course", async () => {
    const ctx = ctxFor("userA");
    // Denial: no lms_manager role and not admin.
    await expect(
      createCourse(db, ctx, { title: "X", description: "Y" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("an lms_manager can create a course", async () => {
    const ctx = ctxFor("userA", { roleKeys: ["lms_manager"] });
    const created = await createCourse(db, ctx, { title: "New", description: "Desc", accessLevel: "partner" });
    expect(created.id).toBeTruthy();
    const admin = ctxFor("x", { isAdmin: true });
    expect((await listCourses(db, admin)).map((c) => c.id)).toContain(created.id);
  });
});
