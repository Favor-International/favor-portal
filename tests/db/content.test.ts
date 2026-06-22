import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb, ctxFor, seedUser } from "./helpers";
import { portalContent } from "@/lib/db/schema";
import {
  listContent,
  getContent,
  createContent,
  updateContent,
  deleteContent,
  listDashboardOverrides,
  upsertDashboardOverride,
} from "@/lib/db/access/content";
import { AuthorizationError } from "@/lib/db/access/authz";

let db: ReturnType<typeof makeTestDb>;
let allContentId: string;
let majorDonorContentId: string;

// Insert published content directly via the schema so visibility logic can be
// exercised without going through the manager-gated createContent path.
async function seedContent(
  database: ReturnType<typeof makeTestDb>,
  accessLevel: "all" | "major_donor",
): Promise<string> {
  const id = crypto.randomUUID();
  await database.insert(portalContent).values({
    id,
    title: `${accessLevel} content`,
    excerpt: `A ${accessLevel} excerpt`,
    body: "body",
    type: "update",
    accessLevel,
    status: "published",
  });
  return id;
}

beforeEach(async () => {
  db = makeTestDb();
  await seedUser(db, "userA");
  await seedUser(db, "m");
  allContentId = await seedContent(db, "all");
  majorDonorContentId = await seedContent(db, "major_donor");
});

describe("content access (visibility-gated)", () => {
  it("an individual sees the 'all' content but not the 'major_donor' content", async () => {
    const ctx = ctxFor("userA", { constituentType: "individual" });
    const ids = (await listContent(db, ctx)).map((c) => c.id);
    expect(ids).toContain(allContentId);
    expect(ids).not.toContain(majorDonorContentId);

    expect(await getContent(db, ctx, allContentId)).not.toBeNull();
    // Denial: the major_donor content is invisible to an individual.
    expect(await getContent(db, ctx, majorDonorContentId)).toBeNull();
  });

  it("an admin sees both content rows regardless of access level", async () => {
    const admin = ctxFor("x", { isAdmin: true });
    const ids = (await listContent(db, admin)).map((c) => c.id);
    expect(ids).toContain(allContentId);
    expect(ids).toContain(majorDonorContentId);
  });

  it("unpublished or future-published content is hidden from non-admins", async () => {
    const ctx = ctxFor("userA", { constituentType: "individual" });
    const draftId = crypto.randomUUID();
    await db.insert(portalContent).values({
      id: draftId,
      title: "draft",
      excerpt: "x",
      body: "b",
      type: "update",
      accessLevel: "all",
      status: "draft",
    });
    const futureId = crypto.randomUUID();
    await db.insert(portalContent).values({
      id: futureId,
      title: "future",
      excerpt: "x",
      body: "b",
      type: "update",
      accessLevel: "all",
      status: "published",
      publishedAt: "2999-01-01T00:00:00.000Z",
    });
    const ids = (await listContent(db, ctx)).map((c) => c.id);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(futureId);
  });

  it("a non-manager cannot create content", async () => {
    const ctx = ctxFor("userA");
    // Denial: no content_manager/lms_manager role and not admin.
    await expect(
      createContent(db, ctx, {
        title: "X",
        excerpt: "Y",
        body: "Z",
        type: "update",
        accessLevel: "all",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a content manager can create, update, and delete content", async () => {
    const manager = ctxFor("m", { roleKeys: ["content_manager"] });
    const created = await createContent(db, manager, {
      title: "New",
      excerpt: "E",
      body: "B",
      type: "report",
      accessLevel: "all",
      status: "published",
    });
    expect(created.id).toBeTruthy();
    expect(created.createdBy).toBe("m");
    expect(created.updatedBy).toBe("m");

    const admin = ctxFor("x", { isAdmin: true });
    expect((await listContent(db, admin)).map((c) => c.id)).toContain(created.id);

    await updateContent(db, manager, created.id, { title: "Renamed" });
    expect((await getContent(db, admin, created.id))?.title).toBe("Renamed");

    await deleteContent(db, manager, created.id);
    expect(await getContent(db, admin, created.id)).toBeNull();
  });
});

describe("dashboard overrides", () => {
  it("any authenticated user may read overrides; only a content manager may upsert", async () => {
    const manager = ctxFor("m", { roleKeys: ["content_manager"] });
    const upserted = await upsertDashboardOverride(db, manager, {
      roleKey: "individual",
      highlights: [{ label: "Hello" }],
    });
    expect(upserted?.roleKey).toBe("individual");
    expect(upserted?.updatedBy).toBe("m");

    // A plain authenticated user can read all overrides.
    const reader = ctxFor("userA");
    const all = await listDashboardOverrides(db, reader);
    expect(all.map((o) => o.roleKey)).toContain("individual");
  });

  it("upsert is keyed on roleKey (no duplicates) and overwrites in place", async () => {
    const manager = ctxFor("m", { roleKeys: ["content_manager"] });
    await upsertDashboardOverride(db, manager, { roleKey: "church", highlights: [{ a: 1 }] });
    await upsertDashboardOverride(db, manager, { roleKey: "church", actions: [{ b: 2 }] });
    const rows = (await listDashboardOverrides(db, manager)).filter((o) => o.roleKey === "church");
    expect(rows).toHaveLength(1);
    expect(rows[0].highlights).toEqual([{ a: 1 }]);
    expect(rows[0].actions).toEqual([{ b: 2 }]);
  });

  it("a non-manager cannot upsert a dashboard override", async () => {
    const ctx = ctxFor("userA");
    // Denial: no content_manager role and not admin.
    await expect(
      upsertDashboardOverride(db, ctx, { roleKey: "individual", highlights: [] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
